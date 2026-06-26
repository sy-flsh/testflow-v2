import type { CompanyUserStatus, Role } from "@prisma/client";
import { apiError, apiSuccess } from "@/lib/api/response";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireCompanyOwner,
} from "@/lib/auth/guards";
import { roleSummaryToken } from "@/lib/auth/roles";
import {
  normalizeCompanyUserPage,
  normalizeCompanyUserSize,
  normalizeCompanyUserSort,
  normalizeCompanyUserStatus,
} from "@/lib/company/company-user-filters";
import type {
  CompanyUserDto,
  CompanyUserScopedRole,
} from "@/lib/company/types";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

/**
 * c7-1/c9-1/c9-3: CO 회원 목록 (검색·상태 필터·정렬·서버 페이지네이션).
 * GET /api/company/users?q=&status=ALL&page=1&size=20&sort=nameAsc
 * - CO 가 아니면 403. Role 표시는 UserRole 기준(WorkspaceMember.role fallback 미사용).
 * - 상태(ACTIVE/INACTIVE)는 CompanyUserState 기준(레코드 없으면 ACTIVE 로 간주 — c9-1 fallback).
 * - 대상 집합 = 회사 scope UserRole 보유자 ∪ 회사 Workspace 멤버 ∪ 회사 CompanyUserState 보유자
 *   (state 만 남은 INACTIVE 사용자도 목록에 유지). 타 Company 자원은 절대 미포함.
 * - 잘못된 query 는 400 대신 안전한 기본값으로 fallback. 대상 집합이 Company 단위로 한정되므로
 *   bulk 조회 후 서버에서 검색·필터·정렬·페이지네이션한다(N+1 없음).
 */
export async function GET(request: Request) {
  try {
    const { companyId } = await requireCompanyOwner();

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const status = normalizeCompanyUserStatus(url.searchParams.get("status"));
    const sort = normalizeCompanyUserSort(url.searchParams.get("sort"));
    const size = normalizeCompanyUserSize(url.searchParams.get("size"));
    const requestedPage = normalizeCompanyUserPage(url.searchParams.get("page"));

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

    // 회사 범위 UserRole 전부 조회 (표시 기준 + 대상 집합)
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

    // 회사 워크스페이스 멤버십(멤버지만 UserRole 없는 사용자도 목록에 노출)
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: { in: workspaceIds } },
      select: { userId: true },
    });

    // c9-1/c9-3: CompanyUserState — 상태 표시/필터 + newest 정렬 + 대상 집합에 포함
    // (UserRole/WorkspaceMember 가 없고 state 만 남은 INACTIVE 사용자도 목록에 유지).
    const states = await prisma.companyUserState.findMany({
      where: { companyId },
      select: { userId: true, status: true, createdAt: true },
    });
    const stateByUser = new Map(
      states.map((state) => [state.userId, { status: state.status, createdAt: state.createdAt }]),
    );

    const userIds = new Set<string>([
      ...userRoles.map((role) => role.userId),
      ...members.map((member) => member.userId),
      ...states.map((state) => state.userId),
    ]);

    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, email: true, deletedAt: true },
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

    // 1) 대상 사용자 + 상태 도출
    type Row = {
      user: (typeof users)[number];
      status: CompanyUserStatus;
      stateCreatedAt: Date | null;
    };
    const rows: Row[] = users.map((user) => {
      const state = stateByUser.get(user.id);
      return {
        user,
        status: state?.status ?? "ACTIVE", // legacy fallback
        stateCreatedAt: state?.createdAt ?? null,
      };
    });

    // 2) q 검색(name/email contains, case-insensitive) + 상태 필터
    const qLower = q.toLowerCase();
    const filtered = rows.filter((row) => {
      if (q && !row.user.name.toLowerCase().includes(qLower) && !row.user.email.toLowerCase().includes(qLower)) {
        return false;
      }
      if (status === "ACTIVE") {
        return row.status !== "INACTIVE";
      }
      if (status === "INACTIVE") {
        return row.status === "INACTIVE";
      }
      return true;
    });

    // 3) 정렬
    filtered.sort((a, b) => compareRows(a, b, sort));

    // 4) 페이지네이션(page clamp)
    const total = filtered.length;
    const totalPages = Math.ceil(total / size);
    const page = total === 0 ? 1 : Math.min(Math.max(1, requestedPage), totalPages);
    const pageRows = filtered.slice((page - 1) * size, (page - 1) * size + size);

    const items: CompanyUserDto[] = pageRows.map(({ user, status: userStatus }) => {
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

      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        status: userStatus,
        accountDeleted: Boolean(user.deletedAt),
        roles: summary,
        companyRoles: sortRoles(group.company),
        workspaceRoles: sortRoles(group.workspace),
        projectRoles: sortRoles(group.project),
      };
    });

    return apiSuccess({
      companyId,
      users: items,
      pagination: {
        page,
        size,
        total,
        totalPages,
        hasPrevious: page > 1,
        hasNext: page < totalPages,
      },
      filters: { q: q || null, status, sort },
    });
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

type SortableRow = {
  user: { name: string; email: string };
  stateCreatedAt: Date | null;
};

/**
 * 정렬:
 * - nameAsc: name ASC, email ASC 보조
 * - nameDesc: name DESC, email DESC 보조
 * - newest: CompanyUserState.createdAt DESC, state 없는 legacy 는 마지막, 이후 name ASC 보조
 */
function compareRows(a: SortableRow, b: SortableRow, sort: "nameAsc" | "nameDesc" | "newest"): number {
  if (sort === "nameDesc") {
    return b.user.name.localeCompare(a.user.name) || b.user.email.localeCompare(a.user.email);
  }

  if (sort === "newest") {
    const ta = a.stateCreatedAt ? a.stateCreatedAt.getTime() : Number.NEGATIVE_INFINITY;
    const tb = b.stateCreatedAt ? b.stateCreatedAt.getTime() : Number.NEGATIVE_INFINITY;
    if (ta !== tb) {
      return tb - ta; // DESC, legacy(-Inf) 는 마지막
    }
    return a.user.name.localeCompare(b.user.name);
  }

  // nameAsc (기본)
  return a.user.name.localeCompare(b.user.name) || a.user.email.localeCompare(b.user.email);
}
