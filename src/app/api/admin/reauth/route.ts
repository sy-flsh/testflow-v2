import { apiError, apiSuccess } from "@/lib/api/response";
import { readJsonBody } from "@/lib/api/request";
import { ADMIN_REAUTH_TTL_MS, refreshAdminReauthentication } from "@/lib/auth/admin-reauth";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireMasterAdmin,
} from "@/lib/auth/guards";
import { verifyPassword } from "@/lib/auth/password";
import { getCurrentSession } from "@/lib/auth/session";
import { enforceCsrfProtection } from "@/lib/security/csrf";
import {
  checkRateLimit,
  getClientIp,
  rateLimitErrorResponse,
  resetRateLimit,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const REAUTH_WINDOW_MS = 10 * 60 * 1000;
const REAUTH_FAIL_LIMIT = 5;

/**
 * c10-5: MasterAdmin step-up 재인증.
 * POST /api/admin/reauth  body: { password }  → { ok, expiresAt }
 *
 * - requireMasterAdmin(401/USER_ACCOUNT_DELETED/AUTH_FORBIDDEN) + CSRF.
 * - **현재 로그인 User 의 passwordHash** 로 검증한다(MasterAdmin record 의 passwordHash 사용 안 함).
 * - 성공 시 현재 Session 의 adminReauthenticatedAt 만 now 로 갱신(새 Session/cookie/token 변경 없음,
 *   다른 Session·UserRole/WorkspaceMember/CompanyUserState 불변, SecurityAuditEvent 미생성).
 * - 실패는 (IP+userId) 기준 rate-limit(10분 5회). 정상 admin API 에는 별도 limit 미적용.
 */
export async function POST(request: Request) {
  try {
    const csrfError = enforceCsrfProtection(request);
    if (csrfError) {
      return csrfError;
    }

    const { user } = await requireMasterAdmin();

    const session = await getCurrentSession();
    if (!session) {
      return apiError("로그인이 필요합니다.", 401, "AUTH_UNAUTHORIZED");
    }

    const body = await readJsonBody(request);
    const password = (body as { password?: unknown }).password;
    if (typeof password !== "string" || password.length === 0) {
      return apiError(
        "관리자 인증을 위해 비밀번호를 입력해 주세요.",
        400,
        "ADMIN_REAUTH_PASSWORD_REQUIRED",
      );
    }

    const failKey = `${getClientIp(request)}:${user.id}`;

    if (!user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      const fail = await checkRateLimit({
        scope: "admin:reauth:fail",
        key: failKey,
        limit: REAUTH_FAIL_LIMIT,
        windowMs: REAUTH_WINDOW_MS,
      });
      if (!fail.allowed) {
        return rateLimitErrorResponse(fail);
      }
      return apiError("관리자 인증에 실패했습니다.", 401, "ADMIN_REAUTH_FAILED");
    }

    await resetRateLimit({ scope: "admin:reauth:fail", key: failKey });
    const now = await refreshAdminReauthentication(session.id);

    return apiSuccess({
      ok: true,
      expiresAt: new Date(now.getTime() + ADMIN_REAUTH_TTL_MS).toISOString(),
    });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("관리자 인증을 처리하지 못했습니다.", 500, "ADMIN_REAUTH_INTERNAL_FAILED");
  }
}
