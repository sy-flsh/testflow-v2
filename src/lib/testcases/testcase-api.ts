import {
  Priority as PrismaPriority,
  TestCaseStatus as PrismaTestCaseStatus,
  type TestCase as DbTestCase,
  type TestFolder as DbTestFolder,
  type TestStep as DbTestStep,
} from "@prisma/client";
import type { Priority, TestCase, TestCaseStatus, TestFolder } from "@/lib/domain/types";
import { prisma } from "@/lib/db/prisma";
import { ensureDefaultWorkspace, findProjectByIdOrSlug } from "@/lib/projects/project-api";

export type TestCaseWithSteps = DbTestCase & {
  steps: DbTestStep[];
  folder: DbTestFolder;
};

export type TestCaseDto = TestCase & {
  databaseId: string;
  code: string;
  projectId: string;
  folderDatabaseId: string;
  createdAt: string;
  updatedAt: string;
};

export type TestFolderDto = TestFolder & {
  databaseId: string;
  projectId: string;
  slug: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

const toDomainPriority: Record<PrismaPriority, Priority> = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
};

const toDbPriorityMap: Record<Priority, PrismaPriority> = {
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
};

const toDomainStatus: Record<PrismaTestCaseStatus, TestCaseStatus> = {
  READY: "ready",
  DRAFT: "draft",
  DEPRECATED: "deprecated",
};

const toDbStatusMap: Record<TestCaseStatus, PrismaTestCaseStatus> = {
  ready: "READY",
  draft: "DRAFT",
  deprecated: "DEPRECATED",
};

export async function findProjectForTestCaseApi(projectId: string) {
  const workspace = await ensureDefaultWorkspace();
  return findProjectByIdOrSlug(workspace.id, projectId);
}

export function mapFolderToDto(folder: DbTestFolder): TestFolderDto {
  return {
    databaseId: folder.id,
    id: folder.slug,
    projectId: folder.projectId,
    slug: folder.slug,
    label: folder.name,
    parentId: folder.parentId ?? undefined,
    sortOrder: folder.sortOrder,
    createdAt: folder.createdAt.toISOString(),
    updatedAt: folder.updatedAt.toISOString(),
  };
}

export function mapFoldersToDto(folders: DbTestFolder[]) {
  const slugById = new Map(folders.map((folder) => [folder.id, folder.slug]));

  return folders.map((folder) => ({
    ...mapFolderToDto(folder),
    parentId: folder.parentId ? slugById.get(folder.parentId) : undefined,
  }));
}

export function mapTestCaseToDto(testCase: TestCaseWithSteps): TestCaseDto {
  return {
    databaseId: testCase.id,
    id: testCase.code,
    code: testCase.code,
    projectId: testCase.projectId,
    title: testCase.title,
    priority: toDomainPriority[testCase.priority],
    status: toDomainStatus[testCase.status],
    folderId: testCase.folder.slug,
    folderDatabaseId: testCase.folderId,
    tags: testCase.tags,
    author: testCase.authorName,
    updatedAtLabel: formatRelativeDate(testCase.updatedAt),
    description: testCase.description,
    preconditions: testCase.preconditions,
    steps: testCase.steps
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((step) => step.action),
    expectedResult: testCase.expectedResult,
    createdAt: testCase.createdAt.toISOString(),
    updatedAt: testCase.updatedAt.toISOString(),
  };
}

export function parsePriority(value: unknown): Priority | null {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }

  return null;
}

export function parseTestCaseStatus(value: unknown): TestCaseStatus | null {
  if (value === "ready" || value === "draft" || value === "deprecated") {
    return value;
  }

  return null;
}

export function toDbPriority(priority: Priority) {
  return toDbPriorityMap[priority];
}

export function toDbTestCaseStatus(status: TestCaseStatus) {
  return toDbStatusMap[status];
}

export async function findFolderByIdOrSlug(projectId: string, folderId: string) {
  return prisma.testFolder.findFirst({
    where: {
      projectId,
      deletedAt: null,
      OR: [{ id: folderId }, { slug: folderId }],
    },
  });
}

export async function findTestCaseByIdOrCode(projectId: string, testCaseId: string) {
  return prisma.testCase.findFirst({
    where: {
      projectId,
      deletedAt: null,
      OR: [{ id: testCaseId }, { code: testCaseId }],
    },
    include: testCaseInclude,
  });
}

export const testCaseInclude = {
  folder: true,
  steps: {
    orderBy: { order: "asc" as const },
  },
};

export async function createUniqueFolderSlug(projectId: string, input: string) {
  const baseSlug = toSlug(input);
  let slug = baseSlug;
  let suffix = 2;

  while (
    await prisma.testFolder.findUnique({
      where: {
        projectId_slug: {
          projectId,
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

export async function createNextTestCaseCode(projectId: string) {
  const testCases = await prisma.testCase.findMany({
    where: { projectId },
    select: { code: true },
  });

  const maxNumber = testCases.reduce((max, testCase) => {
    const match = testCase.code.match(/^TC-(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return `TC-${String(maxNumber + 1).padStart(3, "0")}`;
}

export async function replaceTestSteps(testCaseId: string, steps: string[]) {
  await prisma.testStep.deleteMany({
    where: { testCaseId },
  });

  if (steps.length === 0) {
    return;
  }

  await prisma.testStep.createMany({
    data: steps.map((step, index) => ({
      testCaseId,
      order: index + 1,
      action: step,
    })),
  });
}

export function toSlug(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `item-${Date.now()}`;
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
