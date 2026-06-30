import type { Prisma } from "@prisma/client";
import { getActiveMasterAdminEmails } from "@/lib/auth/master-admin";
import { getCompaniesWhereUserIsLastActiveCO } from "@/lib/company/company-user-state";
import { prisma } from "@/lib/db/prisma";

/** prisma 또는 트랜잭션 client. restore/force-delete helper 가 route 트랜잭션과 결합될 수 있게 한다. */
type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * c10-1: 전역 계정 탈퇴(soft delete) 공용 helper.
 *
 * - soft delete 는 User row 를 물리 삭제하지 않고 deletedAt 등 필드만 채운다.
 *   따라서 UserRole/WorkspaceMember/CompanyUserState/Invitation/SecurityAuditEvent 는 보존된다.
 * - 권한 검사는 이 모듈이 하지 않는다(호출부 guard 책임). restoreSoftDeletedUser 의 권한 경계는 함수 주석 참고.
 * - 이 모듈은 guards 를 import 하지 않는다(순환 방지). guards 가 이 모듈의 상수를 사용한다.
 */

export const USER_ACCOUNT_DELETED_CODE = "USER_ACCOUNT_DELETED";
export const USER_ACCOUNT_DELETED_MESSAGE =
  "탈퇴 처리된 계정입니다. 계정 복구가 필요한 경우 관리자에게 문의해 주세요.";

/** 탈퇴 사유 코드(자유 텍스트 미저장 — 코드 상수만 저장). */
export const DELETION_REASON = {
  SELF_WITHDRAWAL: "SELF_WITHDRAWAL", // c10-1 본인 탈퇴
  ADMIN_FORCED: "ADMIN_FORCED_DELETION", // c10-6 MasterAdmin 강제 정지
} as const;
export type DeletionReason = (typeof DELETION_REASON)[keyof typeof DELETION_REASON];

export type UserDeletionState = {
  deletedAt: Date | null;
  deletedByUserId: string | null;
  deletionReason: string | null;
};

/** 이미 로드된 user 객체로 soft-deleted 여부 판별(추가 쿼리 없음). */
export function isSoftDeleted(
  user: { deletedAt: Date | null } | null | undefined,
): boolean {
  return Boolean(user?.deletedAt);
}

/** userId 로 soft-deleted 여부 조회. */
export async function isUserSoftDeleted(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { deletedAt: true },
  });
  return Boolean(user?.deletedAt);
}

/** 탈퇴 상태 상세(없는 user 는 null). */
export async function getUserDeletionState(
  userId: string,
): Promise<UserDeletionState | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { deletedAt: true, deletedByUserId: true, deletionReason: true },
  });
  return user ?? null;
}

/**
 * c10-1/c10-2: soft-deleted 계정 복구의 **상태 전이 전용** service helper.
 *
 * 권한 경계: **이 helper 자체는 권한을 검사하지 않는다.** 반드시 MasterAdmin guard(requireMasterAdmin)
 * 를 통과한 route 에서만 호출한다(현재 유일 caller = `/api/admin/accounts/[userId]/restore`).
 *
 * 동작/계약:
 *  - deleted → active 전이만 수행: deletedAt/deletedByUserId/deletionReason = null.
 *  - **조건부 update(`deletedAt != null`)** 로 동시 복구 경쟁에서 단 1회만 전이(`restored:true`)되게 한다.
 *  - Session 은 조회/생성/삭제하지 않는다(사용자가 다시 login 해야 함).
 *  - CompanyUserState/UserRole/WorkspaceMember/Invitation 은 건드리지 않는다(보존).
 *  - **USER_RESTORED audit 는 여기서 남기지 않는다.** 실제 전이(`restored:true`)일 때만, route 가
 *    트랜잭션 성공 후 best-effort 로 1회 기록한다(audit 실패가 복구를 rollback 하지 않게 분리).
 *  - client 로 트랜잭션 client 를 받아 route 트랜잭션 안에서 "다시 확인 + 전이" 를 결합할 수 있다.
 *
 * @returns restored=true(전이됨) | { restored:false, reason:"NOT_FOUND" }(대상 없음)
 *          | { restored:false, reason:"NOT_DELETED" }(이미 active 또는 경쟁에서 패배).
 */
