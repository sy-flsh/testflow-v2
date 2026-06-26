import { Prisma } from "@prisma/client";
import type { SecurityAuditEventType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * c9-6: 영속 security audit 로그 + DB 기반 분산 throttle.
 *
 * - 상태 변경 이벤트(COMPANY_USER_DEACTIVATED/REACTIVATED)는 실제 전이마다 항상 DB 저장 시도.
 * - 반복 INACTIVE_COMPANY_ACCESS_DENIED 는 Postgres ON CONFLICT 조건부 update 로
 *   (targetUserId, companyId) 당 window(기본 5분)에 1건만 저장(다중 인스턴스 분산 throttle).
 * - 민감정보(token/password/cookie/inviteUrl/request body/IP 원문 등)는 저장하지 않는다.
 * - 모든 경로를 예외 격리한다: audit 저장/throttle 실패가 호출 API의 200/400/403/404 응답을
 *   절대 바꾸지 않는다(절대 throw 하지 않고 boolean 을 반환).
 *
 * Logging policy: durable DB 저장이 정본. 개발/테스트(NODE_ENV !== "production")에서는 진단용
 * 구조화 콘솔 라인을 1회 emit 하지만, production 에서는 콘솔 중복 노출을 하지 않는다.
 */

export type SecurityAuditEventInput = {
  eventType: SecurityAuditEventType;
  actorUserId?: string;
  targetUserId?: string;
  companyId?: string;
  guardName?: string;
};

/** SECURITY_AUDIT_DENY_THROTTLE_SECONDS (기본 300, 최소 1, 잘못된 값은 300). */
export function getDenyThrottleSeconds(): number {
  const parsed = Number(process.env.SECURITY_AUDIT_DENY_THROTTLE_SECONDS);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 300;
}

/** SECURITY_AUDIT_RETENTION_DAYS (기본 90, 최소 1, 잘못된 값은 90). */
export function getAuditRetentionDays(): number {
  const parsed = Number(process.env.SECURITY_AUDIT_RETENTION_DAYS);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 90;
}

const ACCESS_DENIED: SecurityAuditEventType = "INACTIVE_COMPANY_ACCESS_DENIED";

/** access-denied throttle 키(결정적). companyId/targetUserId 중 하나라도 없으면 null(기록 생략). */
export function buildThrottleKey(input: SecurityAuditEventInput): string | null {
  if (input.eventType !== ACCESS_DENIED) {
    return null;
  }
  if (!input.targetUserId || !input.companyId) {
    return null;
  }
  return `${input.eventType}:${input.targetUserId}:${input.companyId}`;
}

function devLog(input: SecurityAuditEventInput, occurredAt: string): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  // 민감정보 없는 필드만. (단일 라인 JSON — 외부 수집기 친화)
  console.info(
    `[security-audit] ${JSON.stringify({
      eventType: input.eventType,
      occurredAt,
      actorUserId: input.actorUserId,
      targetUserId: input.targetUserId,
      companyId: input.companyId,
      guardName: input.guardName,
    })}`,
  );
}

function toEventData(input: SecurityAuditEventInput): Prisma.SecurityAuditEventCreateInput {
  return {
    eventType: input.eventType,
    actorUserId: input.actorUserId ?? null,
    targetUserId: input.targetUserId ?? null,
    companyId: input.companyId ?? null,
    guardName: input.guardName ?? null,
    // metadata 는 현재 c9 이벤트에 불필요 → DB NULL. (payload 통째 저장 금지)
    metadata: Prisma.DbNull,
  };
}

/**
 * 감사 이벤트 기록. 절대 throw 하지 않으며, 실제로 DB 에 1건 저장됐으면 true 를 반환한다.
 * - 상태 변경 이벤트: 항상 저장.
 * - access-denied: 분산 throttle 통과 시에만 저장(통과/저장을 단일 트랜잭션으로 원자 처리).
 */
export async function recordSecurityAuditEvent(
  input: SecurityAuditEventInput,
): Promise<boolean> {
  try {
    if (input.eventType === ACCESS_DENIED) {
      const throttleKey = buildThrottleKey(input);

      // companyId/targetUserId 를 특정할 수 없으면 억지 추론하지 않고 기록 생략.
      if (!throttleKey) {
        return false;
      }

      return await recordThrottledAccessDenied(input, throttleKey);
    }

    await prisma.securityAuditEvent.create({ data: toEventData(input) });
    devLog(input, new Date().toISOString());
    return true;
  } catch {
    // audit 실패가 호출 API 응답을 바꾸지 않도록 무시.
    return false;
  }
}

/**
 * Postgres-native 원자 throttle: throttleKey 를 INSERT 하되, 이미 있으면 lastEmittedAt 이
 * cutoff 이전일 때만 conditional UPDATE. RETURNING 으로 "이번에 emit 허용" 여부를 판단한다.
 * 동시 요청은 유니크 인덱스에서 직렬화되어 정확히 1개만 RETURNING row 를 얻는다.
 * throttle 갱신과 이벤트 저장을 같은 트랜잭션으로 묶어 원자성을 보장한다.
 */
async function recordThrottledAccessDenied(
  input: SecurityAuditEventInput,
  throttleKey: string,
): Promise<boolean> {
  const throttleSeconds = getDenyThrottleSeconds();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + throttleSeconds * 1000);
  const cutoff = new Date(now.getTime() - throttleSeconds * 1000);

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      INSERT INTO "security_audit_throttles"
        ("id", "throttleKey", "eventType", "targetUserId", "companyId", "lastEmittedAt", "expiresAt", "createdAt", "updatedAt")
      VALUES
        (gen_random_uuid()::text, ${throttleKey}, ${input.eventType}::"SecurityAuditEventType",
         ${input.targetUserId ?? null}, ${input.companyId ?? null}, ${now}, ${expiresAt}, ${now}, ${now})
      ON CONFLICT ("throttleKey") DO UPDATE
        SET "lastEmittedAt" = ${now}, "expiresAt" = ${expiresAt}, "updatedAt" = ${now}
        WHERE "security_audit_throttles"."lastEmittedAt" < ${cutoff}
      RETURNING "id";
    `;

    // RETURNING row 가 없으면 window 내 중복 → 저장 생략(403 응답은 호출부에서 그대로 유지).
    if (rows.length === 0) {
      return false;
    }

    await tx.securityAuditEvent.create({ data: toEventData(input) });
    devLog(input, now.toISOString());
    return true;
  });
}
