import type {
  DefectSeverity,
  DefectStatus,
  Priority,
  ProjectStatus,
  ResultStatus,
  RunStatus,
  TestCaseStatus,
} from "@/lib/domain/types";

export const projectStatusLabels: Record<ProjectStatus, string> = {
  active: "진행중",
  completed: "완료",
  archived: "보관됨",
};

export const priorityLabels: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const testCaseStatusLabels: Record<TestCaseStatus, string> = {
  ready: "Ready",
  draft: "Draft",
  deprecated: "Deprecated",
};

export const runStatusLabels: Record<RunStatus, string> = {
  planned: "예정",
  in_progress: "진행 중",
  paused: "일시정지",
  completed: "완료",
};

export const resultStatusLabels: Record<ResultStatus, string> = {
  pending: "Pending",
  passed: "Pass",
  failed: "Fail",
  blocked: "Block",
  skipped: "Skip",
};

export const defectStatusLabels: Record<DefectStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

export const defectSeverityLabels: Record<DefectSeverity, string> = {
  critical: "Critical",
  major: "Major",
  minor: "Minor",
  trivial: "Trivial",
};
