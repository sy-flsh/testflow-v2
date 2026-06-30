import { apiError, apiSuccess } from "@/lib/api/response";
import {
  getAdminReauthExpiresAt,
  isAdminReauthValid,
} from "@/lib/auth/admin-reauth";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireMasterAdmin,
} from "@/lib/auth/guards";
import { getCurrentSession } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * c10-5: 현재 Session 의 admin step-up elevation 상태 조회(UX 표시용).
 * GET /api/admin/reauth/status  → { elevated, expiresAt }
 *
 * - requireMasterAdmin 만 요구(recent elevation 불요). 401/USER_ACCOUNT_DELETED/AUTH_FORBIDDEN 우선순위 유지.
 * - expiresAt 은 표시용일 뿐, 실제 권한 판단은 protected route 의 guard 가 최종으로 한다.
 * - passwordHash/sessionId/token 등 민감정보는 반환하지 않는다.
 */
export async function GET() {
  try {
    await requireMasterAdmin();

    const session = await getCurrentSession();
    if (!session) {
      return apiError("로그인이 필요합니다.", 401, "AUTH_UNAUTHORIZED");
    }

    const elevated = isAdminReauthValid(session);
    const expiresAt = elevated ? getAdminReauthExpiresAt(session)?.toISOString() ?? null : null;

    return apiSuccess({ elevated, expiresAt });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("관리자 인증 상태를 확인하지 못했습니다.", 500, "ADMIN_REAUTH_STATUS_FAILED");
  }
}
