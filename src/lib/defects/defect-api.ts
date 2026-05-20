import {
  DefectSeverity as PrismaDefectSeverity,
  DefectStatus as PrismaDefectStatus,
  Priority as PrismaPriority,
  type Defect as DbDefect,
  type DefectLink as DbDefectLink,
  type TestRun as DbTestRun,
  type TestRunResult as DbTestRunResult,
} from "@prisma/client";
import type { Defect, DefectSeverity, DefectStatus, Priority } from "@/lib/domain/types";
import { prisma } from "@/lib/db/prisma";
import { ensureDefaultWorkspace, findProjectByIdOrSlug } from "@/lib/projects/project-api";
import { mapTestCaseToDto, testCaseInclude, type TestCaseWithSteps } from "@/lib/testcases/testcase-api";
import { mapResultToDto, type TestRunResultWithCase } from "@/lib/test-runs/test-run-api";

type DefectLinkWithRelations = DbDefectLink & {
  testCase: TestCaseWithSteps | null;
  testRunResult:
    | (DbTestRunResult & {
        run: DbTestRun;
        testCase: TestCaseWithSteps;
      })
    | null;
};

export type DefectWithLinks = DbDefect & {
  links: DefectLinkWithRelations[];
};

export type LinkedDefectTestCase = {
  id: string;
  title: string;
};

export type LinkedDefectResult = {
  id: string;
  runId: string;
  runTitle: string;
  status: string;
  testCaseId: string;
  testCaseTitle: string;
};

export type DefectDto = Defect & {
  databaseId: string;
  code: string;
  projectId: string;
  linkedTestCases: LinkedDefectTestCase[];
  linkedResults: LinkedDefectResult[];
  createdAtIso: string;
  updatedAtIso: string;
};

