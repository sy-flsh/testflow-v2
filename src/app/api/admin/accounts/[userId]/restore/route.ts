import { apiError, apiSuccess } from "@/lib/api/response";
import { restoreSoftDeletedUser } from "@/lib/auth/account";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireMasterAdmin,
} from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { recordSecurityAuditEvent } from "@/lib/security/audit-log";
import { enforceCsrfProtection } from "@/lib/security/csrf";
import {
  checkRateLimit,
  getClientIp,
  rateLimitErrorResponse,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

const RESTORE_WINDOW_MS = 10 * 60 * 1000;
const RESTORE_IP_LIMIT = 30;

/**
 * c10-2: MasterAdmin 탈퇴 계정 복구.
 * POST /api/admin/accounts/{userId}/restore  (MasterAdmin 전용 + CSRF)
 *
 * - requireMasterAdmin: 비로그인 401, 탈퇴 계정 403 USER_ACCOUNT_DELETED, 비-MasterAdmin 403 AUTH_FORBIDDEN.
 * - 대상 없음 404 USER_NOT_FOUND, 이미 active 409 USER_ACCOUNT_NOT_DELETED.
 * - 복구는 deleted→active 전이만. Session 미생성, UserRole/WorkspaceMember/CompanyUserState/Invitation 불변.
 * - 동시 복구는 조건부 update 로 한 번만 전이(`restored:true`) → 나머지는 409.
 * - USER_RESTORED audit(actor=MasterAdmin, companyId=null, guard admin.account.restore)는 전이 1회에만 best-effort.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const csrfError = enforceCsrfProtection(request);
    if (csrfError) {
      return csrfError;
    }

    const { user: actor } = await requireMasterAdmin();

    const ipLimit = await checkRateLimit({
      scope: "admin:account-restore:ip",
      key: getClientIp(request),
      limit: RESTORE_IP_LIMIT,
      windowMs: RESTORE_WINDOW_MS,
    });
    if (!ipLimit.allowed) {
      return rateLimitErrorResponse(ipLimit);
    }

    const { userId: targetUserId } = await context.params;

    // 트랜잭션 안에서 "다시 확인 + 조건부 전이" 를 결합(동시 복구 안전).
    const result = await prisma.$transaction((tx) => restoreSoftDeletedUser(targetUserId, tx));

    if (!result.restored) {
      if (result.reason === "NOT_FOUND") {
        return apiError("대상 사용자를 찾을 수 없습니다.", 404, "USER_NOT_FOUND");
      }
      // NOT_DELETED: 이미 active 이거나 동시 복구 경쟁에서 패배.
      return apiError("탈퇴 처리된 계정만 복구할 수 있습니다.", 409, "USER_ACCOUNT_NOT_DELETED");
    }

    // 실제 전이 1회에만 best-effort audit. 실패해도 복구 결과(rollback) 영향 없음.
    await recordSecurityAuditEvent({
      eventType: "USER_RESTORED",
      actorUserId: actor.id,
      targetUserId,
      guardName: "admin.account.restore",
    });

    return apiSuccess({ ok: true });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("계정 복구를 처리하지 못했습니다.", 500, "ADMIN_ACCOUNT_RESTORE_FAILED");
  }
}
