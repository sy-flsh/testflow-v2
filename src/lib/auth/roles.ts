import type { Role, ScopeType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

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

/** (role, scopeType) 조합이 정합한지 검증한다. DB CHECK 없이 애플리케이션 레벨 검증용. */
export function isRoleAllowedForScope(role: Role, scopeType: ScopeType): boolean {
  return ROLE_ALLOWED_SCOPES[role].includes(scopeType);
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
