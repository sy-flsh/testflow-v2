import { apiError, apiSuccess } from "@/lib/api/response";
import { readJsonBody, readTrimmedString } from "@/lib/api/request";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireRecentMasterAdminAuth,
} from "@/lib/auth/guards";
import { grantMasterAdmin, runMasterAdminChange } from "@/lib/auth/master-admin-service";
import { recordSecurityAuditEvent } from "@/lib/security/audit-log";
import { enforceCsrfProtection } from "@/lib/security/csrf";
import {
  checkRateLimit,
  getClientIp,
  rateLimitErrorResponse,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ userId: string }> };

const CONFIRMATION_PHRASE = "MasterAdmin 권한을 부여합니다";
const CHANGE_WINDOW_MS = 10 * 60 * 1000;
const CHANGE_LIMIT = 10;

/**
 * c10-8: MasterAdmin 권한 위임. POST /api/admin/master-admins/{userId}/grant
 * - requireRecentMasterAdminAuth(step-up) + CSRF + (actor+IP) rate-limit.
 * - 확인 문구 정확 일치 아니면 400 MASTER_ADMIN_GRANT_CONFIRMATION_REQUIRED.
 * - Serializable+retry tx 로 위임(userId bind/재활성화), 성공 시 MASTER_ADMIN_GRANTED best-effort audit.
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
        "MasterAdmin 권한을 부여하려면 ‘MasterAdmin 권한을 부여합니다’를 정확히 입력해 주세요.",
        400,
        "MASTER_ADMIN_GRANT_CONFIRMATION_REQUIRED",
      );
    }

    const result = await runMasterAdminChange((tx) => grantMasterAdmin(targetUserId, actor.id, tx));

    if (!result.changed) {
      switch (result.reason) {
        case "USER_NOT_FOUND":
          return apiError("대상 사용자를 찾을 수 없습니다.", 404, "USER_NOT_FOUND");
        case "USER_NOT_ACTIVE":
          return apiError("활성 상태의 사용자에게만 권한을 부여할 수 있습니다.", 409, "USER_ACCOUNT_NOT_ACTIVE");
        case "ALREADY_ACTIVE":
          return apiError("이미 활성 MasterAdmin 권한을 가진 사용자입니다.", 409, "USER_ALREADY_MASTER_ADMIN");
        case "LEGACY_BINDING_REQUIRED":
          return apiError("기존 MasterAdmin 레코드의 사용자 연결 확인이 필요합니다.", 409, "MASTER_ADMIN_LEGACY_BINDING_REQUIRED");
        default:
          return apiError("MasterAdmin 권한 부여를 처리하지 못했습니다.", 409, "ADMIN_MASTER_GRANT_FAILED");
      }
    }

    await recordSecurityAuditEvent({
      eventType: "MASTER_ADMIN_GRANTED",
      actorUserId: actor.id,
      targetUserId,
      guardName: "admin.master-admin.grant",
    });

    return apiSuccess({ ok: true });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("MasterAdmin 권한 부여를 처리하지 못했습니다.", 500, "ADMIN_MASTER_GRANT_INTERNAL_FAILED");
  }
}
