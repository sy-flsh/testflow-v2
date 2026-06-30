import { apiError, apiSuccess } from "@/lib/api/response";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireRecentMasterAdminAuth,
} from "@/lib/auth/guards";
import { normalizeAdminDeletedQuery } from "@/lib/admin/admin-deleted-filters";
import type { MasterAdminBindCandidateDto } from "@/lib/admin/types";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ masterAdminId: string }> };

const MAX_CANDIDATES = 20;

/**
 * c10-9: legacy MasterAdmin 수동 연결 후보 검색. requireRecentMasterAdminAuth.
 * GET /api/admin/master-admins/legacy-unbound/{masterAdminId}/candidates?q=
 *
 * - legacy 레코드 존재·미연결 검증(404 LEGACY_NOT_FOUND / 409 ALREADY_BOUND).
 * - q trim 후 2글자 미만이면 빈 배열. **활성·미연결 User 만**(deletedAt null + 어떤 MasterAdmin 에도 미bound), 최대 20건.
 * - email 매칭/추론으로 자동 후보 좁히지 않는다 — 명시 검색어 기준만.
 * - DTO allowlist: userId/name/email (eligibility/role/company/session/passwordHash 미반환).
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    await requireRecentMasterAdminAuth();

    const { masterAdminId } = await context.params;
    const legacy = await prisma.masterAdmin.findUnique({
      where: { id: masterAdminId },
      select: { id: true, userId: true },
    });
    if (!legacy) {
      return apiError("연결할 MasterAdmin 레코드를 찾을 수 없습니다.", 404, "MASTER_ADMIN_LEGACY_NOT_FOUND");
    }
    if (legacy.userId !== null) {
      return apiError("이미 사용자 연결이 완료된 MasterAdmin 레코드입니다.", 409, "MASTER_ADMIN_ALREADY_BOUND");
    }

    const url = new URL(request.url);
    const q = normalizeAdminDeletedQuery(url.searchParams.get("q"));
    if (q.length < 2) {
      return apiSuccess({ candidates: [] });
    }

    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        masterAdmin: { is: null },
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: MAX_CANDIDATES,
      select: { id: true, name: true, email: true },
    });

    const candidates: MasterAdminBindCandidateDto[] = users.map((u) => ({
      userId: u.id,
      name: u.name,
      email: u.email,
    }));

    return apiSuccess({ candidates });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("연결 후보를 불러오지 못했습니다.", 500, "ADMIN_MASTER_LEGACY_CANDIDATES_FAILED");
  }
}
