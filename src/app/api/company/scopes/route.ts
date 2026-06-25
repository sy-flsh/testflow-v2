import { apiError, apiSuccess } from "@/lib/api/response";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireCompanyOwner,
} from "@/lib/auth/guards";
import type { CompanyScopeTreeDto } from "@/lib/company/types";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

/**
 * c8-3: 초대 Role Matrix 가 그릴 Company scope 트리(읽기 전용).
 * GET /api/company/scopes
 * - CO 만 접근(비CO 403 AUTH_FORBIDDEN).
 * - 현재 CO Company 의 Workspace + 각 Workspace 하위 Project 만 반환(타 Company 미포함).
 * - Prisma schema 변경 없이 기존 모델만으로 구성.
 */
export async function GET() {
  try {
    const { companyId } = await requireCompanyOwner();

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true },
    });

    if (!company) {
      return apiError("Company 를 찾을 수 없습니다.", 404, "COMPANY_NOT_FOUND");
    }

    const workspaces = await prisma.workspace.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        projects: {
          select: { id: true, name: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const tree: CompanyScopeTreeDto = { company, workspaces };

    return apiSuccess(tree);
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("Company scope 를 불러오지 못했습니다.", 500, "COMPANY_SCOPES_FAILED");
  }
}
