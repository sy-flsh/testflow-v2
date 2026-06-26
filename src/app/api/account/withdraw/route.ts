import { Prisma } from "@prisma/client";
import { apiError, apiSuccess } from "@/lib/api/response";
import { readJsonBody, readTrimmedString } from "@/lib/api/request";
import { DELETION_REASON } from "@/lib/auth/account";
import { clearSessionCookie, getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { recordSecurityAuditEvent } from "@/lib/security/audit-log";
import { enforceCsrfProtection } from "@/lib/security/csrf";
import {
  checkRateLimit,
  getClientIp,
  rateLimitErrorResponse,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";

/** 탈퇴 확인 문구(정확히 일치, 공백 trim 후 비교). */
const CONFIRMATION_PHRASE = "탈퇴합니다";

const WITHDRAW_WINDOW_MS = 10 * 60 * 1000;
const WITHDRAW_IP_LIMIT = 20;

/**
 * c10-1: 본인 계정 전역 탈퇴(soft delete).
 * POST /api/account/withdraw  body: { confirmation: "탈퇴합니다" }
 *
 * - 로그인 사용자 본인만. CSRF 필수. CO 라도 "다른 사용자"를 탈퇴시킬 수 없다(본인 세션 기준).
 * - soft delete: User.deletedAt/deletedByUserId/deletionReason 만 기록하고 row 는 보존한다.
 *   UserRole/WorkspaceMember/CompanyUserState/Invitation/SecurityAuditEvent 는 건드리지 않는다.
 * - 모든 세션 삭제 → 이후 login/api/me 차단(USER_ACCOUNT_DELETED).
 * - audit(USER_SOFT_DELETED, companyId=null)는 main transaction 성공 후 best-effort(실패해도 rollback 없음).
 * - 이미 탈퇴 상태면 idempotent: 덮어쓰기/중복 audit 없이 { ok: true } 반환.
 */
export async function POST(request: Request) {
  try {
    const csrfError = enforceCsrfProtection(request);
    if (csrfError) {
      return csrfError;
    }

    const ipLimit = await checkRateLimit({
      scope: "account:withdraw:ip",
      key: getClientIp(request),
      limit: WITHDRAW_IP_LIMIT,
      windowMs: WITHDRAW_WINDOW_MS,
    });
    if (!ipLimit.allowed) {
      return rateLimitErrorResponse(ipLimit);
    }

    const session = await getCurrentSession();
    if (!session) {
      return apiError("로그인이 필요합니다.", 401, "AUTH_UNAUTHORIZED");
    }

    const body = await readJsonBody(request);
    const confirmation = readTrimmedString(body.confirmation);
    if (confirmation !== CONFIRMATION_PHRASE) {
      return apiError(
        "계정 탈퇴를 진행하려면 ‘탈퇴합니다’를 정확히 입력해 주세요.",
        400,
        "ACCOUNT_WITHDRAWAL_CONFIRMATION_REQUIRED",
      );
    }

    const userId = session.userId;

    // 원자성: 대상을 다시 조회 → soft delete + 세션 전체 삭제를 한 트랜잭션에서.
    const result = await prisma.$transaction(
      async (tx) => {
        const current = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true, deletedAt: true },
        });

        if (!current) {
          return { changed: false as const, missing: true as const };
        }
        if (current.deletedAt) {
          // 이미 탈퇴됨 → idempotent. 상태/세션을 덮어쓰지 않는다.
          return { changed: false as const, missing: false as const };
        }

        await tx.user.update({
          where: { id: userId },
          data: {
            deletedAt: new Date(),
            deletedByUserId: userId,
            deletionReason: DELETION_REASON.SELF_WITHDRAWAL,
          },
        });
        // 모든 세션 무효화(현재 세션 포함).
        await tx.session.deleteMany({ where: { userId } });

        return { changed: true as const, missing: false as const };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    // 현재 쿠키가 가리키던 세션은 삭제되었으므로 쿠키도 정리한다(idempotent 재호출 포함).
    await clearSessionCookie();

    if (result.missing) {
      // 세션은 있었으나 user row 가 사라진 비정상 케이스 → 안전하게 미인증 처리.
      return apiError("로그인이 필요합니다.", 401, "AUTH_UNAUTHORIZED");
    }

    if (result.changed) {
      // best-effort global account-lifecycle audit(companyId=null). 실패해도 탈퇴는 성공.
      await recordSecurityAuditEvent({
        eventType: "USER_SOFT_DELETED",
        actorUserId: userId,
        targetUserId: userId,
        guardName: "account.withdraw",
      });
    }

    return apiSuccess({ ok: true });
  } catch (error) {
    console.error(error);
    return apiError("계정 탈퇴를 처리하지 못했습니다.", 500, "ACCOUNT_WITHDRAWAL_FAILED");
  }
}
