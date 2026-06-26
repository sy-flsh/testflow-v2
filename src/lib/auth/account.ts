import { prisma } from "@/lib/db/prisma";
import { recordSecurityAuditEvent } from "@/lib/security/audit-log";

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
  SELF_WITHDRAWAL: "SELF_WITHDRAWAL",
  MASTER_FORCED: "MASTER_FORCED",
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
 * c10-1: MasterAdmin 전용 복구 기반 service helper.
 *
 * 권한 경계: **이 helper 자체는 권한을 검사하지 않는다.** 반드시 MasterAdmin guard 를 통과한
 * 내부 route/service 에서만 호출해야 한다. 이번 단계에서는 이 helper 를 호출하는 public
 * endpoint/UI 를 만들지 않는다(향후 c10-2 에서 MasterAdmin guard + CSRF + 테스트와 함께 노출).
 *
 * 복구 동작:
 *  - deletedAt/deletedByUserId/deletionReason = null
 *  - 기존 Session 은 자동 복구하지 않는다(사용자가 다시 로그인해야 한다).
 *  - CompanyUserState/UserRole/WorkspaceMember 는 그대로 보존(건드리지 않음).
 *  - USER_RESTORED audit event 는 best-effort(실패해도 복구 성공에 영향 없음, companyId=null).
 *
 * @returns restored=false 면 대상이 없거나 이미 활성(복구 불필요) 상태.
 */
export async function restoreSoftDeletedUser(
  targetUserId: string,
  actorUserId: string,
): Promise<{ restored: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, deletedAt: true },
  });

  if (!user || !user.deletedAt) {
    return { restored: false };
  }

  await prisma.user.update({
    where: { id: targetUserId },
    data: { deletedAt: null, deletedByUserId: null, deletionReason: null },
  });

  // best-effort global account lifecycle audit. recordSecurityAuditEvent 는 throw 하지 않는다.
  await recordSecurityAuditEvent({
    eventType: "USER_RESTORED",
    actorUserId,
    targetUserId,
    guardName: "account.restore",
  });

  return { restored: true };
}
