import { apiError, apiSuccess } from "@/lib/api/response";
import { readJsonBody, readTrimmedString } from "@/lib/api/request";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireRecentMasterAdminAuth,
} from "@/lib/auth/guards";
import { bindLegacyMasterAdmin, runMasterAdminChange } from "@/lib/auth/master-admin-service";
import { recordSecurityAuditEvent } from "@/lib/security/audit-log";
import { enforceCsrfProtection } from "@/lib/security/csrf";
import {
  checkRateLimit,
  getClientIp,
  rateLimitErrorResponse,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ masterAdminId: string }> };

const CONFIRMATION_PHRASE = "기존 MasterAdmin 레코드를 연결합니다";
const CHANGE_WINDOW_MS = 10 * 60 * 1000;
const CHANGE_LIMIT = 10;

/**
 * c10-9: legacy(userId=null) MasterAdmin 레코드를 **명시 선택된 활성 User** 에 수동 연결.
 * POST /api/admin/master-admins/legacy-unbound/{masterAdminId}/bind  body: { userId, confirmation }
 *
 * - requireRecentMasterAdminAuth(step-up) + CSRF + (actor+IP) rate-limit.
 * - 확인 문구 정확 일치 아니면 400 MASTER_ADMIN_LEGACY_BIND_CONFIRMATION_REQUIRED.
 * - email fallback/자동 bind 없음. bind 후 target role/state/session·admin 승격 자동 수행 안 함.
 * - Serializable + advisory xact lock(runMasterAdminChange) tx 로 단일 승자 연결.
 * - 성공(실제 전이 1회) 시 MASTER_ADMIN_LEGACY_BOUND best-effort audit(actor=master, target=선택 User, companyId=null).
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

    const { masterAdminId } = await context.params;
    const body = await readJsonBody(request);
    const targetUserId = readTrimmedString(body.userId);
    if (!targetUserId) {
      return apiError("연결할 사용자를 선택해 주세요.", 400, "USER_ID_REQUIRED");
    }
    if (readTrimmedString(body.confirmation) !== CONFIRMATION_PHRASE) {
      return apiError(
        "기존 MasterAdmin 레코드를 연결하려면 ‘기존 MasterAdmin 레코드를 연결합니다’를 정확히 입력해 주세요.",
        400,
        "MASTER_ADMIN_LEGACY_BIND_CONFIRMATION_REQUIRED",
      );
    }

    const result = await runMasterAdminChange((tx) =>
      bindLegacyMasterAdmin(masterAdminId, targetUserId, actor.id, tx),
    );

    if (!result.changed) {
      switch (result.reason) {
        case "LEGACY_NOT_FOUND":
          return apiError("연결할 MasterAdmin 레코드를 찾을 수 없습니다.", 404, "MASTER_ADMIN_LEGACY_NOT_FOUND");
        case "ALREADY_BOUND":
          return apiError("이미 사용자 연결이 완료된 MasterAdmin 레코드입니다.", 409, "MASTER_ADMIN_ALREADY_BOUND");
        case "USER_NOT_FOUND":
          return apiError("대상 사용자를 찾을 수 없습니다.", 404, "USER_NOT_FOUND");
        case "USER_NOT_ACTIVE":
          return apiError("활성 상태의 사용자에게만 연결할 수 있습니다.", 409, "USER_ACCOUNT_NOT_ACTIVE");
        case "USER_ALREADY_BOUND":
          return apiError(
            "선택한 사용자는 이미 MasterAdmin 레코드에 연결되어 있습니다.",
            409,
            "USER_ALREADY_BOUND_MASTER_ADMIN",
          );
        default:
          return apiError("MasterAdmin 레코드 연결을 처리하지 못했습니다.", 409, "ADMIN_MASTER_LEGACY_BIND_FAILED");
      }
    }

    await recordSecurityAuditEvent({
      eventType: "MASTER_ADMIN_LEGACY_BOUND",
      actorUserId: actor.id,
      targetUserId,
      guardName: "admin.master-admin.bind-legacy",
    });

    return apiSuccess({ ok: true });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("MasterAdmin 레코드 연결을 처리하지 못했습니다.", 500, "ADMIN_MASTER_LEGACY_BIND_INTERNAL_FAILED");
  }
}
