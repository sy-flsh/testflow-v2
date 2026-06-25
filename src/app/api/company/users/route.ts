import type { Role } from "@prisma/client";
import { apiError, apiSuccess } from "@/lib/api/response";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireCompanyOwner,
} from "@/lib/auth/guards";
import { roleSummaryToken } from "@/lib/auth/roles";
import type {
  CompanyUserDto,
  CompanyUserScopedRole,
} from "@/lib/company/types";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

/**
 * c7-1: CO 회원 목록.
 * GET /api/company/users
 * 현재 로그인 사용자가 CO 인 Company 기준으로 사용자와 Scope별 Role(UserRole) 요약을 반환한다.
 * (CO 가 아니면 403). Role 표시는 UserRole 기준이며 WorkspaceMember.role fallback 은 쓰지 않는다.
 */
export async function GET() {
  try {
    const { companyId } = await requireCompanyOwner();

    const companyWorkspaces = await prisma.workspace.findMany({
      where: { companyId },
      select: { id: true },
    });
    const workspaceIds = companyWorkspaces.map((workspace) => workspace.id);

    const companyProjects = await prisma.project.findMany({
      where: { workspace: { companyId } },
      select: { id: true },
    });
    const projectIds = companyProjects.map((project) => project.id);

    // 회사 범위 UserRole 전부 조회 (표시 기준)
    const userRoles = await prisma.userRole.findMany({
      where: {
        OR: [
          { scopeType: "COMPANY", scopeId: companyId },
          { scopeType: "WORKSPACE", scopeId: { in: workspaceIds } },
          { scopeType: "PROJECT", scopeId: { in: projectIds } },
        ],
      },
      select: { userId: true, scopeType: true, scopeId: true, role: true },
    });

    // 회사 워크스페이스 멤버십(상태 표시 + 멤버지만 UserRole 없는 사용자도 노출)
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: { in: workspaceIds } },
      select: { userId: true, status: true },
    });

    const userIds = new Set<string>([
      ...userRoles.map((role) => role.userId),
      ...members.map((member) => member.userId),
    ]);

    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, email: true },
      orderBy: { createdAt: "asc" },
    });

    // 사용자별 Role 그룹화
    const rolesByUser = new Map<
      string,
      { company: CompanyUserScopedRole[]; workspace: CompanyUserScopedRole[]; project: CompanyUserScopedRole[] }
    >();

    for (const row of userRoles) {
      const group =
        rolesByUser.get(row.userId) ?? { company: [], workspace: [], project: [] };
      const entry: CompanyUserScopedRole = { scopeId: row.scopeId, role: row.role };

      if (row.scopeType === "COMPANY") {
        group.company.push(entry);
      } else if (row.scopeType === "WORKSPACE") {
        group.workspace.push(entry);
      } else {
        group.project.push(entry);
      }

      rolesByUser.set(row.userId, group);
    }

    // 사용자별 상태: ACTIVE 멤버십이 하나라도 있으면 ACTIVE, 멤버십이 PENDING 뿐이면 PENDING.
    const hasActive = new Set<string>();
    const hasMembership = new Set<string>();

    for (const member of members) {
      hasMembership.add(member.userId);

      if (member.status === "ACTIVE") {
        hasActive.add(member.userId);
      }
    }

    const items: CompanyUserDto[] = users.map((user) => {
      const group = rolesByUser.get(user.id) ?? {
        company: [],
        workspace: [],
        project: [],
      };

      const summary: string[] = [
        ...group.company.map((entry) => roleSummaryToken("COMPANY", entry.role)),
        ...group.workspace.map((entry) => roleSummaryToken("WORKSPACE", entry.role)),
        ...group.project.map((entry) => roleSummaryToken("PROJECT", entry.role)),
      ];

      const status: "ACTIVE" | "PENDING" =
        hasActive.has(user.id) || !hasMembership.has(user.id) ? "ACTIVE" : "PENDING";

      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        status,
        roles: summary,
        companyRoles: sortRoles(group.company),
        workspaceRoles: sortRoles(group.workspace),
        projectRoles: sortRoles(group.project),
      };
    });

    return apiSuccess({ companyId, users: items });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("회원 목록을 불러오지 못했습니다.", 500, "COMPANY_USERS_FAILED");
  }
}

const ROLE_ORDER: Record<Role, number> = {
  MASTER: 0,
  CO: 1,
  WO: 2,
  PO: 3,
  MEMBER: 4,
  VIEWER: 5,
};

function sortRoles(roles: CompanyUserScopedRole[]): CompanyUserScopedRole[] {
  return [...roles].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
}
