import { Prisma } from "@prisma/client";
import { apiError, apiSuccess } from "@/lib/api/response";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireCompanyOwner,
} from "@/lib/auth/guards";
import { isUserInCompany } from "@/lib/company/company-user-state";
import { prisma } from "@/lib/db/prisma";
import { recordSecurityAuditEvent } from "@/lib/security/audit-log";
import { enforceCsrfProtection } from "@/lib/security/csrf";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

/** 트랜잭션 내부 보호 검사 실패를 응답으로 매핑하기 위한 에러(롤백 보장). */
class StateProtectionError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "StateProtectionError";
  }
}

/**
 * c9-1: Company 사용자 비활성화.
 * POST /api/company/users/{userId}/deactivate  (CO 전용 + CSRF)
 *
 * - 현재 Company 범위 사용자만 대상(타 Company/미존재 → 404 USER_NOT_FOUND).
 * - 보호 순서(트랜잭션 내부): ① 마지막 ACTIVE CO 비활성 금지(USER_LAST_CO_DEACTIVATE_FORBIDDEN,
 *   "마지막 CO" 는 ACTIVE CompanyUserState 기준) → ② 본인 비활성 금지(USER_SELF_DEACTIVATE_FORBIDDEN).
 *   sole-CO 가 본인을 비활성하려 하면 "마지막 CO" 가 더 구체적 사유이므로 LAST_CO 가 우선한다.
 *   (2명 이상 CO 중 본인 비활성은 마지막이 아니므로 SELF 가 적용된다.)
 * - UserRole/WorkspaceMember 는 삭제하지 않고 CompanyUserState.status 만 INACTIVE 로 변경.
 * - 멱등: 이미 INACTIVE 면 no-op 성공(200, status INACTIVE).
 * - isolation=Serializable: 마지막 CO 동시성(두 CO 가 서로/마지막 CO 를 동시 비활성)에서
 *   ACTIVE CO 수 검사와 상태 변경을 일관되게 보장한다(sync API 와 동일 근거).
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const csrfError = enforceCsrfProtection(request);

    if (csrfError) {
      return csrfError;
    }

    const { user: actor, companyId } = await requireCompanyOwner();
    const { userId: targetUserId } = await context.params;

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });

    if (!target || !(await isUserInCompany(companyId, targetUserId))) {
      return apiError("대상 사용자를 찾을 수 없습니다.", 404, "USER_NOT_FOUND");
    }

    let result: { status: "INACTIVE"; changed: boolean };

    try {
      result = await prisma.$transaction(
        async (tx) => {
          const current = await tx.companyUserState.findUnique({
            where: { companyId_userId: { companyId, userId: targetUserId } },
            select: { status: true },
          });

          if (current?.status === "INACTIVE") {
            // 멱등: 이미 비활성 → no-op(감사 시각/actor 미변경).
            return { status: "INACTIVE" as const, changed: false };
          }

          // 마지막 ACTIVE CO 보호: 대상이 ACTIVE CO 이고 ACTIVE CO 가 1명뿐이면 차단.
          const cos = await tx.userRole.findMany({
            where: { scopeType: "COMPANY", scopeId: companyId, role: "CO" },
            select: { userId: true },
          });
          const coIds = cos.map((co) => co.userId);

          if (coIds.includes(targetUserId)) {
            const inactiveStates = await tx.companyUserState.findMany({
              where: { companyId, userId: { in: coIds }, status: "INACTIVE" },
              select: { userId: true },
            });
            const inactiveSet = new Set(inactiveStates.map((s) => s.userId));
            const activeCoCount = coIds.filter((id) => !inactiveSet.has(id)).length;

            // 대상은 현재 ACTIVE(위에서 INACTIVE 면 이미 반환). ACTIVE CO 가 1명뿐이면 마지막 CO.
            if (activeCoCount <= 1) {
              throw new StateProtectionError(
                "Company 의 마지막 활성 CO 는 비활성화할 수 없습니다.",
                400,
                "USER_LAST_CO_DEACTIVATE_FORBIDDEN",
              );
            }
          }

          // 본인 비활성 금지(마지막 CO 가 아닌 경우의 본인 비활성).
          if (actor.id === targetUserId) {
            throw new StateProtectionError(
              "본인을 비활성화할 수 없습니다.",
              400,
              "USER_SELF_DEACTIVATE_FORBIDDEN",
            );
          }

          await tx.companyUserState.upsert({
            where: { companyId_userId: { companyId, userId: targetUserId } },
            update: {
              status: "INACTIVE",
              deactivatedAt: new Date(),
              deactivatedByUserId: actor.id,
            },
            create: {
              companyId,
              userId: targetUserId,
              status: "INACTIVE",
              deactivatedAt: new Date(),
              deactivatedByUserId: actor.id,
            },
          });

          return { status: "INACTIVE" as const, changed: true };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof StateProtectionError) {
        return apiError(error.message, error.status, error.code);
      }

      throw error;
    }

    // c9-5: 실제 전이(ACTIVE→INACTIVE)일 때만 감사 이벤트 기록(fire-and-forget).
    if (result.changed) {
      recordSecurityAuditEvent({
        eventType: "COMPANY_USER_DEACTIVATED",
        actorUserId: actor.id,
        targetUserId,
        companyId,
        guardName: "company.users.deactivate",
      });
    }

    return apiSuccess({ userId: targetUserId, companyId, status: result.status });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("사용자 비활성화에 실패했습니다.", 500, "COMPANY_USER_DEACTIVATE_FAILED");
  }
}
