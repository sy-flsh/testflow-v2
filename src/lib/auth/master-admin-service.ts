import { Prisma } from "@prisma/client";
import { getActiveMasterAdminUserIds } from "@/lib/auth/master-admin";
import { prisma } from "@/lib/db/prisma";

type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * c10-8: MasterAdmin 권한 위임(grant)/해제(revoke) **상태 전이 service**.
 *
 * 권한 경계: **권한 미검사** — 반드시 `requireRecentMasterAdminAuth`(step-up) 통과 route 에서만 호출.
 * 식별은 c10-7 대로 `MasterAdmin.userId(=User.id)` binding 기준(email fallback 없음).
 * audit(MASTER_ADMIN_GRANTED/REVOKED)는 helper 밖(route)에서 실제 전이 1회에만 best-effort.
 */

export type GrantBlockedReason =
  | "USER_NOT_FOUND"
  | "USER_NOT_ACTIVE"
  | "ALREADY_ACTIVE"
  | "LEGACY_BINDING_REQUIRED";

export type RevokeBlockedReason =
  | "MASTER_NOT_FOUND"
  | "NOT_ACTIVE"
  | "SELF"
  | "LAST_ACTIVE_MASTER";

/**
 * 동시 grant/revoke 로 **활성 MasterAdmin 수가 0 이 되지 않도록** Serializable + retry 로 감싼다.
 * (서로 다른 master 를 동시에 해제 → 둘 다 master-set 을 predicate-read 하므로 직렬화 충돌 → 한쪽 retry →
 *  retry 에서 마지막 1명 남으면 LAST_ACTIVE_MASTER 로 차단.)
 */
/** 직렬화 충돌/데드락(재시도 가능) 여부. Prisma code(P2034) + pg adapter raw(40001/40P01)/메시지 모두 커버. */
function isRetryableSerializationError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2034" || error.code === "P2037") {
      return true;
    }
  }
  const e = error as { code?: unknown; message?: unknown } | null;
  const code = typeof e?.code === "string" ? e.code : "";
  if (code === "40001" || code === "40P01") {
    return true;
  }
  const message = typeof e?.message === "string" ? e.message : "";
  return /could not serialize|serialization failure|deadlock detected|write conflict|transaction.+(retry|conflict)/i.test(
    message,
  );
}

/** 모든 MasterAdmin grant/revoke 가 잡는 전역 advisory xact lock key(임의 고정 상수). */
const MASTER_ADMIN_LOCK_SQL = "SELECT pg_advisory_xact_lock(91081080)";

export async function runMasterAdminChange<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  maxAttempts = 6,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          // 전역 직렬화: pg advisory xact lock 으로 동시 grant/revoke 를 순차 처리한다.
          // (driver adapter 의 isolation 적용 여부와 무관하게 "마지막 active master 0" 경쟁을 막는다.
          //  뒤 요청은 앞 요청 commit 까지 대기 → 갱신된 master 집합을 읽고 LAST_ACTIVE_MASTER 판정.)
          await tx.$executeRawUnsafe(MASTER_ADMIN_LOCK_SQL);
          return fn(tx);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (attempt < maxAttempts && isRetryableSerializationError(error)) {
        continue;
      }
      throw error;
    }
  }
}

/**
 * MasterAdmin 권한 위임. target 활성 User 에 userId-bound MasterAdmin 을 보장한다.
 * - inactive bound row 는 재활성화(새 row 중복 생성 안 함).
 * - 이미 active 면 ALREADY_ACTIVE.
 * - email 충돌 unbound/타-bound legacy row 가 있으면 fail-closed(LEGACY_BINDING_REQUIRED).
 * - target 의 role/state/invitation/session 은 변경하지 않는다. step-up elevation 도 자동 부여 안 함.
 */
export async function grantMasterAdmin(
  targetUserId: string,
  _actorUserId: string,
  client: DbClient = prisma,
): Promise<{ changed: true; masterAdminId: string } | { changed: false; reason: GrantBlockedReason }> {
  const target = await client.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true, name: true, passwordHash: true, deletedAt: true },
  });
  if (!target) {
    return { changed: false, reason: "USER_NOT_FOUND" };
  }
  if (target.deletedAt) {
    return { changed: false, reason: "USER_NOT_ACTIVE" };
  }

  const existing = await client.masterAdmin.findUnique({
    where: { userId: targetUserId },
    select: { id: true, isActive: true },
  });

  if (existing) {
    if (existing.isActive) {
      return { changed: false, reason: "ALREADY_ACTIVE" };
    }
    // inactive bound row 재활성화(조건부 — 동시 grant 경쟁에서 1회만).
    const reactivated = await client.masterAdmin.updateMany({
      where: { userId: targetUserId, isActive: false },
      data: { isActive: true },
    });
    if (reactivated.count === 0) {
      return { changed: false, reason: "ALREADY_ACTIVE" };
    }
    return { changed: true, masterAdminId: existing.id };
  }

  // 신규 bind: email 은 unique. 같은 email 의 다른 row(unbound legacy 또는 타 user bound)면 fail-closed.
  const emailConflict = await client.masterAdmin.findUnique({
    where: { email: target.email },
    select: { id: true },
  });
  if (emailConflict) {
    return { changed: false, reason: "LEGACY_BINDING_REQUIRED" };
  }

  // legacy email/name/passwordHash 는 초기값만 채운다(인증에 사용되지 않음).
  const created = await client.masterAdmin.create({
    data: {
      userId: targetUserId,
      email: target.email,
      name: target.name,
      passwordHash: target.passwordHash ?? "",
      isActive: true,
    },
    select: { id: true },
  });
  return { changed: true, masterAdminId: created.id };
}