export async function restoreSoftDeletedUser(
  targetUserId: string,
  client: DbClient = prisma,
): Promise<{ restored: boolean; reason?: "NOT_FOUND" | "NOT_DELETED" }> {
  const user = await client.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, deletedAt: true },
  });

  if (!user) {
    return { restored: false, reason: "NOT_FOUND" };
  }
  if (!user.deletedAt) {
    return { restored: false, reason: "NOT_DELETED" };
  }

  const updated = await client.user.updateMany({
    where: { id: targetUserId, deletedAt: { not: null } },
    data: { deletedAt: null, deletedByUserId: null, deletionReason: null },
  });

  if (updated.count === 0) {
    // 다른 요청이 먼저 복구함(경쟁 패배) → 전이 없음.
    return { restored: false, reason: "NOT_DELETED" };
  }

  return { restored: true };
}

export type ForceDeleteBlockedReason =
  | "NOT_FOUND"
  | "NOT_ACTIVE"
  | "SELF"
  | "LAST_MASTER_ADMIN"
  | "LAST_ACTIVE_CO";

/**
 * c10-6: MasterAdmin 강제 계정 정지(전역 soft delete) **상태 전이 service helper**.
 *
 * 권한 경계: **권한 미검사** — 반드시 `requireRecentMasterAdminAuth`(step-up) 통과 route 에서만 호출.
 *
 * 차단 순서(모두 tx 내부 재검증): SELF → NOT_FOUND → NOT_ACTIVE → LAST_MASTER_ADMIN → LAST_ACTIVE_CO.
 * 통과 시 **조건부 update(`deletedAt=null`)** 로 동시 요청 중 1회만 전이 → 같은 tx 에서 대상 Session deleteMany.
 * (Session 삭제 실패 시 tx rollback → soft delete 도 취소.) UserRole/WorkspaceMember/CompanyUserState/
 * Invitation/기존 SecurityAuditEvent 는 보존(미변경). USER_SOFT_DELETED audit 는 helper 밖(route)에서
 * 실제 전이 1회에만 best-effort. 복구는 c10-2 restoreSoftDeletedUser.
 *
 * @returns { deleted:true } | { deleted:false, reason }
 */
export async function forceSoftDeleteUser(
  targetUserId: string,
  actorUserId: string,
  client: DbClient = prisma,
): Promise<{ deleted: true } | { deleted: false; reason: ForceDeleteBlockedReason }> {
  if (targetUserId === actorUserId) {
    return { deleted: false, reason: "SELF" };
  }

  const target = await client.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true, deletedAt: true },
  });
  if (!target) {
    return { deleted: false, reason: "NOT_FOUND" };
  }
  if (target.deletedAt) {
    return { deleted: false, reason: "NOT_ACTIVE" };
  }

  // 마지막 활성 MasterAdmin 보호.
  const activeMasterEmails = await getActiveMasterAdminEmails(client);
  if (activeMasterEmails.has(target.email) && activeMasterEmails.size === 1) {
    return { deleted: false, reason: "LAST_MASTER_ADMIN" };
  }

  // 마지막 ACTIVE CO 보호(c10-1.1 helper 재사용).
  const lastCoCompanies = await getCompaniesWhereUserIsLastActiveCO(client, targetUserId);
  if (lastCoCompanies.length > 0) {
    return { deleted: false, reason: "LAST_ACTIVE_CO" };
  }

  // 조건부 전이(동시 요청 중 1회만).
  const updated = await client.user.updateMany({
    where: { id: targetUserId, deletedAt: null },
    data: {
      deletedAt: new Date(),
      deletedByUserId: actorUserId,
      deletionReason: DELETION_REASON.ADMIN_FORCED,
    },
  });
  if (updated.count === 0) {
    return { deleted: false, reason: "NOT_ACTIVE" };
  }

  // 같은 tx 에서 대상 세션 즉시 무효화(실패 시 rollback).
  await client.session.deleteMany({ where: { userId: targetUserId } });

  return { deleted: true };
}
