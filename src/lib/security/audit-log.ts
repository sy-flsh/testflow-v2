/**
 * c9-5: 구조화된 security audit 로그 abstraction.
 *
 * 현재 프로젝트에는 영속 audit/activity 모델이 없으므로(스키마/마이그레이션 추가 금지),
 * production 외부 로그 수집기로 전달 가능한 **JSON structured log** 형태로만 emit 한다.
 * c9-6 에서 영속 테이블 도입 시 이 abstraction 의 호출부는 그대로 두고 sink 만 교체하면 된다.
 *
 * 민감정보(raw token / password / cookie / inviteUrl / 전체 request body)는 절대 기록하지 않는다.
 * 기록 실패가 API 차단/정상 응답을 바꾸지 않도록 모든 경로를 예외 격리한다(fire-and-forget).
 *
 * 주의(throttle 한계): INACTIVE_COMPANY_ACCESS_DENIED 의 중복 억제는 **in-memory best-effort** 라
 * multi-instance(수평 확장) 환경에서는 인스턴스마다 별도 카운트가 되어 완전한 보장이 아니다.
 * 영속/분산 throttle 은 c9-6 영속 audit 설계에서 다룬다.
 */

export type SecurityAuditEventType =
  | "COMPANY_USER_DEACTIVATED"
  | "COMPANY_USER_REACTIVATED"
  | "INACTIVE_COMPANY_ACCESS_DENIED";

export type SecurityAuditEventInput = {
  eventType: SecurityAuditEventType;
  actorUserId?: string;
  targetUserId?: string;
  companyId?: string;
  guardName?: string;
};

export type SecurityAuditEvent = SecurityAuditEventInput & {
  occurredAt: string;
};

/** 입력 → 표준 이벤트(occurredAt 부착, undefined 필드 제거). 민감 필드는 형식상 받지 않는다. */
export function buildSecurityAuditEvent(input: SecurityAuditEventInput): SecurityAuditEvent {
  const event: SecurityAuditEvent = {
    eventType: input.eventType,
    occurredAt: new Date().toISOString(),
  };

  if (input.actorUserId) event.actorUserId = input.actorUserId;
  if (input.targetUserId) event.targetUserId = input.targetUserId;
  if (input.companyId) event.companyId = input.companyId;
  if (input.guardName) event.guardName = input.guardName;

  return event;
}

// --- INACTIVE_COMPANY_ACCESS_DENIED 중복 억제 (in-memory best-effort) ---
const ACCESS_DENIED_THROTTLE_MS = 5 * 60 * 1000; // 5분
const lastLoggedAtByKey = new Map<string, number>();

function accessDeniedKey(event: SecurityAuditEvent): string {
  return `${event.eventType}:${event.targetUserId ?? "?"}:${event.companyId ?? "?"}`;
}

/** 같은 (event, user, company) 조합을 5분 내 1회만 기록하도록 판단(기록 가능하면 true). */
export function shouldRecordAccessDenied(key: string, now: number): boolean {
  const last = lastLoggedAtByKey.get(key);

  if (last !== undefined && now - last < ACCESS_DENIED_THROTTLE_MS) {
    return false;
  }

  lastLoggedAtByKey.set(key, now);

  // Map 무한 증가 방지: 임계 초과 시 만료 키 정리.
  if (lastLoggedAtByKey.size > 1000) {
    for (const [k, t] of lastLoggedAtByKey) {
      if (now - t >= ACCESS_DENIED_THROTTLE_MS) {
        lastLoggedAtByKey.delete(k);
      }
    }
  }

  return true;
}

function emit(event: SecurityAuditEvent): void {
  // 외부 수집기 친화적 단일 라인 JSON. (sink 교체 지점 — c9-6 에서 영속화)
  console.info(`[security-audit] ${JSON.stringify(event)}`);
}

/**
 * 감사 이벤트 기록(fire-and-forget). 절대 throw 하지 않는다.
 * access-denied 는 throttle 후 emit, 그 외(상태 변경)는 항상 emit.
 */
export function recordSecurityAuditEvent(input: SecurityAuditEventInput): void {
  try {
    const event = buildSecurityAuditEvent(input);

    if (event.eventType === "INACTIVE_COMPANY_ACCESS_DENIED") {
      if (!shouldRecordAccessDenied(accessDeniedKey(event), Date.now())) {
        return;
      }
    }

    emit(event);
  } catch {
    // 로깅 실패가 호출부(API 차단/정상 응답)에 영향 주지 않도록 무시.
  }
}
