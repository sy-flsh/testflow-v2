import { ProjectStatus as PrismaProjectStatus, type Project as DbProject } from "@prisma/client";
import type { Project, ProjectStatus } from "@/lib/domain/types";
import { prisma } from "@/lib/db/prisma";

export const DEFAULT_WORKSPACE_SLUG = "testflow-qa";

export type ProjectDto = Project & {
  databaseId: string;
  slug: string;
  workspaceId: string;
  runCount: number;
  defectCount: number;
  createdAt: string;
  updatedAt: string;
};

const toDomainStatus: Record<PrismaProjectStatus, ProjectStatus> = {
  ACTIVE: "active",
  COMPLETED: "completed",
  ARCHIVED: "archived",
};

const toPrismaStatus: Record<ProjectStatus, PrismaProjectStatus> = {
  active: "ACTIVE",
  completed: "COMPLETED",
  archived: "ARCHIVED",
};

export function mapProjectToDto(project: DbProject): ProjectDto {
  return {
    databaseId: project.id,
    id: project.slug,
    slug: project.slug,
    workspaceId: project.workspaceId,
    name: project.name,
    description: project.description,
    color: project.color,
    status: toDomainStatus[project.status],
    progress: 0,
    testCaseCount: 0,
    runCount: 0,
    defectCount: 0,
    passCount: 0,
    failCount: 0,
    members: ["김", "박", "이"],
    updatedAtLabel: formatRelativeDate(project.updatedAt),
    createdAtOrder: project.createdAt.getTime(),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

export function parseProjectStatus(value: unknown): ProjectStatus | null {
  if (value === "active" || value === "completed" || value === "archived") {
    return value;
  }

  return null;
}

export function toDbProjectStatus(status: ProjectStatus) {
  return toPrismaStatus[status];
}

export async function ensureDefaultWorkspace() {
  const existingWorkspace = await prisma.workspace.findUnique({
    where: { slug: DEFAULT_WORKSPACE_SLUG },
  });

  if (existingWorkspace) {
    return existingWorkspace;
  }

  const currentWorkspace = await prisma.workspace.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (currentWorkspace) {
    return currentWorkspace;
  }

  const user = await prisma.user.upsert({
    where: { email: "qa.lead@testflow.local" },
    update: { name: "김QA" },
    create: {
      email: "qa.lead@testflow.local",
      name: "김QA",
    },
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: "TestFlow QA",
      slug: DEFAULT_WORKSPACE_SLUG,
      description: "TestFlow v2 기본 워크스페이스",
    },
  });

  await prisma.workspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  return workspace;
}

export async function findProjectByIdOrSlug(workspaceId: string, projectId: string) {
  return prisma.project.findFirst({
    where: {
      workspaceId,
      OR: [{ id: projectId }, { slug: projectId }],
    },
  });
}

export async function createUniqueProjectSlug(workspaceId: string, input: string) {
  const baseSlug = toProjectSlug(input);
  let slug = baseSlug;
  let suffix = 2;

  while (
    await prisma.project.findUnique({
      where: {
        workspaceId_slug: {
          workspaceId,
          slug,
        },
      },
    })
  ) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

export async function isProjectSlugAvailable(
  workspaceId: string,
  slug: string,
  exceptProjectId?: string,
) {
  const project = await prisma.project.findUnique({
    where: {
      workspaceId_slug: {
        workspaceId,
        slug,
      },
    },
  });

  return !project || project.id === exceptProjectId;
}

export function toProjectSlug(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `project-${Date.now()}`;
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

  const diffDays = Math.floor(diffHours / 24);

  return `${diffDays}일 전`;
}
