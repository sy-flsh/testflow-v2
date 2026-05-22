import {
  MemberRole as PrismaMemberRole,
  MemberStatus as PrismaMemberStatus,
  type Prisma,
  type Workspace,
} from "@prisma/client";

import type { WorkspaceMemberDto, WorkspaceSettingsDto } from "@/lib/workspaces/types";

const WORKSPACE_SETTINGS_MARKER = "__testflowWorkspaceSettings";
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
  const metadata = readWorkspaceMetadata(workspace.description);

  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    logoUrl: metadata.logoUrl,
    timezone: metadata.timezone,
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

export function createWorkspaceDescription(input: {
  currentDescription: string;
  timezone?: string;
  logoUrl?: string;
}) {
  const currentMetadata = readWorkspaceMetadata(input.currentDescription);

  return JSON.stringify({
    [WORKSPACE_SETTINGS_MARKER]: true,
    description: currentMetadata.description,
    timezone: input.timezone ?? currentMetadata.timezone,
    logoUrl: input.logoUrl ?? currentMetadata.logoUrl,
  });
}

export function toWorkspaceSlug(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug;
}

function readWorkspaceMetadata(description: string) {
  const fallback = {
    description,
    timezone: DEFAULT_TIMEZONE,
    logoUrl: "",
  };

  try {
    const parsed = JSON.parse(description) as {
      [WORKSPACE_SETTINGS_MARKER]?: boolean;
      description?: unknown;
      timezone?: unknown;
      logoUrl?: unknown;
    };

    if (!parsed || parsed[WORKSPACE_SETTINGS_MARKER] !== true) {
      return fallback;
    }

    return {
      description: typeof parsed.description === "string" ? parsed.description : "",
      timezone: typeof parsed.timezone === "string" && parsed.timezone ? parsed.timezone : DEFAULT_TIMEZONE,
      logoUrl: typeof parsed.logoUrl === "string" ? parsed.logoUrl : "",
    };
  } catch {
    return fallback;
  }
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
