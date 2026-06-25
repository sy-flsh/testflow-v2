import { apiError, apiSuccess } from "@/lib/api/response";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireCompanyOwner,
} from "@/lib/auth/guards";
import type {
  CompanyUserDetailDto,
  CompanyUserRoleEntry,
} from "@/lib/company/types";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

/**
 * c7-2: CO 사용자 상세 조회 (Role Matrix 편집 UI 데이터 공급).
 * GET /api/company/users/{userId}
 *
 * 현재 로그인 사용자가 CO 인 Company 기준으로, 그 Company 소속 사용자 1명의
 * 프로필 + 현재 UserRole 전체 + Matrix 행 구성용 Workspace/Project 트리를 반환한다.
 * - CO 가 아니면 403 (requireCompanyOwner)
 * - 대상 사용자가 없거나 현재 Company 소속이 아니면 404 (cross-company 노출 방지)
 * - Role 표시는 UserRole 기준 (WorkspaceMember.role fallback 미사용).
 *   상태(ACTIVE/PENDING)만 WorkspaceMember.status 에서 파생 (c7-1 목록과 동일 규칙).
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { companyId } = await requireCompanyOwner();
    const { userId } = await context.params;

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
    const workspaceIds = workspaces.map((workspace) => workspace.id);
    const projectIds = workspaces.flatMap((workspace) =>
      workspace.projects.map((project) => project.id),
    );

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    if (!target) {
      return apiError("대상 사용자를 찾을 수 없습니다.", 404, "USER_NOT_FOUND");
    }

    // 회사 범위 UserRole (표시/편집 기준)
    const userRoles = await prisma.userRole.findMany({
      where: {
        userId,
        OR: [
          { scopeType: "COMPANY", scopeId: companyId },
          { scopeType: "WORKSPACE", scopeId: { in: workspaceIds } },
          { scopeType: "PROJECT", scopeId: { in: projectIds } },
        ],
      },
      select: { scopeType: true, scopeId: true, role: true },
      orderBy: [{ scopeType: "asc" }, { role: "asc" }],
    });

    // 회사 워크스페이스 멤버십 (소속 판정)
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId, workspaceId: { in: workspaceIds } },
      select: { id: true },
    });

    // 소속 판정: 회사 범위 UserRole 도 없고 멤버십도 없으면 이 Company 사용자가 아님 → 404
    if (userRoles.length === 0 && memberships.length === 0) {
      return apiError("대상 사용자를 찾을 수 없습니다.", 404, "USER_NOT_FOUND");
    }

    // c9-1: 상태는 CompanyUserState 기준(레코드 없으면 ACTIVE).
    const state = await prisma.companyUserState.findUnique({
      where: { companyId_userId: { companyId, userId } },
      select: { status: true },
    });
    const status = state?.status ?? "ACTIVE";

    const roles: CompanyUserRoleEntry[] = userRoles.map((row) => ({
      scopeType: row.scopeType,
      scopeId: row.scopeId,
      role: row.role,
    }));

    const detail: CompanyUserDetailDto = {
      userId: target.id,
      name: target.name,
      email: target.email,
      status,
      company,
      workspaces,
      roles,
    };

    return apiSuccess(detail);
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("회원 상세를 불러오지 못했습니다.", 500, "COMPANY_USER_DETAIL_FAILED");
  }
}
