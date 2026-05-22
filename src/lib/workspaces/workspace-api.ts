import {
  MemberRole as PrismaMemberRole,
  MemberStatus as PrismaMemberStatus,
  type Prisma,
  type Workspace,
} from "@prisma/client";

import type { WorkspaceMemberDto, WorkspaceSettingsDto } from "@/lib/workspaces/types";

const DEFAULT_TIMEZONE = "Asia/Seoul";

const toDomainRole: Record<PrismaMemberRole, WorkspaceMemberDto["role"]> = {
  ADMIN: "Admin",
  MEMBER: "Member",
  VIEWER: "Viewer",
};

const toDomainStatus: Record<PrismaMemberStatus, WorkspaceMemberDto["status"]> = {
  ACTIVE: "active",
  PENDING: "pending",
};

export type WorkspaceWithMembers = Prisma.WorkspaceGetPayload<{
  include: {
    members: {
      include: {
        user: true;
      };
    };
  };
}>;

export function mapWorkspaceToDto(workspace: Workspace): WorkspaceSettingsDto {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    logoUrl: workspace.logoUrl ?? "",
    timezone: workspace.timezone || DEFAULT_TIMEZONE,
    createdAt: workspace.createdAt.toISOString(),
    updatedAt: workspace.updatedAt.toISOString(),
  };
}

export function mapWorkspaceMemberToDto(
  member: WorkspaceWithMembers["members"][number],
): WorkspaceMemberDto {
  return {
    id: member.id,
    userId: member.userId,
    name: member.user.name,
    email: member.user.email,
    imageUrl: "",
    role: toDomainRole[member.role],
    status: toDomainStatus[member.status],
    joinedAt: member.createdAt.toISOString(),
    lastActiveAt: member.updatedAt.toISOString(),
    lastActive: formatRelativeDate(member.updatedAt),
  };
}

export function toWorkspaceSlug(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug;
}

function formatRelativeDate(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) {
    return "방금 전";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}분 전`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}시간 전`;
  }

  return `${Math.floor(diffHours / 24)}일 전`;
}
