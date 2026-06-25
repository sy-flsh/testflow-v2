import type { MemberRole, Role, ScopeType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { toAuthRole, type AuthRole } from "@/lib/auth/me";

/**
 * c5-1: UserRole 기반 권한 helper.
 *
 * 이 모듈은 데이터 조회/정합성 검증만 제공하며, 아직 런타임 API guard
 * (guards.ts / buildPermissions / requireCurrentWorkspace / requireProjectAccess)에는
 * 연결하지 않는다. guard 전환은 c5-2 이후에서 진행한다.
 */

export type ScopedRole = {
  scopeId: string;
  role: Role;
};

export type RolesByScope = {
  company: ScopedRole[];
  workspace: ScopedRole[];
  project: ScopedRole[];
};

/**
 * scope-role 정합성 정책 (기능명세서 v2 / _ux-role-matrix §3.2)
 * - CO        → COMPANY 만
 * - WO        → WORKSPACE 만
 * - PO        → PROJECT 만
 * - MEMBER    → WORKSPACE | PROJECT
 * - VIEWER    → WORKSPACE | PROJECT
 * - MASTER    → MasterAdmin 전용 인증 경로용. UserRole(Scope 부여 모델)에서는
 *               사용하지 않으므로 허용 scope 를 비워 둔다(어떤 scope 도 불허).
 */
const ROLE_ALLOWED_SCOPES: Record<Role, ScopeType[]> = {
  MASTER: [],
  CO: ["COMPANY"],
  WO: ["WORKSPACE"],
  PO: ["PROJECT"],
  MEMBER: ["WORKSPACE", "PROJECT"],
  VIEWER: ["WORKSPACE", "PROJECT"],
};

/** 해당 Role 이 부여 가능한 ScopeType 목록을 반환한다. */
export function allowedScopesForRole(role: Role): ScopeType[] {
  return ROLE_ALLOWED_SCOPES[role];
}

/**
 * c6-1: UserRole sync API 에서 부여 가능한 Role 인지 검증한다.
 * MASTER 는 MasterAdmin 전용이므로 UserRole 부여 대상에서 제외한다.
 */
export function isAssignableRole(role: Role): boolean {
  return role !== "MASTER";
}

/**
 * c7-1: Role 요약 토큰 (회원 목록 표시용).
 * - COMPANY/CO → "CO"
 * - WORKSPACE/WO → "WO(W)", WORKSPACE/MEMBER → "M(W)", WORKSPACE/VIEWER → "V(W)"
 * - PROJECT/PO → "PO(P)", PROJECT/MEMBER → "M(P)", PROJECT/VIEWER → "V(P)"
 */
export function roleSummaryToken(scopeType: ScopeType, role: Role): string {
  if (scopeType === "COMPANY") {
    return role;
  }

  const suffix = scopeType === "WORKSPACE" ? "(W)" : "(P)";
  const base =
    role === "MEMBER" ? "M" : role === "VIEWER" ? "V" : role; // WO/PO 는 그대로

  return `${base}${suffix}`;
}

/**
 * c6-1: 특정 사용자가 CO(Company Owner)로 있는 Company id 목록을 반환한다.
 * (UserRole COMPANY/CO 기준 — WorkspaceMember.role 과 무관)
 */
export async function getCompaniesWhereUserIsCO(userId: string): Promise<string[]> {
  const rows = await prisma.userRole.findMany({
    where: { userId, scopeType: "COMPANY", role: "CO" },
    select: { scopeId: true },
  });

  return rows.map((row) => row.scopeId);
}

/** (role, scopeType) 조합이 정합한지 검증한다. DB CHECK 없이 애플리케이션 레벨 검증용. */
export function isRoleAllowedForScope(role: Role, scopeType: ScopeType): boolean {
  return ROLE_ALLOWED_SCOPES[role].includes(scopeType);
}

/**
 * c5-2: UserRole(Role) → 기존 AuthRole 호환 매핑.
 * - CO / WO / PO → "Admin"
 * - MEMBER       → "Member"
 * - VIEWER       → "Viewer"
 * - MASTER       → MasterAdmin 전용. 일반 UserRole 권한 산출에서는 제외(null).
 * 기존 buildPermissions(role: AuthRole)를 그대로 재사용하기 위한 변환이다.
 */
export function specRoleToAuthRole(role: Role): AuthRole | null {
  switch (role) {
    case "CO":
    case "WO":
    case "PO":
      return "Admin";
    case "MEMBER":
      return "Member";
    case "VIEWER":
      return "Viewer";
    case "MASTER":
      return null;
  }
}

/**
 * c5-2: Workspace 권한 Role 을 UserRole 우선으로 산출한다.
 * UserRole(WORKSPACE, workspaceId) 가 있으면 그 role 을 AuthRole 로 변환해 사용하고,
 * 없으면 **전환 기간 한정 fallback** 으로 WorkspaceMember.role 매핑을 사용한다.
 * (모든 사용자에 대한 UserRole 백필이 끝나면 fallback 제거 예정 — c5-3/c6)
 */
export async function resolveWorkspaceAuthRole(
  userId: string,
  workspaceId: string,
  fallbackMemberRole: MemberRole,
): Promise<AuthRole> {
  const userRole = await prisma.userRole.findUnique({
    where: {
      userId_scopeType_scopeId: {
        userId,
        scopeType: "WORKSPACE",
        scopeId: workspaceId,
      },
    },
    select: { role: true },
  });

  if (userRole) {
    const mapped = specRoleToAuthRole(userRole.role);

    if (mapped) {
      return mapped;
    }
  }

  // fallback (전환 기간 한정): 기존 WorkspaceMember.role 기반
  return toAuthRole(fallbackMemberRole);
}

/**
 * c5-2: Project 권한 Role 산출. 현재 PROJECT scope UserRole 데이터는 아직 없지만(c6에서 도입),
 * 존재하면 우선 사용하도록 구조만 준비한다. 없으면 상위 Workspace 권한으로 fallback 한다.
 * 따라서 PROJECT UserRole 이 없는 현재는 기존 workspace-level 권한과 동일하게 동작한다.
 */
export async function resolveProjectAuthRole(
  userId: string,
  projectId: string,
  workspaceFallbackRole: AuthRole,
): Promise<AuthRole> {
  const userRole = await prisma.userRole.findUnique({
    where: {
      userId_scopeType_scopeId: {
        userId,
        scopeType: "PROJECT",
        scopeId: projectId,
      },
    },
    select: { role: true },
  });

  if (userRole) {
    const mapped = specRoleToAuthRole(userRole.role);

    if (mapped) {
      return mapped;
    }
  }

  return workspaceFallbackRole;
}

/**
 * 특정 사용자의 UserRole 목록을 scopeType 별로 그룹화하여 반환한다.
 * 응답 형태:
 *   { company: [{ scopeId, role }], workspace: [...], project: [...] }
 */
export async function getRolesByScope(userId: string): Promise<RolesByScope> {
  const rows = await prisma.userRole.findMany({
    where: { userId },
    select: { scopeType: true, scopeId: true, role: true },
    orderBy: [{ scopeType: "asc" }, { role: "asc" }],
  });

  const grouped: RolesByScope = { company: [], workspace: [], project: [] };

  for (const row of rows) {
    const entry: ScopedRole = { scopeId: row.scopeId, role: row.role };

    if (row.scopeType === "COMPANY") {
      grouped.company.push(entry);
    } else if (row.scopeType === "WORKSPACE") {
      grouped.workspace.push(entry);
    } else if (row.scopeType === "PROJECT") {
      grouped.project.push(entry);
    }
  }

  return grouped;
}
