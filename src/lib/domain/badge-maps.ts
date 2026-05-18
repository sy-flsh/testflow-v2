import type {
  DefectSeverity,
  DefectStatus,
  Priority,
  ResultStatus,
  RunStatus,
} from "@/lib/domain/types";

export const resultStatusBadgeStyles: Record<ResultStatus, string> = {
  pending: "bg-slate-100 text-slate-600 ring-slate-200",
  passed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  failed: "bg-red-50 text-red-700 ring-red-200",
  blocked: "bg-amber-50 text-amber-700 ring-amber-200",
  skipped: "bg-slate-100 text-slate-700 ring-slate-200",
};

export const defectStatusBadgeStyles: Record<DefectStatus, string> = {
  open: "bg-red-50 text-red-700 ring-red-200",
  in_progress: "bg-amber-50 text-amber-700 ring-amber-200",
  resolved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  closed: "bg-slate-100 text-slate-700 ring-slate-200",
};

export const priorityBadgeStyles: Record<Priority, string> = {
  high: "border-red-200 text-red-700",
  medium: "border-amber-200 text-amber-700",
  low: "border-slate-200 text-slate-600",
};

export const defectSeverityBadgeStyles: Record<DefectSeverity, string> = {
  critical: "bg-red-50 text-red-700 ring-red-200",
  major: "bg-orange-50 text-orange-700 ring-orange-200",
  minor: "bg-amber-50 text-amber-700 ring-amber-200",
  trivial: "bg-slate-100 text-slate-700 ring-slate-200",
};

export const runStatusBadgeStyles: Record<RunStatus, string> = {
  planned: "bg-slate-100 text-slate-700 ring-slate-200",
  in_progress: "bg-blue-50 text-blue-700 ring-blue-200",
  paused: "bg-amber-50 text-amber-700 ring-amber-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

