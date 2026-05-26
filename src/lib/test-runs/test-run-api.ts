import {
  ResultStatus as PrismaResultStatus,
  RunStatus as PrismaRunStatus,
  type TestRun as DbTestRun,
  type TestRunResult as DbTestRunResult,
} from "@prisma/client";
import type { ResultStatus, RunStatus, TestRun, TestRunResult } from "@/lib/domain/types";
import { prisma } from "@/lib/db/prisma";
import { mapTestCaseToDto, testCaseInclude } from "@/lib/testcases/testcase-api";

export type TestRunResultWithCase = DbTestRunResult & {
  testCase: Parameters<typeof mapTestCaseToDto>[0];
};

export type TestRunWithResults = DbTestRun & {
  results: TestRunResultWithCase[];
};

export type RunSummary = {
  total: number;
  pending: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  done: number;
  progress: number;
};

export type TestRunDto = TestRun & {
  databaseId: string;
  slug: string;
  projectId: string;
  summary: RunSummary;
  createdAt: string;
  updatedAt: string;
};

export type TestRunResultDto = TestRunResult & {
  databaseId: string;
  code: string;
  runDatabaseId: string;
  testCaseDatabaseId: string;
  createdAt: string;
  updatedAt: string;
};

const toDomainRunStatus: Record<PrismaRunStatus, RunStatus> = {
  PLANNED: "planned",
  IN_PROGRESS: "in_progress",
  PAUSED: "paused",
  COMPLETED: "completed",
};

const toDbRunStatusMap: Record<RunStatus, PrismaRunStatus> = {
  planned: "PLANNED",
  in_progress: "IN_PROGRESS",
  paused: "PAUSED",
  completed: "COMPLETED",
};

const toDomainResultStatus: Record<PrismaResultStatus, ResultStatus> = {
  PENDING: "pending",
  PASSED: "passed",
  FAILED: "failed",
  BLOCKED: "blocked",
  SKIPPED: "skipped",
};

const toDbResultStatusMap: Record<ResultStatus, PrismaResultStatus> = {
  pending: "PENDING",
  passed: "PASSED",
  failed: "FAILED",
  blocked: "BLOCKED",
  skipped: "SKIPPED",
};

export const testRunInclude = {
  results: {
    include: {
      testCase: {
        include: testCaseInclude,
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
};

export function mapRunToDto(run: TestRunWithResults): TestRunDto {
  return {
    databaseId: run.id,
    id: run.slug,
    slug: run.slug,
    projectId: run.projectId,
    title: run.title,
    description: run.description,
    assignee: run.assigneeName,
    environment: run.environment,
    startDate: formatDate(run.startDate),
    dueDate: formatDate(run.dueDate),
    status: toDomainRunStatus[run.status],
    createdLabel: formatRelativeDate(run.createdAt),
    results: run.results.map(mapResultToDto),
    summary: summarizeResults(run.results.map(mapResultToDto)),
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
}

export function mapResultToDto(result: TestRunResultWithCase): TestRunResultDto {
  return {
    databaseId: result.id,
    id: result.code,
    code: result.code,
    runDatabaseId: result.runId,
    testCaseDatabaseId: result.testCaseId,
    testCase: mapTestCaseToDto(result.testCase),
    status: toDomainResultStatus[result.status],
    actualResult: result.actualResult,
    defectCount: result.defectCount,
    createdAt: result.createdAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
  };
}

export function summarizeResults(results: TestRunResult[]) {
  const total = results.length;
  const pending = results.filter((result) => result.status === "pending").length;
  const passed = results.filter((result) => result.status === "passed").length;
  const failed = results.filter((result) => result.status === "failed").length;
  const blocked = results.filter((result) => result.status === "blocked").length;
  const skipped = results.filter((result) => result.status === "skipped").length;
  const done = total - pending;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  return { total, pending, passed, failed, blocked, skipped, done, progress };
}

export async function findRunByIdOrSlug(projectId: string, runId: string) {
  return prisma.testRun.findFirst({
    where: {
      projectId,
      deletedAt: null,
      OR: [{ id: runId }, { slug: runId }],
    },
    include: testRunInclude,
  });
}

export async function findRunResultByIdOrCode(runId: string, resultId: string) {
  return prisma.testRunResult.findFirst({
    where: {
      runId,
      OR: [{ id: resultId }, { code: resultId }],
    },
    include: {
      testCase: {
        include: testCaseInclude,
      },
    },
  });
}

export function parseRunStatus(value: unknown): RunStatus | null {
  if (
    value === "planned" ||
    value === "in_progress" ||
    value === "paused" ||
    value === "completed"
  ) {
    return value;
  }

  return null;
}

export function parseResultStatus(value: unknown): ResultStatus | null {
  if (
    value === "pending" ||
    value === "passed" ||
    value === "failed" ||
    value === "blocked" ||
    value === "skipped"
  ) {
    return value;
  }

  return null;
}

export function toDbRunStatus(status: RunStatus) {
  return toDbRunStatusMap[status];
}

export function toDbResultStatus(status: ResultStatus) {
  return toDbResultStatusMap[status];
}

export async function createUniqueRunSlug(projectId: string, input: string) {
  const baseSlug = toSlug(input);
  let slug = baseSlug;
  let suffix = 2;

  while (
    await prisma.testRun.findUnique({
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

export function toSlug(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `run-${Date.now()}`;
}

export function parseDateInput(value: unknown, fallback: Date) {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);

  return Number.isNaN(date.getTime()) ? fallback : date;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
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