/**
 * MasterAdmin 권한 해제. userId-bound active MasterAdmin 만 대상.
 * - self / 마지막 active master / inactive / 미존재(unbound) 차단.
 * - 성공 시 isActive=false + 대상 모든 Session 의 adminReauthenticatedAt=null(step-up 즉시 무효화).
 * - User soft delete/일반 Session 삭제/role/state/invitation 변경하지 않는다.
 */
export async function revokeMasterAdmin(
  targetUserId: string,
  actorUserId: string,
  client: DbClient = prisma,
): Promise<{ changed: true } | { changed: false; reason: RevokeBlockedReason }> {
  if (targetUserId === actorUserId) {
    return { changed: false, reason: "SELF" };
  }

  const master = await client.masterAdmin.findUnique({
    where: { userId: targetUserId },
    select: { id: true, isActive: true },
  });
  if (!master) {
    return { changed: false, reason: "MASTER_NOT_FOUND" };
  }
  if (!master.isActive) {
    return { changed: false, reason: "NOT_ACTIVE" };
  }

  // 마지막 active bound master 보호(soft-deleted master 는 active 집계에서 제외 — c10-7 기준).
  const activeIds = await getActiveMasterAdminUserIds(client);
  if (activeIds.has(targetUserId) && activeIds.size === 1) {
    return { changed: false, reason: "LAST_ACTIVE_MASTER" };
  }

  const revoked = await client.masterAdmin.updateMany({
    where: { userId: targetUserId, isActive: true },
    data: { isActive: false },
  });
  if (revoked.count === 0) {
    return { changed: false, reason: "NOT_ACTIVE" };
  }

  // 기존 step-up elevation 즉시 무효화(세션 자체는 보존).
  await client.session.updateMany({
    where: { userId: targetUserId },
    data: { adminReauthenticatedAt: null },
  });

  return { changed: true };
}

/** c10-9: legacy(userId=null) MasterAdmin 수동 연결 차단 사유. */
export type LegacyBindBlockedReason =
  | "LEGACY_NOT_FOUND"
  | "ALREADY_BOUND"
  | "USER_NOT_FOUND"
  | "USER_NOT_ACTIVE"
  | "USER_ALREADY_BOUND";

/**
 * c10-9: userId=null 인 legacy MasterAdmin 레코드를 **명시 선택된 활성 User** 에 수동 연결(bind)한다.
 *
 * 강한 제약(기존 기능 영향 금지):
 * - email/name fallback·자동 bind 없음 — target 은 호출자가 명시한 `targetUserId` 뿐.
 * - bind 이후 target User 의 role/state/session·admin 승격을 **일절 자동 수행하지 않는다**.
 *   (isActive 그대로 보존 — 권한 인정 여부는 c10-7 fail-closed/active 집계가 그대로 판정.)
 * - legacy email/name/passwordHash 등 기존 컬럼은 그대로 보존(덮어쓰지 않는다).
 * - 동시성: 반드시 `runMasterAdminChange`(Serializable + advisory xact lock) 내부에서 호출.
 *   conditional updateMany(where userId IS NULL) count=0 → 경쟁에서 이미 연결됨(ALREADY_BOUND).
 *
 * 권한 미검사 — `requireRecentMasterAdminAuth`(step-up) 통과 route 에서만 호출.
 * audit(MASTER_ADMIN_LEGACY_BOUND)는 helper 밖(route)에서 실제 전이 1회에만 best-effort.
 */
export async function bindLegacyMasterAdmin(
  masterAdminId: string,
  targetUserId: string,
  _actorUserId: string,
  client: DbClient = prisma,
): Promise<{ changed: true } | { changed: false; reason: LegacyBindBlockedReason }> {
  // 1) legacy 레코드 재검증(잠금 안에서 최신 상태로).
  const legacy = await client.masterAdmin.findUnique({
    where: { id: masterAdminId },
    select: { id: true, userId: true },
  });
  if (!legacy) {
    return { changed: false, reason: "LEGACY_NOT_FOUND" };
  }
  if (legacy.userId !== null) {
    return { changed: false, reason: "ALREADY_BOUND" };
  }

  // 2) target User 검증 — 명시 선택만(email 매칭/추론 없음).
  const target = await client.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, deletedAt: true },
  });
  if (!target) {
    return { changed: false, reason: "USER_NOT_FOUND" };
  }
  if (target.deletedAt) {
    return { changed: false, reason: "USER_NOT_ACTIVE" };
  }

  // 3) target 이 이미 다른 MasterAdmin 레코드에 연결되어 있으면 차단(userId @unique 보호).
  const userBound = await client.masterAdmin.findUnique({
    where: { userId: targetUserId },
    select: { id: true },
  });
  if (userBound) {
    return { changed: false, reason: "USER_ALREADY_BOUND" };
  }

  // 4) conditional update — userId IS NULL 인 동안만 단일 승자. isActive/legacy 컬럼은 보존.
  const bound = await client.masterAdmin.updateMany({
    where: { id: masterAdminId, userId: null },
    data: { userId: targetUserId },
  });
  if (bound.count === 0) {
    return { changed: false, reason: "ALREADY_BOUND" };
  }

  return { changed: true };
}
