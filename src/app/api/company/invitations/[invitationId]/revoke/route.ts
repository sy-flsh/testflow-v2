import { apiError, apiSuccess } from "@/lib/api/response";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireCompanyOwner,
} from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { enforceCsrfProtection } from "@/lib/security/csrf";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ invitationId: string }>;
};

/**
 * c8-1: Company 초대 취소.
 * POST /api/company/invitations/{invitationId}/revoke
 * - CO 만 접근 + CSRF 보호. 현재 Company 초대만 취소 가능.
 * - PENDING 만 REVOKED 로 변경(raw token/Role snapshot 은 삭제하지 않고 상태만 변경).
 * - 만료된 PENDING 은 EXPIRED 로 정리 후 400. ACCEPTED/REVOKED/EXPIRED 는 400.
 * - 다른 Company/미존재 invitationId 는 404(존재 노출 최소화).
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const csrfError = enforceCsrfProtection(request);

    if (csrfError) {
      return csrfError;
    }

    const { companyId } = await requireCompanyOwner();
    const { invitationId } = await context.params;

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      select: { id: true, companyId: true, status: true, expiresAt: true },
    });

    // 다른 Company 또는 미존재 → 404 (존재 노출 최소화)
    if (!invitation || invitation.companyId !== companyId) {
      return apiError("초대를 찾을 수 없습니다.", 404, "INVITE_NOT_FOUND");
    }

    // 만료된 PENDING 은 EXPIRED 로 정리 후 취소 불가 처리(상태 정합성 유지).
    if (invitation.status === "PENDING" && invitation.expiresAt.getTime() < Date.now()) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });

      return apiError("이미 만료된 초대입니다.", 400, "INVITE_NOT_PENDING");
    }

    if (invitation.status !== "PENDING") {
      return apiError(
        "취소할 수 있는 상태(PENDING)의 초대가 아닙니다.",
        400,
        "INVITE_NOT_PENDING",
      );
    }

    const updated = await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "REVOKED", revokedAt: new Date() },
      select: { id: true, status: true },
    });

    return apiSuccess({ invitation: updated });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("초대 취소에 실패했습니다.", 500, "INVITE_REVOKE_FAILED");
  }
}