export const defectInclude = {
  links: {
    include: {
      testCase: {
        include: testCaseInclude,
      },
      testRunResult: {
        include: {
          run: true,
          testCase: {
            include: testCaseInclude,
          },
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
};

const toDomainStatus: Record<PrismaDefectStatus, DefectStatus> = {
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  RESOLVED: "resolved",
  CLOSED: "closed",
};

const toDbStatusMap: Record<DefectStatus, PrismaDefectStatus> = {
  open: "OPEN",
  in_progress: "IN_PROGRESS",
  resolved: "RESOLVED",
  closed: "CLOSED",
};

const toDomainSeverity: Record<PrismaDefectSeverity, DefectSeverity> = {
  CRITICAL: "critical",
  MAJOR: "major",
  MINOR: "minor",
  TRIVIAL: "trivial",
};

const toDbSeverityMap: Record<DefectSeverity, PrismaDefectSeverity> = {
  critical: "CRITICAL",
  major: "MAJOR",
  minor: "MINOR",
  trivial: "TRIVIAL",
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

export async function findProjectForDefectApi(projectId: string) {
  const workspace = await ensureDefaultWorkspace();
  return findProjectByIdOrSlug(workspace.id, projectId);
}

export function mapDefectToDto(defect: DefectWithLinks): DefectDto {
  const linkedTestCases = dedupeById([
    ...defect.links
      .map((link) => link.testCase)
      .filter((testCase): testCase is TestCaseWithSteps => Boolean(testCase))
      .map((testCase) => ({
        id: testCase.code,
        title: testCase.title,
      })),
    ...defect.links
      .map((link) => link.testRunResult?.testCase)
      .filter((testCase): testCase is TestCaseWithSteps => Boolean(testCase))
      .map((testCase) => ({
        id: testCase.code,
        title: testCase.title,
      })),
  ]);
  const linkedResults = defect.links
    .map((link) => link.testRunResult)
    .filter(
      (
        result,
      ): result is DbTestRunResult & {
        run: DbTestRun;
        testCase: TestCaseWithSteps;
      } => Boolean(result),
    )
    .map((result) => ({
      id: result.code,
      runId: result.run.slug,
      runTitle: result.run.title,
      status: result.status.toLowerCase(),
      testCaseId: result.testCase.code,
      testCaseTitle: result.testCase.title,
    }));
  const primaryTestCase = linkedTestCases[0];
  const primaryResult = linkedResults[0];

  return {
    databaseId: defect.id,
    id: defect.code,
    code: defect.code,
    projectId: defect.projectId,
    title: defect.title,
    description: defect.description,
    reproductionSteps: defect.reproductionSteps,
    checklist: defect.checklist,
    severity: toDomainSeverity[defect.severity],
    priority: toDomainPriority[defect.priority],
    status: toDomainStatus[defect.status],
    assignee: defect.assigneeName,
    reporter: defect.reporterName,
    createdAt: formatDate(defect.createdAt),
    updatedAt: formatDate(defect.updatedAt),
    linkedTestCaseId: primaryTestCase?.id ?? "",
    linkedTestCaseTitle: primaryTestCase?.title ?? "",
    linkedRunResultId: primaryResult?.id,
    attachmentCount: defect.attachmentCount,
    linkedTestCases,
    linkedResults,
    createdAtIso: defect.createdAt.toISOString(),
    updatedAtIso: defect.updatedAt.toISOString(),
  };
}

export function parseDefectStatus(value: unknown): DefectStatus | null {
  if (
    value === "open" ||
    value === "in_progress" ||
    value === "resolved" ||
    value === "closed"
  ) {
    return value;
  }

  return null;
}

export function parseDefectSeverity(value: unknown): DefectSeverity | null {
  if (
    value === "critical" ||
    value === "major" ||
    value === "minor" ||
    value === "trivial"
  ) {
    return value;
  }

  return null;
}

export function parsePriority(value: unknown): Priority | null {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }

  return null;
}

export function toDbDefectStatus(status: DefectStatus) {
  return toDbStatusMap[status];
}

export function toDbDefectSeverity(severity: DefectSeverity) {
  return toDbSeverityMap[severity];
}

export function toDbPriority(priority: Priority) {
  return toDbPriorityMap[priority];
}

export async function createNextDefectCode(projectId: string) {
  const defects = await prisma.defect.findMany({
    where: { projectId },
    select: { code: true },
  });
  const maxNumber = defects.reduce((max, defect) => {
    const match = defect.code.match(/^BUG-(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return `BUG-${String(maxNumber + 1).padStart(3, "0")}`;
}

export async function findDefectByIdOrCode(projectId: string, defectId: string) {
  return prisma.defect.findFirst({
    where: {
      projectId,
      deletedAt: null,
      OR: [{ id: defectId }, { code: defectId }],
    },
    include: defectInclude,
  });
}

export async function resolveTestCaseIds(projectId: string, testCaseIds: string[]) {
  if (testCaseIds.length === 0) {
    return [];
  }

  const testCases = await prisma.testCase.findMany({
    where: {
      projectId,
      deletedAt: null,
      OR: [{ id: { in: testCaseIds } }, { code: { in: testCaseIds } }],
    },
    select: { id: true },
  });

  if (testCases.length !== new Set(testCaseIds).size) {
    return null;
  }

  return testCases.map((testCase) => testCase.id);
}

export async function resolveResultIds(projectId: string, resultIds: string[]) {
  if (resultIds.length === 0) {
    return [];
  }

  const results = await prisma.testRunResult.findMany({
    where: {
      run: {
        projectId,
        deletedAt: null,
      },
      OR: [{ id: { in: resultIds } }, { code: { in: resultIds } }],
    },
    select: { id: true },
  });

  if (results.length !== new Set(resultIds).size) {
    return null;
  }

  return results.map((result) => result.id);
}

export async function replaceDefectLinks(
  defectId: string,
  testCaseIds: string[],
  testRunResultIds: string[],
) {
  await prisma.defectLink.deleteMany({
    where: { defectId },
  });

  const data = [
    ...testCaseIds.map((testCaseId) => ({
      defectId,
      testCaseId,
    })),
    ...testRunResultIds.map((testRunResultId) => ({
      defectId,
      testRunResultId,
    })),
  ];

  if (data.length === 0) {
    return;
  }

  await prisma.defectLink.createMany({ data });
}

export async function refreshResultDefectCounts(testRunResultIds: string[]) {
  for (const resultId of Array.from(new Set(testRunResultIds))) {
    const defectCount = await prisma.defectLink.count({
      where: {
        testRunResultId: resultId,
        defect: {
          deletedAt: null,
        },
      },
    });

    await prisma.testRunResult.update({
      where: { id: resultId },
      data: { defectCount },
    });
  }
}

export function mapResultForDefectDialog(result: TestRunResultWithCase) {
  return mapResultToDto(result);
}

export function mapTestCaseForDefect(testCase: TestCaseWithSteps) {
  return mapTestCaseToDto(testCase);
}

function dedupeById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
