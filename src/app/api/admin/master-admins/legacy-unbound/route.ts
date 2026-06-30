import { apiError, apiSuccess } from "@/lib/api/response";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireRecentMasterAdminAuth,
} from "@/lib/auth/guards";
import {
  normalizeAdminDeletedPage,
  normalizeAdminDeletedSize,
  normalizeAdminDeletedSort,
} from "@/lib/admin/admin-deleted-filters";
import type { LegacyMasterAdminDto } from "@/lib/admin/types";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

/**
 * c10-9: userId=null 인 legacy unbound MasterAdmin 레코드 목록. requireRecentMasterAdminAuth.
 * GET /api/admin/master-admins/legacy-unbound?page=1&size=20&sort=newest
 *
 * - userId IS NULL 레코드만(권한 미인정 fail-closed 대상). raw email/name/passwordHash 미반환.
 * - DTO allowlist: masterAdminId(불투명) / createdAt / updatedAt / isActive 뿐.
 */
export async function GET(request: Request) {
  try {
    await requireRecentMasterAdminAuth();

    const url = new URL(request.url);
    const sort = normalizeAdminDeletedSort(url.searchParams.get("sort"));
    const size = normalizeAdminDeletedSize(url.searchParams.get("size"));
    const requestedPage = normalizeAdminDeletedPage(url.searchParams.get("page"));

    const where = { userId: null };

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
      select: { id: true, isActive: true, createdAt: true, updatedAt: true },
    });

    const legacyRows: LegacyMasterAdminDto[] = rows.map((m) => ({
      masterAdminId: m.id,
      isActive: m.isActive,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    }));

    return apiSuccess({
      legacyRows,
      pagination: {
        page,
        size,
        total,
        totalPages,
        hasPrevious: page > 1,
        hasNext: page < totalPages,
      },
    });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("미연결 MasterAdmin 레코드 목록을 불러오지 못했습니다.", 500, "ADMIN_MASTER_LEGACY_LIST_FAILED");
  }
}
