import type {
  DefectSeverity as PrismaDefectSeverity,
  DefectStatus as PrismaDefectStatus,
  Priority as PrismaPriority,
  ResultStatus as PrismaResultStatus,
  RunStatus as PrismaRunStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type {
  DailyResultSummary,
  DefectStatusCounts,
  DefectTrendSummary,
  GroupedResultSummary,
  ResultCounts,
  TopFailedTestCase,
} from "@/lib/domain/summary";
import type { Priority, ResultStatus, RunStatus } from "@/lib/domain/types";

const resultRatioColors = {
  passed: "#10B981",
  failed: "#EF4444",
  blocked: "#F59E0B",
  skipped: "#64748B",
};

const toDomainResultStatus: Record<PrismaResultStatus, ResultStatus> = {
  PENDING: "pending",
  PASSED: "passed",
  FAILED: "failed",
  BLOCKED: "blocked",
  SKIPPED: "skipped",
};

const toDomainRunStatus: Record<PrismaRunStatus, RunStatus> = {
  PLANNED: "planned",
  IN_PROGRESS: "in_progress",
  PAUSED: "paused",
  COMPLETED: "completed",
};

const toDomainPriority: Record<PrismaPriority, Priority> = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
};

type ResultRow = {
  id: string;
  code: string;
  status: PrismaResultStatus;
  defectCount: number;
  updatedAt: Date;
  run: {
    id: string;
    slug: string;
    title: string;
    assigneeName: string;
    environment: string;
    startDate: Date;
    updatedAt: Date;
  };
  testCase: {
    id: string;
    code: string;
    title: string;
    priority: PrismaPriority;
    folder: {
      id: string;
      name: string;
    };
  };
};

type DefectRow = {
  id: string;
  code: string;
  title: string;
  status: PrismaDefectStatus;
  severity: PrismaDefectSeverity;
  createdAt: Date;
  updatedAt: Date;
  links: Array<{
    testCaseId: string | null;
    testRunResultId: string | null;
  }>;
};

export type DashboardSummaryResponse = {
  counts: {
    projects: number;
    testCases: number;
    testRuns: number;
    executingRuns: number;
    executedResults: number;
    defects: number;
  };
  resultCounts: ResultCounts;
  passRate: number;
  dailyResults: DailyResultSummary[];
  activeProjects: Array<{
    id: string;
    name: string;
    color: string;
    progress: number;
    updatedAtLabel: string;
    testCaseCount: number;
  }>;
  recentRuns: Array<{
    id: string;
    projectId: string;
    title: string;
    status: RunStatus;
    assignee: string;
    environment: string;
    resultCount: number;
  }>;
  recentDefects: Array<{
    id: string;
    title: string;
    status: "open" | "in_progress" | "resolved" | "closed";
    linkedTestCaseId: string;
  }>;
};

export type ProjectReportSummaryResponse = {
  filters: {
    plans: string[];
    assignees: string[];
    environments: string[];
  };
  kpis: {
    totalResults: number;
    passRate: number;
    defectCount: number;
    criticalDefectCount: number;
    averageExecutionTimeLabel: string;
  };
  resultCounts: ResultCounts;
  resultRatio: Array<{ label: string; value: number; color: string }>;
  dailyTrends: DailyResultSummary[];
  assigneeResults: GroupedResultSummary[];
  categoryResults: GroupedResultSummary[];
  defectStatusCounts: DefectStatusCounts;
  defectTrend: DefectTrendSummary[];
  topFailedCases: TopFailedTestCase[];
  hasData: boolean;
  fallbackNotes: string[];
};

export type ReportFilterInput = {
  period?: string;
  plan?: string;
  assignee?: string;
  environment?: string;
};

