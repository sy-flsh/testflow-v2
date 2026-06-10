import type { MemberRole, Workspace } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { RolesByScope } from "@/lib/auth/roles";

export type AuthRole = "Admin" | "Member" | "Viewer";

const roleLabels: Record<MemberRole, AuthRole> = {
  ADMIN: "Admin",
  MEMBER: "Member",
  VIEWER: "Viewer",
};

export function toAuthRole(role: MemberRole) {
  return roleLabels[role];
}

export function buildPermissions(role: AuthRole) {
  return {
    canRead: true,
    canCreate: role === "Admin" || role === "Member",
    canUpdate: role === "Admin" || role === "Member",
    canDelete: role === "Admin",
    canAccessDangerZone: role === "Admin",
  };
}

export async function resolveActiveMembership(userId: string, selectedWorkspaceId?: string | null) {
  const where = {
    userId,
    status: "ACTIVE" as const,
    ...(selectedWorkspaceId ? { workspaceId: selectedWorkspaceId } : {}),
  };
  const selectedMembership = await prisma.workspaceMember.findFirst({
    where,
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });

  if (selectedMembership) {
    return selectedMembership;
  }

  return prisma.workspaceMember.findFirst({
    where: {
      userId,
      status: "ACTIVE",
    },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getUserWorkspaces(userId: string) {
  const memberships = await prisma.workspaceMember.findMany({
    where: {
      userId,
      status: "ACTIVE",
    },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((membership) => ({
    id: membership.workspace.id,
    name: membership.workspace.name,
    slug: membership.workspace.slug,
    role: toAuthRole(membership.role),
  }));
}

export function mapAuthPayload(input: {
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
  workspace: Workspace;
  role: MemberRole;
  // c5-2: UserRole 우선으로 산출된 AuthRole override. 전달되면 이 값을 사용하고,
  // 없으면 기존처럼 MemberRole 기반(toAuthRole)으로 산출한다.
  // (login/signup 은 미전달 → 기존 계약 그대로, /api/auth/me 만 UserRole 우선)
  authRole?: AuthRole;
  workspaces?: Array<{ id: string; name: string; slug: string; role: AuthRole }>;
  // c5-1: UserRole 기반 scope별 Role. additive 필드 — 전달된 경우에만 응답에 포함한다.
  rolesByScope?: RolesByScope;
}) {
  const role = input.authRole ?? toAuthRole(input.role);

  return {
    user: {
      id: input.user.id,
      name: input.user.name,
      email: input.user.email,
      avatarUrl: input.user.avatarUrl ?? null,
    },
    workspace: {
      id: input.workspace.id,
      name: input.workspace.name,
      slug: input.workspace.slug,
    },
    role,
    permissions: buildPermissions(role),
    ...(input.workspaces ? { workspaces: input.workspaces } : {}),
    ...(input.rolesByScope ? { rolesByScope: input.rolesByScope } : {}),
  };
}
