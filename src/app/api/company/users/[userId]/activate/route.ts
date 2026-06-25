import { apiError, apiSuccess } from "@/lib/api/response";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireCompanyOwner,
} from "@/lib/auth/guards";
import { isUserInCompany } from "@/lib/company/company-user-state";
import { prisma } from "@/lib/db/prisma";
import { enforceCsrfProtection } from "@/lib/security/csrf";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

/**
 * c9-1: Company 사용자 재활성화.
 * POST /api/company/users/{userId}/activate  (CO 전용 + CSRF)
 *
 * - 현재 Company 범위 사용자만 대상(타 Company/미존재 → 404 USER_NOT_FOUND).
 * - CompanyUserState.status 만 ACTIVE 로 변경(UserRole/WorkspaceMember 는 그대로 재사용).
 * - 멱등: 이미 ACTIVE 면 no-op 성공(200, status ACTIVE). 보호 규칙은 없음(활성화는 안전).
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

    await prisma.companyUserState.upsert({
      where: { companyId_userId: { companyId, userId: targetUserId } },
      update: {
        status: "ACTIVE",
        reactivatedAt: new Date(),
        reactivatedByUserId: actor.id,
      },
      create: {
        companyId,
        userId: targetUserId,
        status: "ACTIVE",
        reactivatedAt: new Date(),
        reactivatedByUserId: actor.id,
      },
    });

    return apiSuccess({ userId: targetUserId, companyId, status: "ACTIVE" });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("사용자 활성화에 실패했습니다.", 500, "COMPANY_USER_ACTIVATE_FAILED");
  }
}
