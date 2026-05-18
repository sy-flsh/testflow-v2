import type {
  Defect,
  DefectStatus,
  ResultStatus,
  TestFolder,
  TestRun,
  TestRunResult,
} from "@/lib/domain/types";

export type ResultCounts = Record<ResultStatus, number>;
export type DefectStatusCounts = Record<DefectStatus, number>;

export type DailyResultSummary = {
  date: string;
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
};

export type GroupedResultSummary = {
  name: string;
  pass: number;
  fail: number;
  block: number;
  skip: number;
};

export type TopFailedTestCase = {
  id: string;
  title: string;
  folder: string;
  failCount: number;
  blockCount: number;
  linkedDefects: number;
  priority: TestRunResult["testCase"]["priority"];
  lastFailedAt: string;
};

export type DefectTrendSummary = {
  date: string;
  open: number;
  resolved: number;
};

export const emptyResultCounts: ResultCounts = {
  pending: 0,
  passed: 0,
  failed: 0,
  blocked: 0,
  skipped: 0,
};

export const emptyDefectStatusCounts: DefectStatusCounts = {
  open: 0,
  in_progress: 0,
  resolved: 0,
  closed: 0,
};

export function flattenRunResults(runs: TestRun[]) {
  return runs.flatMap((run) => run.results);
}

export function countResults(results: TestRunResult[]): ResultCounts {
  return results.reduce<ResultCounts>(
    (counts, result) => ({
      ...counts,
      [result.status]: counts[result.status] + 1,
    }),
    { ...emptyResultCounts },
  );
}

export function countDefectsByStatus(defects: Defect[]): DefectStatusCounts {
  return defects.reduce<DefectStatusCounts>(
    (counts, defect) => ({
      ...counts,
      [defect.status]: counts[defect.status] + 1,
    }),
    { ...emptyDefectStatusCounts },
  );
}

export function countExecutedResults(results: TestRunResult[]) {
  return results.filter((result) => result.status !== "pending").length;
}

export function calculatePassRate(results: TestRunResult[]) {
  const executed = countExecutedResults(results);
  if (executed === 0) {
    return 0;
  }

  return Math.round((results.filter((result) => result.status === "passed").length / executed) * 100);
}

export function summarizeByRunDate(runs: TestRun[]): DailyResultSummary[] {
  const grouped = new Map<string, DailyResultSummary>();

  runs.forEach((run) => {
    const key = formatDateLabel(run.startDate);
    const current = grouped.get(key) ?? {
      date: key,
      total: 0,
      passed: 0,
      failed: 0,
      blocked: 0,
      skipped: 0,
    };

    run.results.forEach((result) => addResultToDailySummary(current, result.status));

    grouped.set(key, current);
  });

  return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function summarizeByAssignee(runs: TestRun[]): GroupedResultSummary[] {
  const grouped = new Map<string, GroupedResultSummary>();

  runs.forEach((run) => {
    const current = grouped.get(run.assignee) ?? createGroupedResultSummary(run.assignee);
    run.results.forEach((result) => addResultToGroup(current, result.status));
    grouped.set(run.assignee, current);
  });

  return Array.from(grouped.values());
}

export function summarizeByFolder(results: TestRunResult[], folders: TestFolder[]): GroupedResultSummary[] {
  const folderLabels = new Map(folders.map((folder) => [folder.id, folder.label]));
  const grouped = new Map<string, GroupedResultSummary>();

  results.forEach((result) => {
    const name = folderLabels.get(result.testCase.folderId) ?? result.testCase.folderId;
    const current = grouped.get(name) ?? createGroupedResultSummary(name);
    addResultToGroup(current, result.status);
    grouped.set(name, current);
  });

  return Array.from(grouped.values()).sort(
    (a, b) => b.fail + b.block + b.pass + b.skip - (a.fail + a.block + a.pass + a.skip),
  );
}

export function summarizeTopFailedTestCases(
  runs: TestRun[],
  defects: Defect[],
  folders: TestFolder[],
  limit = 5,
): TopFailedTestCase[] {
  const folderLabels = new Map(folders.map((folder) => [folder.id, folder.label]));
  const defectCounts = defects.reduce<Record<string, number>>((counts, defect) => {
    counts[defect.linkedTestCaseId] = (counts[defect.linkedTestCaseId] ?? 0) + 1;
    return counts;
  }, {});
  const grouped = new Map<string, TopFailedTestCase>();

  runs.forEach((run) => {
    run.results.forEach((result) => {
      if (result.status !== "failed" && result.status !== "blocked") {
        return;
      }

      const current = grouped.get(result.testCase.id) ?? {
        id: result.testCase.id,
        title: result.testCase.title,
        folder: folderLabels.get(result.testCase.folderId) ?? result.testCase.folderId,
        failCount: 0,
        blockCount: 0,
        linkedDefects: defectCounts[result.testCase.id] ?? 0,
        priority: result.testCase.priority,
        lastFailedAt: run.startDate,
      };

      if (result.status === "failed") {
        current.failCount += 1;
      }

      if (result.status === "blocked") {
        current.blockCount += 1;
      }

      if (run.startDate > current.lastFailedAt) {
        current.lastFailedAt = run.startDate;
      }

      grouped.set(result.testCase.id, current);
    });
  });

  return Array.from(grouped.values())
    .sort((a, b) => b.failCount + b.blockCount - (a.failCount + a.blockCount))
    .slice(0, limit);
}

export function summarizeDefectTrend(defects: Defect[]): DefectTrendSummary[] {
  const grouped = new Map<string, DefectTrendSummary>();

  defects.forEach((defect) => {
    const key = formatDateLabel(defect.createdAt);
    const current = grouped.get(key) ?? { date: key, open: 0, resolved: 0 };

    if (defect.status === "resolved" || defect.status === "closed") {
      current.resolved += 1;
    } else {
      current.open += 1;
    }

    grouped.set(key, current);
  });

  return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function formatDateLabel(date: string) {
  const [, month, day] = date.split("-");
  return month && day ? `${month}/${day}` : date;
}

function createGroupedResultSummary(name: string): GroupedResultSummary {
  return { name, pass: 0, fail: 0, block: 0, skip: 0 };
}

function addResultToGroup(group: GroupedResultSummary, status: ResultStatus) {
  if (status === "passed") {
    group.pass += 1;
  }
  if (status === "failed") {
    group.fail += 1;
  }
  if (status === "blocked") {
    group.block += 1;
  }
  if (status === "skipped") {
    group.skip += 1;
  }
}

function addResultToDailySummary(summary: DailyResultSummary, status: ResultStatus) {
  if (status === "pending") {
    return;
  }

  summary.total += 1;
  if (status === "passed") {
    summary.passed += 1;
  }
  if (status === "failed") {
    summary.failed += 1;
  }
  if (status === "blocked") {
    summary.blocked += 1;
  }
  if (status === "skipped") {
    summary.skipped += 1;
  }
}
