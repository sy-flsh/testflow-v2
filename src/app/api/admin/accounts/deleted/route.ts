import { apiError, apiSuccess } from "@/lib/api/response";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireRecentMasterAdminAuth,
} from "@/lib/auth/guards";
import {
  normalizeAdminDeletedPage,
  normalizeAdminDeletedQuery,
  normalizeAdminDeletedSize,
  normalizeAdminDeletedSort,
} from "@/lib/admin/admin-deleted-filters";
import type { DeletedAccountDto } from "@/lib/admin/types";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

/**
 * c10-2: MasterAdmin 탈퇴(soft-deleted) 계정 목록.
 * GET /api/admin/accounts/deleted?q=&page=1&size=20&sort=newest
 *
 * - requireMasterAdmin: 비로그인 401, 탈퇴 계정 403 USER_ACCOUNT_DELETED, 비-MasterAdmin 403 AUTH_FORBIDDEN.
 * - 범위: User.deletedAt != null 만. active user 는 절대 미포함.
 * - DTO allowlist(userId/name/email/deletedAt/deletedByUserId/deletionReason)만 — 민감정보/role/company/session 미노출.
 * - 잘못된 query 는 안전한 기본값 fallback. page overflow 는 마지막 page 로 clamp. N+1 없음(단일 findMany).
 */
export async function GET(request: Request) {
  try {
    await requireRecentMasterAdminAuth();

    const url = new URL(request.url);
    const q = normalizeAdminDeletedQuery(url.searchParams.get("q"));
    const sort = normalizeAdminDeletedSort(url.searchParams.get("sort"));
    const size = normalizeAdminDeletedSize(url.searchParams.get("size"));
    const requestedPage = normalizeAdminDeletedPage(url.searchParams.get("page"));

    const where = {
      deletedAt: { not: null },
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
        ? [{ deletedAt: "asc" as const }, { id: "asc" as const }]
        : [{ deletedAt: "desc" as const }, { id: "desc" as const }];

    const rows = await prisma.user.findMany({
      where,
      orderBy,
      skip: (page - 1) * size,
      take: size,
      // allowlist: 민감정보(passwordHash/avatarUrl/lastLoginAt 등)·role·company·session 미선택.
      select: {
        id: true,
        name: true,
        email: true,
        deletedAt: true,
        deletedByUserId: true,
        deletionReason: true,
      },
    });

    const users: DeletedAccountDto[] = rows.map((user) => ({
      userId: user.id,
      name: user.name,
      email: user.email,
      // deletedAt 은 where 로 not-null 보장. 방어적으로 ISO 변환.
      deletedAt: (user.deletedAt as Date).toISOString(),
      deletedByUserId: user.deletedByUserId,
      deletionReason: user.deletionReason,
    }));

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
    return apiError("탈퇴 계정 목록을 불러오지 못했습니다.", 500, "ADMIN_DELETED_LIST_FAILED");
  }
}