export async function getDashboardSummary(workspaceId: string): Promise<DashboardSummaryResponse> {
  const [projects, testCaseCount, testRunCount, executingRuns, results, defectCount, recentDefects] =
    await Promise.all([
      prisma.project.findMany({
        where: { workspaceId },
        select: {
          id: true,
          slug: true,
          name: true,
          color: true,
          status: true,
          updatedAt: true,
          testCases: {
            where: { deletedAt: null },
            select: { id: true },
          },
          testRuns: {
            where: { deletedAt: null },
            select: {
              results: {
                select: { status: true },
              },
            },
          },
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      }),
      prisma.testCase.count({
        where: {
          deletedAt: null,
          project: { workspaceId },
        },
      }),
      prisma.testRun.count({
        where: {
          deletedAt: null,
          project: { workspaceId },
        },
      }),
      prisma.testRun.count({
        where: {
          deletedAt: null,
          status: "IN_PROGRESS",
          project: { workspaceId },
        },
      }),
      prisma.testRunResult.findMany({
        where: {
          run: {
            deletedAt: null,
            project: { workspaceId },
          },
        },
        select: {
          id: true,
          status: true,
          run: {
            select: {
              startDate: true,
            },
          },
        },
      }),
      prisma.defect.count({
        where: {
          deletedAt: null,
          project: { workspaceId },
        },
      }),
      prisma.defect.findMany({
        where: {
          deletedAt: null,
          project: { workspaceId },
        },
        select: {
          code: true,
          title: true,
          status: true,
          updatedAt: true,
          links: {
            select: {
              testCase: {
                select: { code: true },
              },
              testRunResult: {
                select: {
                  testCase: {
                    select: { code: true },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        take: 3,
      }),
    ]);

  const resultCounts = countPrismaResults(results.map((result) => result.status));
  const executedResults = countExecutedResults(resultCounts);
  const recentRuns = await prisma.testRun.findMany({
    where: {
      deletedAt: null,
      project: { workspaceId },
    },
    select: {
      slug: true,
      title: true,
      status: true,
      assigneeName: true,
      environment: true,
      project: { select: { slug: true } },
      results: { select: { id: true } },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: 3,
  });

  return {
    counts: {
      projects: projects.length,
      testCases: testCaseCount,
      testRuns: testRunCount,
      executingRuns,
      executedResults,
      defects: defectCount,
    },
    resultCounts,
    passRate: calculatePassRate(resultCounts),
    dailyResults: summarizeResultsByDate(
      results.map((result) => ({
        status: result.status,
        date: result.run.startDate,
      })),
    ),
    activeProjects: projects
      .filter((project) => project.status === "ACTIVE")
      .slice(0, 4)
      .map((project) => {
        const projectResultCounts = countPrismaResults(
          project.testRuns.flatMap((run) => run.results.map((result) => result.status)),
        );

        return {
          id: project.slug,
          name: project.name,
          color: project.color,
          progress: calculateProgress(projectResultCounts),
          updatedAtLabel: formatRelativeDate(project.updatedAt),
          testCaseCount: project.testCases.length,
        };
      }),
    recentRuns: recentRuns.map((run) => ({
      id: run.slug,
      projectId: run.project.slug,
      title: run.title,
      status: toDomainRunStatus[run.status],
      assignee: run.assigneeName,
      environment: run.environment,
      resultCount: run.results.length,
    })),
    recentDefects: recentDefects.map((defect) => ({
      id: defect.code,
      title: defect.title,
      status: defect.status.toLowerCase() as DashboardSummaryResponse["recentDefects"][number]["status"],
      linkedTestCaseId:
        defect.links[0]?.testCase?.code ?? defect.links[0]?.testRunResult?.testCase.code ?? "",
    })),
  };
}

export async function getProjectReportSummary(
  projectId: string,
  filter: ReportFilterInput,
): Promise<ProjectReportSummaryResponse> {
  const allRuns = await prisma.testRun.findMany({
    where: {
      projectId,
      deletedAt: null,
    },
    select: {
      title: true,
      assigneeName: true,
      environment: true,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });
  const where = buildRunWhere(projectId, filter);
  const results = await prisma.testRunResult.findMany({
    where: {
      run: where,
    },
    select: {
      id: true,
      code: true,
      status: true,
      defectCount: true,
      updatedAt: true,
      run: {
        select: {
          id: true,
          slug: true,
          title: true,
          assigneeName: true,
          environment: true,
          startDate: true,
          updatedAt: true,
        },
      },
      testCase: {
        select: {
          id: true,
          code: true,
          title: true,
          priority: true,
          folder: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
  const defects = await prisma.defect.findMany({
    where: {
      projectId,
      deletedAt: null,
    },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      severity: true,
      createdAt: true,
      updatedAt: true,
      links: {
        select: {
          testCaseId: true,
          testRunResultId: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });
  const filteredDefects = filterDefectsByResults(defects, results, filter);
  const resultCounts = countPrismaResults(results.map((result) => result.status));

  return {
    filters: {
      plans: ["전체 플랜", ...Array.from(new Set(allRuns.map((run) => run.title)))],
      assignees: ["전체 담당자", ...Array.from(new Set(allRuns.map((run) => run.assigneeName)))],
      environments: ["전체 환경", ...Array.from(new Set(allRuns.map((run) => run.environment)))],
    },
    kpis: {
      totalResults: results.length,
      passRate: calculatePassRate(resultCounts),
      defectCount: filteredDefects.length,
      criticalDefectCount: filteredDefects.filter((defect) => defect.severity === "CRITICAL").length,
      averageExecutionTimeLabel: "4분 18초",
    },
    resultCounts,
    resultRatio: [
      { label: "Pass", value: resultCounts.passed, color: resultRatioColors.passed },
      { label: "Fail", value: resultCounts.failed, color: resultRatioColors.failed },
      { label: "Block", value: resultCounts.blocked, color: resultRatioColors.blocked },
      { label: "Skip", value: resultCounts.skipped, color: resultRatioColors.skipped },
    ],
    dailyTrends: summarizeResultsByDate(
      results.map((result) => ({
        status: result.status,
        date: result.run.startDate,
      })),
    ),
    assigneeResults: summarizeByField(results, (result) => result.run.assigneeName),
    categoryResults: summarizeByField(results, (result) => result.testCase.folder.name),
    defectStatusCounts: countDefectsByStatus(filteredDefects),
    defectTrend: summarizeDefectsByDate(filteredDefects),
    topFailedCases: summarizeTopFailedCases(results, filteredDefects),
    hasData: results.length > 0,
    fallbackNotes: ["평균 실행 시간은 실측 duration 필드가 없어 임시 표시값을 유지합니다."],
  };
}

function buildRunWhere(projectId: string, filter: ReportFilterInput) {
  const startDate = getPeriodStartDate(filter.period);

  return {
    projectId,
    deletedAt: null,
    ...(filter.plan && filter.plan !== "전체 플랜" ? { title: filter.plan } : {}),
    ...(filter.assignee && filter.assignee !== "전체 담당자"
      ? { assigneeName: filter.assignee }
      : {}),
    ...(filter.environment && filter.environment !== "전체 환경"
      ? { environment: filter.environment }
      : {}),
    ...(startDate ? { startDate: { gte: startDate } } : {}),
  };
}

function getPeriodStartDate(period?: string) {
  const days = period === "14d" ? 14 : period === "30d" ? 30 : period === "7d" ? 7 : null;

  if (!days) {
    return null;
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days + 1);

  return start;
}

function filterDefectsByResults(defects: DefectRow[], results: ResultRow[], filter: ReportFilterInput) {
  const hasRunFilter =
    (filter.plan && filter.plan !== "전체 플랜") ||
    (filter.assignee && filter.assignee !== "전체 담당자") ||
    (filter.environment && filter.environment !== "전체 환경");

  if (!hasRunFilter) {
    return defects;
  }

  const resultIds = new Set(results.map((result) => result.id));
  const testCaseIds = new Set(results.map((result) => result.testCase.id));

  return defects.filter((defect) => {
    if (resultIds.size === 0) {
      return false;
    }

    return defect.links.some(
      (link) =>
        (link.testRunResultId && resultIds.has(link.testRunResultId)) ||
        (link.testCaseId && testCaseIds.has(link.testCaseId)),
    );
  });
}

function countPrismaResults(statuses: PrismaResultStatus[]): ResultCounts {
  return statuses.reduce<ResultCounts>(
    (counts, status) => {
      const domainStatus = toDomainResultStatus[status];
      counts[domainStatus] += 1;
      return counts;
    },
    { pending: 0, passed: 0, failed: 0, blocked: 0, skipped: 0 },
  );
}

function countDefectsByStatus(defects: DefectRow[]): DefectStatusCounts {
  return defects.reduce<DefectStatusCounts>(
    (counts, defect) => {
      if (defect.status === "OPEN") {
        counts.open += 1;
      }
      if (defect.status === "IN_PROGRESS") {
        counts.in_progress += 1;
      }
      if (defect.status === "RESOLVED") {
        counts.resolved += 1;
      }
      if (defect.status === "CLOSED") {
        counts.closed += 1;
      }
      return counts;
    },
    { open: 0, in_progress: 0, resolved: 0, closed: 0 },
  );
}

function countExecutedResults(counts: ResultCounts) {
  return counts.passed + counts.failed + counts.blocked + counts.skipped;
}

function calculatePassRate(counts: ResultCounts) {
  const executed = countExecutedResults(counts);

  return executed > 0 ? Math.round((counts.passed / executed) * 100) : 0;
}

function calculateProgress(counts: ResultCounts) {
  const total = counts.pending + countExecutedResults(counts);

  return total > 0 ? Math.round((countExecutedResults(counts) / total) * 100) : 0;
}

function summarizeResultsByDate(items: Array<{ status: PrismaResultStatus; date: Date }>) {
  const grouped = new Map<string, DailyResultSummary>();

  for (const item of items) {
    const date = formatDateLabel(item.date);
    const current = grouped.get(date) ?? { date, total: 0, passed: 0, failed: 0, blocked: 0, skipped: 0 };
    const status = toDomainResultStatus[item.status];
    current.total += 1;

    if (status !== "pending") {
      current[status] += 1;
    }

    grouped.set(date, current);
  }

  return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
}

function summarizeByField(results: ResultRow[], getName: (result: ResultRow) => string) {
  const grouped = new Map<string, GroupedResultSummary>();

  for (const result of results) {
    const name = getName(result);
    const current = grouped.get(name) ?? { name, pass: 0, fail: 0, block: 0, skip: 0 };
    const status = toDomainResultStatus[result.status];

    if (status === "passed") {
      current.pass += 1;
    } else if (status === "failed") {
      current.fail += 1;
    } else if (status === "blocked") {
      current.block += 1;
    } else if (status === "skipped") {
      current.skip += 1;
    }

    grouped.set(name, current);
  }

  return Array.from(grouped.values()).sort(
    (a, b) => b.pass + b.fail + b.block + b.skip - (a.pass + a.fail + a.block + a.skip),
  );
}

function summarizeDefectsByDate(defects: DefectRow[]) {
  const grouped = new Map<string, DefectTrendSummary>();

  for (const defect of defects) {
    const date = formatDateLabel(defect.createdAt);
    const current = grouped.get(date) ?? { date, open: 0, resolved: 0 };

    if (defect.status === "RESOLVED" || defect.status === "CLOSED") {
      current.resolved += 1;
    } else {
      current.open += 1;
    }

    grouped.set(date, current);
  }

  return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
}

function summarizeTopFailedCases(results: ResultRow[], defects: DefectRow[]) {
  const defectCountsByCase = countLinkedDefectsByTestCase(defects, results);
  const grouped = new Map<string, TopFailedTestCase>();

  for (const result of results) {
    const status = toDomainResultStatus[result.status];

    if (status !== "failed" && status !== "blocked") {
      continue;
    }

    const testCase = result.testCase;
    const current =
      grouped.get(testCase.id) ??
      ({
        id: testCase.code,
        title: testCase.title,
        folder: testCase.folder.name,
        priority: toDomainPriority[testCase.priority],
        failCount: 0,
        blockCount: 0,
        linkedDefects: defectCountsByCase.get(testCase.id) ?? 0,
        lastFailedAt: formatDate(result.updatedAt),
      } satisfies TopFailedTestCase);

    if (status === "failed") {
      current.failCount += 1;
    }

    if (status === "blocked") {
      current.blockCount += 1;
    }

    if (result.updatedAt.toISOString().slice(0, 10) > current.lastFailedAt) {
      current.lastFailedAt = formatDate(result.updatedAt);
    }

    grouped.set(testCase.id, current);
  }

  return Array.from(grouped.values())
    .sort((a, b) => b.failCount + b.blockCount - (a.failCount + a.blockCount))
    .slice(0, 6);
}

function countLinkedDefectsByTestCase(defects: DefectRow[], results: ResultRow[]) {
  const resultToTestCase = new Map(results.map((result) => [result.id, result.testCase.id]));
  const counts = new Map<string, number>();

  for (const defect of defects) {
    const linkedCaseIds = new Set<string>();

    for (const link of defect.links) {
      if (link.testCaseId) {
        linkedCaseIds.add(link.testCaseId);
      }
      if (link.testRunResultId) {
        const testCaseId = resultToTestCase.get(link.testRunResultId);
        if (testCaseId) {
          linkedCaseIds.add(testCaseId);
        }
      }
    }

    for (const testCaseId of linkedCaseIds) {
      counts.set(testCaseId, (counts.get(testCaseId) ?? 0) + 1);
    }
  }

  return counts;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(date: Date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return `${month}/${day}`;
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
