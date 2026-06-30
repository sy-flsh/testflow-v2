import { apiError, apiSuccess } from "@/lib/api/response";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireRecentMasterAdminAuth,
} from "@/lib/auth/guards";
import { getActiveMasterAdminUserIds } from "@/lib/auth/master-admin";
import {
  normalizeAdminDeletedPage,
  normalizeAdminDeletedQuery,
  normalizeAdminDeletedSize,
  normalizeAdminDeletedSort,
} from "@/lib/admin/admin-deleted-filters";
import type { MasterAdminDto, RevokeBlockedReasonDto } from "@/lib/admin/types";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

function normalizeMasterStatus(value: string | null): "ACTIVE" | "INACTIVE" | "ALL" {
  return value === "INACTIVE" || value === "ALL" ? value : "ACTIVE";
}

/**
 * c10-8: MasterAdmin 관리 목록(권한 위임/해제 대상). requireRecentMasterAdminAuth.
 * GET /api/admin/master-admins?q=&status=ACTIVE&page=1&size=20&sort=newest
 *
 * - **userId-bound MasterAdmin 만** 포함(unbound legacy row 는 제외, 수만 legacyUnboundCount 로 노출).
 * - 이름/email 은 연결 User 의 현재 값(relation). status: 연결 User soft-deleted → ACCOUNT_DELETED.
 * - revokeAllowed/blockedReason 은 UX hint(실제 차단은 revoke route 가 tx 재검증).
 * - DTO allowlist: passwordHash/session/role/company/state/audit metadata 미반환. N+1 없음.
 */
export async function GET(request: Request) {
  try {
    const { user: actor } = await requireRecentMasterAdminAuth();

    const url = new URL(request.url);
    const q = normalizeAdminDeletedQuery(url.searchParams.get("q"));
    const status = normalizeMasterStatus(url.searchParams.get("status"));
    const sort = normalizeAdminDeletedSort(url.searchParams.get("sort"));
    const size = normalizeAdminDeletedSize(url.searchParams.get("size"));
    const requestedPage = normalizeAdminDeletedPage(url.searchParams.get("page"));

    const where = {
      userId: { not: null },
      ...(status === "ACTIVE" ? { isActive: true } : status === "INACTIVE" ? { isActive: false } : {}),
      ...(q
        ? {
            user: {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { email: { contains: q, mode: "insensitive" as const } },
              ],
            },
          }
        : {}),
    };

    const total = await prisma.masterAdmin.count({ where });
    const totalPages = Math.ceil(total / size);
    const page = total === 0 ? 1 : Math.min(Math.max(1, requestedPage), totalPages);

    const orderBy =
      sort === "oldest"
        ? [{ createdAt: "asc" as const }, { id: "asc" as const }]
        : [{ createdAt: "desc" as const }, { id: "desc" as const }];

    const rows = await prisma.masterAdmin.findMany({
      where,
      orderBy,
      skip: (page - 1) * size,
      take: size,
      select: {
        id: true,
        userId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { name: true, email: true, deletedAt: true } },
      },
    });

    const activeIds = await getActiveMasterAdminUserIds(prisma);
    const onlyOneActive = activeIds.size === 1;
    const legacyUnboundCount = await prisma.masterAdmin.count({ where: { userId: null } });

    const masterAdmins: MasterAdminDto[] = rows.map((m) => {
      const userId = m.userId as string; // userId not null (where 보장)
      const u = m.user; // bound → user 존재
      const accountDeleted = Boolean(u?.deletedAt);
      const dtoStatus = accountDeleted ? "ACCOUNT_DELETED" : m.isActive ? "ACTIVE" : "INACTIVE";
      const isCurrentActor = userId === actor.id;
      let reason: RevokeBlockedReasonDto | null = null;
      if (isCurrentActor) {
        reason = "SELF";
      } else if (accountDeleted) {
        reason = "ACCOUNT_DELETED";
      } else if (!m.isActive) {
        reason = "NOT_ACTIVE";
      } else if (activeIds.has(userId) && onlyOneActive) {
        reason = "LAST_ACTIVE_MASTER";
      }
      return {
        masterAdminId: m.id,
        userId,
        name: u?.name ?? "",
        email: u?.email ?? "",
        status: dtoStatus,
        isCurrentActor,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
        revokeAllowed: reason === null,
        revokeBlockedReason: reason,
      };
    });

    return apiSuccess({
      masterAdmins,
      pagination: {
        page,
        size,
        total,
        totalPages,
        hasPrevious: page > 1,
        hasNext: page < totalPages,
      },
      filters: { q: q || null, status, sort },
      legacyUnboundCount,
    });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("MasterAdmin 목록을 불러오지 못했습니다.", 500, "ADMIN_MASTER_LIST_FAILED");
  }
}
