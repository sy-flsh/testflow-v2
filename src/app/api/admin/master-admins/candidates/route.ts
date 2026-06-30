import { apiError, apiSuccess } from "@/lib/api/response";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireRecentMasterAdminAuth,
} from "@/lib/auth/guards";
import { normalizeAdminDeletedQuery } from "@/lib/admin/admin-deleted-filters";
import type { MasterAdminCandidateDto, MasterAdminCandidateEligibility } from "@/lib/admin/types";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

const MAX_CANDIDATES = 20;

/**
 * c10-8: MasterAdmin 위임 후보 검색. requireRecentMasterAdminAuth.
 * GET /api/admin/master-admins/candidates?q=
 *
 * - q trim 후 2글자 미만이면 빈 배열. 활성 User(deletedAt null) name/email contains, 최대 20건.
 * - eligibility(bulk, N+1 없음): userId-bound active→ALREADY_ACTIVE_MASTER, inactive→
 *   INACTIVE_MASTER_CAN_REACTIVATE, 미bound + email 충돌 unbound legacy→LEGACY_BINDING_REQUIRED, else ELIGIBLE.
 * - DTO allowlist: userId/name/email/eligibility (role/company/session/passwordHash 미반환).
 */
export async function GET(request: Request) {
  try {
    await requireRecentMasterAdminAuth();

    const url = new URL(request.url);
    const q = normalizeAdminDeletedQuery(url.searchParams.get("q"));
    if (q.length < 2) {
      return apiSuccess({ candidates: [] });
    }

    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: MAX_CANDIDATES,
      select: { id: true, name: true, email: true },
    });

    const userIds = users.map((u) => u.id);
    const emails = users.map((u) => u.email);

    const boundMasters = userIds.length
      ? await prisma.masterAdmin.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true, isActive: true },
        })
      : [];
    const boundByUser = new Map(boundMasters.map((m) => [m.userId as string, m.isActive]));

    const unboundLegacy = emails.length
      ? await prisma.masterAdmin.findMany({
          where: { userId: null, email: { in: emails } },
          select: { email: true },
        })
      : [];
    const unboundEmails = new Set(unboundLegacy.map((m) => m.email));

    const candidates: MasterAdminCandidateDto[] = users.map((u) => {
      let eligibility: MasterAdminCandidateEligibility;
      const bound = boundByUser.get(u.id);
      if (bound === true) {
        eligibility = "ALREADY_ACTIVE_MASTER";
      } else if (bound === false) {
        eligibility = "INACTIVE_MASTER_CAN_REACTIVATE";
      } else if (unboundEmails.has(u.email)) {
        eligibility = "LEGACY_BINDING_REQUIRED";
      } else {
        eligibility = "ELIGIBLE";
      }
      return { userId: u.id, name: u.name, email: u.email, eligibility };
    });

    return apiSuccess({ candidates });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("위임 후보를 불러오지 못했습니다.", 500, "ADMIN_MASTER_CANDIDATES_FAILED");
  }
}
