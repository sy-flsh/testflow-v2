import { apiError, apiSuccess } from "@/lib/api/response";
import { readJsonBody, readTrimmedString } from "@/lib/api/request";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireRecentMasterAdminAuth,
} from "@/lib/auth/guards";
import { revokeMasterAdmin, runMasterAdminChange } from "@/lib/auth/master-admin-service";
import { recordSecurityAuditEvent } from "@/lib/security/audit-log";
import { enforceCsrfProtection } from "@/lib/security/csrf";
import {
  checkRateLimit,
  getClientIp,
  rateLimitErrorResponse,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ userId: string }> };

const CONFIRMATION_PHRASE = "MasterAdmin 권한을 해제합니다";
const CHANGE_WINDOW_MS = 10 * 60 * 1000;
const CHANGE_LIMIT = 10;

/**
 * c10-8: MasterAdmin 권한 해제. POST /api/admin/master-admins/{userId}/revoke
 * - requireRecentMasterAdminAuth(step-up) + CSRF + (actor+IP) rate-limit(grant 와 공유 scope).
 * - 확인 문구 정확 일치 아니면 400 MASTER_ADMIN_REVOKE_CONFIRMATION_REQUIRED.
 * - Serializable+retry tx 로 해제(isActive=false + 대상 모든 Session adminReauthenticatedAt=null).
 *   self/마지막 active master/inactive/미bound 차단. 성공 시 MASTER_ADMIN_REVOKED best-effort audit.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const csrfError = enforceCsrfProtection(request);
    if (csrfError) {
      return csrfError;
    }

    const { user: actor } = await requireRecentMasterAdminAuth();

    const limit = await checkRateLimit({
      scope: "admin:master-admin-change:actor",
      key: `${actor.id}:${getClientIp(request)}`,
      limit: CHANGE_LIMIT,
      windowMs: CHANGE_WINDOW_MS,
    });
    if (!limit.allowed) {
      return rateLimitErrorResponse(limit);
    }

    const { userId: targetUserId } = await context.params;
    const body = await readJsonBody(request);
    if (readTrimmedString(body.confirmation) !== CONFIRMATION_PHRASE) {
      return apiError(
        "MasterAdmin 권한을 해제하려면 ‘MasterAdmin 권한을 해제합니다’를 정확히 입력해 주세요.",
        400,
        "MASTER_ADMIN_REVOKE_CONFIRMATION_REQUIRED",
      );
    }

    const result = await runMasterAdminChange((tx) => revokeMasterAdmin(targetUserId, actor.id, tx));

    if (!result.changed) {
      switch (result.reason) {
        case "MASTER_NOT_FOUND":
          return apiError("대상 MasterAdmin 을 찾을 수 없습니다.", 404, "MASTER_ADMIN_NOT_FOUND");
        case "NOT_ACTIVE":
          return apiError("활성 상태의 MasterAdmin 권한만 해제할 수 있습니다.", 409, "MASTER_ADMIN_NOT_ACTIVE");
        case "SELF":
          return apiError("자기 MasterAdmin 권한은 직접 해제할 수 없습니다.", 409, "ADMIN_CANNOT_REVOKE_SELF");
        case "LAST_ACTIVE_MASTER":
          return apiError("마지막 활성 MasterAdmin 권한은 해제할 수 없습니다.", 409, "LAST_MASTER_ADMIN_REVOKE_FORBIDDEN");
        default:
          return apiError("MasterAdmin 권한 해제를 처리하지 못했습니다.", 409, "ADMIN_MASTER_REVOKE_FAILED");
      }
    }

    await recordSecurityAuditEvent({
      eventType: "MASTER_ADMIN_REVOKED",
      actorUserId: actor.id,
      targetUserId,
      guardName: "admin.master-admin.revoke",
    });

    return apiSuccess({ ok: true });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("MasterAdmin 권한 해제를 처리하지 못했습니다.", 500, "ADMIN_MASTER_REVOKE_INTERNAL_FAILED");
  }
}
