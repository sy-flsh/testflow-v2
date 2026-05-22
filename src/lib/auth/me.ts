import type { MemberRole, Workspace } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

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
  workspaces?: Array<{ id: string; name: string; slug: string; role: AuthRole }>;
}) {
  const role = toAuthRole(input.role);

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
  };
}
