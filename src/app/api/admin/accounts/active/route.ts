import { apiError, apiSuccess } from "@/lib/api/response";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireRecentMasterAdminAuth,
} from "@/lib/auth/guards";
import { getActiveMasterAdminEmails } from "@/lib/auth/master-admin";
import {
  normalizeAdminDeletedPage,
  normalizeAdminDeletedQuery,
  normalizeAdminDeletedSize,
  normalizeAdminDeletedSort,
} from "@/lib/admin/admin-deleted-filters";
import type { ActiveAccountDto, ForceDeleteBlockedReason } from "@/lib/admin/types";
import { getLastActiveCompanyOwnerUserIds } from "@/lib/company/company-user-state";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

/**
 * c10-6: MasterAdmin 활성 계정 목록(강제 정지 대상 선택용).
 * GET /api/admin/accounts/active?q=&page=1&size=20&sort=newest
 *
 * - requireRecentMasterAdminAuth: 비로그인 401, 탈퇴 403 USER_ACCOUNT_DELETED, 비-Master 403 AUTH_FORBIDDEN,
 *   step-up 없음/만료 403 ADMIN_REAUTH_REQUIRED.
 * - 범위: User.deletedAt = null 만(탈퇴/강제정지 계정 제외). 정렬 기준은 **가입일(createdAt)** — newest=DESC.
 * - DTO allowlist: userId/name/email/createdAt/lastLoginAt + UX hint(isMasterAdmin/isLastActiveCompanyOwner/
 *   forceDeleteAllowed/forceDeleteBlockedReason). role/company/state/session/passwordHash 미반환.
 * - UX hint 는 bulk 계산(페이지 User 에 대해 N+1 없이) — 실제 차단은 force-delete route 가 tx 재검증.
 */
export async function GET(request: Request) {
  try {
    const { user: actor } = await requireRecentMasterAdminAuth();

    const url = new URL(request.url);
    const q = normalizeAdminDeletedQuery(url.searchParams.get("q"));
    const sort = normalizeAdminDeletedSort(url.searchParams.get("sort"));
    const size = normalizeAdminDeletedSize(url.searchParams.get("size"));
    const requestedPage = normalizeAdminDeletedPage(url.searchParams.get("page"));

    const where = {
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const total = await prisma.user.count({ where });
    const totalPages = Math.ceil(total / size);
    const page = total === 0 ? 1 : Math.min(Math.max(1, requestedPage), totalPages);

    const orderBy =
      sort === "oldest"
        ? [{ createdAt: "asc" as const }, { id: "asc" as const }]
        : [{ createdAt: "desc" as const }, { id: "desc" as const }];

    const rows = await prisma.user.findMany({
      where,
      orderBy,
      skip: (page - 1) * size,
      take: size,
      select: { id: true, name: true, email: true, createdAt: true, lastLoginAt: true },
    });

    // bulk UX hint: 활성 MasterAdmin email 집합 + 페이지 User 중 마지막 ACTIVE CO 집합.
    const activeMasterEmails = await getActiveMasterAdminEmails(prisma);
    const onlyOneActiveMaster = activeMasterEmails.size === 1;
    const lastCoUserIds = await getLastActiveCompanyOwnerUserIds(
      prisma,
      rows.map((u) => u.id),
    );

    const users: ActiveAccountDto[] = rows.map((u) => {
      const isMasterAdmin = activeMasterEmails.has(u.email);
      const isLastActiveCompanyOwner = lastCoUserIds.has(u.id);
      // 차단 사유 우선순위: SELF → LAST_MASTER_ADMIN → LAST_ACTIVE_CO (route 검증과 동일 순서).
      let reason: ForceDeleteBlockedReason | null = null;
      if (u.id === actor.id) {
        reason = "SELF";
      } else if (isMasterAdmin && onlyOneActiveMaster) {
        reason = "LAST_MASTER_ADMIN";
      } else if (isLastActiveCompanyOwner) {
        reason = "LAST_ACTIVE_CO";
      }
      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        createdAt: u.createdAt.toISOString(),
        lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
        isMasterAdmin,
        isLastActiveCompanyOwner,
        forceDeleteAllowed: reason === null,
        forceDeleteBlockedReason: reason,
      };
    });

    return apiSuccess({
      users,
      pagination: {
        page,
        size,
        total,
        totalPages,
        hasPrevious: page > 1,
        hasNext: page < totalPages,
      },
      filters: { q: q || null, sort },
    });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("활성 계정 목록을 불러오지 못했습니다.", 500, "ADMIN_ACTIVE_LIST_FAILED");
  }
}
