import { apiError, apiSuccess } from "@/lib/api/response";
import { readJsonBody, readTrimmedString } from "@/lib/api/request";
import { forceSoftDeleteUser } from "@/lib/auth/account";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireRecentMasterAdminAuth,
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

const CONFIRMATION_PHRASE = "강제 정지합니다";
const FORCE_DELETE_WINDOW_MS = 10 * 60 * 1000;
const FORCE_DELETE_LIMIT = 10;

/**
 * c10-6: MasterAdmin 강제 계정 정지(전역 soft delete).
 * POST /api/admin/accounts/{userId}/force-delete  body: { confirmation: "강제 정지합니다" }
 *
 * - requireRecentMasterAdminAuth(step-up 필수: 401/USER_ACCOUNT_DELETED/AUTH_FORBIDDEN/ADMIN_REAUTH_REQUIRED) + CSRF.
 * - 확인 문구 trim 후 정확히 "강제 정지합니다" 아니면 400 ADMIN_FORCE_DELETE_CONFIRMATION_REQUIRED.
 * - tx 안에서 self/존재/active/마지막MasterAdmin/마지막ACTIVE CO 재검증 → 조건부 soft delete + 대상 세션 deleteMany.
 * - 성공 시 USER_SOFT_DELETED(actor=MasterAdmin, companyId=null, guard admin.account.force-delete) tx 후 best-effort.
 * - 복구는 c10-2 MasterAdmin restore 만. 응답 { ok: true }(대상 정보 미포함).
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const csrfError = enforceCsrfProtection(request);
    if (csrfError) {
      return csrfError;
    }

    const { user: actor } = await requireRecentMasterAdminAuth();

    const limit = await checkRateLimit({
      scope: "admin:account-force-delete:actor",
      key: `${actor.id}:${getClientIp(request)}`,
      limit: FORCE_DELETE_LIMIT,
      windowMs: FORCE_DELETE_WINDOW_MS,
    });
    if (!limit.allowed) {
      return rateLimitErrorResponse(limit);
    }

    const { userId: targetUserId } = await context.params;

    const body = await readJsonBody(request);
    const confirmation = readTrimmedString(body.confirmation);
    if (confirmation !== CONFIRMATION_PHRASE) {
      return apiError(
        "계정 강제 정지를 진행하려면 ‘강제 정지합니다’를 정확히 입력해 주세요.",
        400,
        "ADMIN_FORCE_DELETE_CONFIRMATION_REQUIRED",
      );
    }

    const result = await prisma.$transaction((tx) =>
      forceSoftDeleteUser(targetUserId, actor.id, tx),
    );

    if (!result.deleted) {
      switch (result.reason) {
        case "NOT_FOUND":
          return apiError("대상 사용자를 찾을 수 없습니다.", 404, "USER_NOT_FOUND");
        case "NOT_ACTIVE":
          return apiError("활성 상태의 계정만 강제 정지할 수 있습니다.", 409, "USER_ACCOUNT_NOT_ACTIVE");
        case "SELF":
          return apiError("자기 계정은 관리자 강제 정지로 처리할 수 없습니다.", 409, "ADMIN_CANNOT_FORCE_DELETE_SELF");
        case "LAST_MASTER_ADMIN":
          return apiError("마지막 활성 MasterAdmin 계정은 강제 정지할 수 없습니다.", 409, "LAST_MASTER_ADMIN_FORCE_DELETE_FORBIDDEN");
        case "LAST_ACTIVE_CO":
          return apiError(
            "현재 Company의 마지막 회사 관리자는 강제 정지할 수 없습니다. 다른 회사 관리자를 지정한 뒤 다시 시도해 주세요.",
            409,
            "USER_LAST_CO_FORCE_DELETE_FORBIDDEN",
          );
        default:
          return apiError("계정 강제 정지를 처리하지 못했습니다.", 409, "ADMIN_FORCE_DELETE_FAILED");
      }
    }

    // 실제 전이 1회에만 best-effort global audit. 실패해도 강제 정지 결과(rollback) 영향 없음.
    await recordSecurityAuditEvent({
      eventType: "USER_SOFT_DELETED",
      actorUserId: actor.id,
      targetUserId,
      guardName: "admin.account.force-delete",
    });

    return apiSuccess({ ok: true });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("계정 강제 정지를 처리하지 못했습니다.", 500, "ADMIN_FORCE_DELETE_INTERNAL_FAILED");
  }
}
