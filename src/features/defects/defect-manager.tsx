"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PriorityBadge } from "@/components/common/priority-badge";
import { StatusBadge } from "@/components/common/status-badge";
import { cn } from "@/lib/utils";
import {
  createDefectId,
  loadMockDefects,
  type DefectPriority,
  type DefectStatus,
  type MockDefect,
  saveMockDefects,
  type Severity,
} from "./mock-defect-store";

const statusLabels: Record<DefectStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

const severityLabels: Record<Severity, string> = {
  critical: "Critical",
  major: "Major",
  minor: "Minor",
  trivial: "Trivial",
};

const priorityLabels: Record<DefectPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const severityStyles: Record<Severity, string> = {
  critical: "bg-red-50 text-red-700 ring-red-200",
  major: "bg-orange-50 text-orange-700 ring-orange-200",
  minor: "bg-amber-50 text-amber-700 ring-amber-200",
  trivial: "bg-slate-100 text-slate-700 ring-slate-200",
};

const assignees = ["김QA", "박개발", "이프론트", "최검색", "정QA", "미지정"];

type SortKey = "updated_desc" | "created_desc" | "severity" | "priority";

type DefectForm = {
  id: string;
  title: string;
  description: string;
  reproductionSteps: string;
  checklistText: string;
  severity: Severity;
  priority: DefectPriority;
  status: DefectStatus;
  assignee: string;
  reporter: string;
  createdAt: string;
  updatedAt: string;
  linkedTestCaseId: string;
  linkedTestCaseTitle: string;
  linkedRunResultId?: string;
  attachmentCount: number;
};

function toForm(defect?: MockDefect): DefectForm {
  const today = new Date().toISOString().slice(0, 10);

  return {
    id: defect?.id ?? "",
    title: defect?.title ?? "",
    description: defect?.description ?? "",
    reproductionSteps: defect?.reproductionSteps ?? "",
    checklistText: defect?.checklist.join("\n") ?? "",
    severity: defect?.severity ?? "major",
    priority: defect?.priority ?? "medium",
    status: defect?.status ?? "open",
    assignee: defect?.assignee ?? "미지정",
    reporter: defect?.reporter ?? "김QA",
    createdAt: defect?.createdAt ?? today,
    updatedAt: defect?.updatedAt ?? today,
    linkedTestCaseId: defect?.linkedTestCaseId ?? "TC-002",
    linkedTestCaseTitle: defect?.linkedTestCaseTitle ?? "잔액 부족 시 결제 실패 처리",
    linkedRunResultId: defect?.linkedRunResultId,
    attachmentCount: defect?.attachmentCount ?? 0,
  };
}

function fromForm(form: DefectForm, id: string): MockDefect {
  const today = new Date().toISOString().slice(0, 10);

  return {
    id,
    title: form.title.trim(),
    description: form.description.trim(),
    reproductionSteps: form.reproductionSteps.trim(),
    checklist: form.checklistText
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean),
    severity: form.severity,
    priority: form.priority,
    status: form.status,
    assignee: form.assignee,
    reporter: form.reporter,
    createdAt: form.createdAt || today,
    updatedAt: today,
    linkedTestCaseId: form.linkedTestCaseId,
    linkedTestCaseTitle: form.linkedTestCaseTitle,
    linkedRunResultId: form.linkedRunResultId,
    attachmentCount: form.attachmentCount,
  };
}

function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ring-inset",
        severityStyles[severity],
      )}
    >
      {severityLabels[severity]}
    </span>
  );
}

function compareSeverity(a: Severity, b: Severity) {
  const order: Record<Severity, number> = { critical: 4, major: 3, minor: 2, trivial: 1 };
  return order[b] - order[a];
}

function comparePriority(a: DefectPriority, b: DefectPriority) {
  const order: Record<DefectPriority, number> = { high: 3, medium: 2, low: 1 };
  return order[b] - order[a];
}

export function DefectManager() {
  const [defects, setDefects] = useState<MockDefect[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<DefectStatus | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("updated_desc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState<DefectForm>(() => toForm());
  const [titleError, setTitleError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<MockDefect | "selected" | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setDefects(loadMockDefects());
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      saveMockDefects(defects);
    }
  }, [defects, isLoaded]);

  const summary = useMemo(
    () => ({
      open: defects.filter((defect) => defect.status === "open").length,
      in_progress: defects.filter((defect) => defect.status === "in_progress").length,
      resolved: defects.filter((defect) => defect.status === "resolved").length,
      closed: defects.filter((defect) => defect.status === "closed").length,
    }),
    [defects],
  );

  const filteredDefects = useMemo(() => {
    const loweredQuery = query.trim().toLowerCase();
    const result = defects.filter((defect) => {
      const matchesQuery =
        !loweredQuery ||
        defect.id.toLowerCase().includes(loweredQuery) ||
        defect.title.toLowerCase().includes(loweredQuery) ||
        defect.linkedTestCaseId.toLowerCase().includes(loweredQuery);
      const matchesStatus = statusFilter === "all" || defect.status === statusFilter;
      const matchesSeverity = severityFilter === "all" || defect.severity === severityFilter;
      const matchesAssignee = assigneeFilter === "all" || defect.assignee === assigneeFilter;

      return matchesQuery && matchesStatus && matchesSeverity && matchesAssignee;
    });

    return result.sort((a, b) => {
      if (sortKey === "created_desc") {
        return b.createdAt.localeCompare(a.createdAt);
      }
      if (sortKey === "severity") {
        return compareSeverity(a.severity, b.severity);
      }
      if (sortKey === "priority") {
        return comparePriority(a.priority, b.priority);
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [assigneeFilter, defects, query, severityFilter, sortKey, statusFilter]);

  const allVisibleSelected =
    filteredDefects.length > 0 &&
    filteredDefects.every((defect) => selectedIds.includes(defect.id));

  function openCreateDrawer() {
    setForm(toForm());
    setTitleError("");
    setDrawerMode("create");
  }

  function openEditDrawer(defect: MockDefect) {
    setForm(toForm(defect));
    setTitleError("");
    setDrawerMode("edit");
  }

  function closeDrawer() {
    setDrawerMode(null);
    setTitleError("");
  }

  function saveDefect() {
    if (!form.title.trim()) {
      setTitleError("결함 제목을 입력해주세요.");
      return;
    }

    if (drawerMode === "create") {
      const nextDefect = fromForm(form, createDefectId(defects));
      setDefects((current) => [nextDefect, ...current]);
      closeDrawer();
      return;
    }

    if (drawerMode === "edit") {
      setDefects((current) =>
        current.map((defect) => (defect.id === form.id ? fromForm(form, defect.id) : defect)),
      );
      closeDrawer();
    }
  }

  function duplicateDefect() {
    const duplicated = fromForm(
      {
        ...form,
        title: `${form.title} 복제본`,
        status: "open",
      },
      createDefectId(defects),
    );
    setDefects((current) => [duplicated, ...current]);
    setForm(toForm(duplicated));
    setDrawerMode("edit");
  }

  function deleteDefects(target: MockDefect | "selected") {
    if (target === "selected") {
      setDefects((current) => current.filter((defect) => !selectedIds.includes(defect.id)));
      setSelectedIds([]);
      setDeleteTarget(null);
      return;
    }

    setDefects((current) => current.filter((defect) => defect.id !== target.id));
    setSelectedIds((current) => current.filter((id) => id !== target.id));
    setDeleteTarget(null);
    closeDrawer();
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id],
    );
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !filteredDefects.some((defect) => defect.id === id)),
      );
      return;
    }

    setSelectedIds((current) => Array.from(new Set([...current, ...filteredDefects.map((d) => d.id)])));
  }

  function bulkUpdateStatus(status: DefectStatus) {
    setDefects((current) =>
      current.map((defect) =>
        selectedIds.includes(defect.id)
          ? { ...defect, status, updatedAt: new Date().toISOString().slice(0, 10) }
          : defect,
      ),
    );
  }

  function bulkUpdateAssignee(assignee: string) {
    setDefects((current) =>
      current.map((defect) =>
        selectedIds.includes(defect.id)
          ? { ...defect, assignee, updatedAt: new Date().toISOString().slice(0, 10) }
          : defect,
      ),
    );
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-4">
        {(Object.keys(statusLabels) as DefectStatus[]).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter((current) => (current === status ? "all" : status))}
            className={cn(
              "tf-card flex items-center justify-between p-4 text-left transition hover:border-[var(--brand-primary)]",
              statusFilter === status && "border-[var(--brand-primary)] ring-2 ring-blue-100",
            )}
          >
            <span>
              <span className="block text-sm font-semibold text-[var(--text-primary)]">
                {statusLabels[status]}
              </span>
              <span className="mt-1 block text-xs text-[var(--text-tertiary)]">상태 필터 적용</span>
            </span>
            <span className="text-2xl font-semibold text-[var(--text-primary)]">{summary[status]}</span>
          </button>
        ))}
      </section>

      <section className="tf-card p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid flex-1 gap-3 md:grid-cols-[minmax(220px,1fr)_160px_160px_160px_160px]">
            <label className="relative">
              <Search className="tf-icon absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="결함 ID, 제목, TC 검색"
                className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-white pl-10 pr-3 text-sm outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as DefectStatus | "all")}
              className="h-10 rounded-md border border-[var(--border-subtle)] bg-white px-3 text-sm outline-none focus:border-[var(--brand-primary)]"
            >
              <option value="all">전체 상태</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <select
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value as Severity | "all")}
              className="h-10 rounded-md border border-[var(--border-subtle)] bg-white px-3 text-sm outline-none focus:border-[var(--brand-primary)]"
            >
              <option value="all">전체 심각도</option>
              <option value="critical">Critical</option>
              <option value="major">Major</option>
              <option value="minor">Minor</option>
              <option value="trivial">Trivial</option>
            </select>
            <select
              value={assigneeFilter}
              onChange={(event) => setAssigneeFilter(event.target.value)}
              className="h-10 rounded-md border border-[var(--border-subtle)] bg-white px-3 text-sm outline-none focus:border-[var(--brand-primary)]"
            >
              <option value="all">전체 담당자</option>
              {assignees.map((assignee) => (
                <option key={assignee} value={assignee}>
                  {assignee}
                </option>
              ))}
            </select>
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
              className="h-10 rounded-md border border-[var(--border-subtle)] bg-white px-3 text-sm outline-none focus:border-[var(--brand-primary)]"
            >
              <option value="updated_desc">최근 수정순</option>
              <option value="created_desc">최근 등록순</option>
              <option value="severity">심각도 높은순</option>
              <option value="priority">우선순위 높은순</option>
            </select>
          </div>
          <button
            type="button"
            onClick={openCreateDrawer}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
          >
            <Plus className="tf-icon" />
            새 결함 등록
          </button>
        </div>
      </section>

      {selectedIds.length > 0 && (
        <section className="tf-card flex flex-col gap-3 border-[var(--brand-primary)] bg-blue-50/60 p-3 md:flex-row md:items-center md:justify-between">
          <span className="text-sm font-semibold text-[var(--brand-primary)]">
            {selectedIds.length}개 선택됨
          </span>
          <div className="flex flex-wrap gap-2">
            <select
              onChange={(event) => {
                if (event.target.value) {
                  bulkUpdateStatus(event.target.value as DefectStatus);
                  event.target.value = "";
                }
              }}
              className="h-9 rounded-md border border-blue-200 bg-white px-3 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                상태 변경
              </option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <select
              onChange={(event) => {
                if (event.target.value) {
                  bulkUpdateAssignee(event.target.value);
                  event.target.value = "";
                }
              }}
              className="h-9 rounded-md border border-blue-200 bg-white px-3 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                담당자 변경
              </option>
              {assignees.map((assignee) => (
                <option key={assignee} value={assignee}>
                  {assignee}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setDeleteTarget("selected")}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-red-200 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              <Trash2 className="tf-icon" />
              삭제
            </button>
          </div>
        </section>
      )}

      <section className="tf-card overflow-hidden">
        {filteredDefects.length === 0 ? (
          <div className="p-10">
            <EmptyState
              icon={AlertTriangle}
              title="표시할 결함이 없습니다"
              description="필터를 변경하거나 새 결함을 등록해 주세요."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead className="bg-[var(--surface-muted)] text-xs font-semibold uppercase text-[var(--text-tertiary)]">
                <tr>
                  <th className="w-12 px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      className="h-4 w-4 rounded border-[var(--border-subtle)]"
                      aria-label="전체 선택"
                    />
                  </th>
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">제목</th>
                  <th className="px-4 py-3 text-left">심각도</th>
                  <th className="px-4 py-3 text-left">우선순위</th>
                  <th className="px-4 py-3 text-left">상태</th>
                  <th className="px-4 py-3 text-left">담당자</th>
                  <th className="px-4 py-3 text-left">등록일</th>
                  <th className="w-12 px-4 py-3 text-right">더보기</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filteredDefects.map((defect) => (
                  <tr key={defect.id} className="hover:bg-blue-50/40">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(defect.id)}
                        onChange={() => toggleSelected(defect.id)}
                        className="h-4 w-4 rounded border-[var(--border-subtle)]"
                        aria-label={`${defect.id} 선택`}
                      />
                    </td>
                    <td
                      className="cursor-pointer px-4 py-3 font-semibold text-[var(--brand-primary)]"
                      onClick={() => openEditDrawer(defect)}
                    >
                      {defect.id}
                    </td>
                    <td className="max-w-[320px] px-4 py-3" onClick={() => openEditDrawer(defect)}>
                      <button type="button" className="text-left font-medium text-[var(--text-primary)]">
                        {defect.title}
                      </button>
                      <div className="mt-1 text-xs text-[var(--text-tertiary)]">
                        {defect.linkedTestCaseId} · {defect.linkedTestCaseTitle}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <SeverityBadge severity={defect.severity} />
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={defect.priority} label={priorityLabels[defect.priority]} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={defect.status} label={statusLabels[defect.status]} />
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{defect.assignee}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{defect.createdAt}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEditDrawer(defect)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-tertiary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                        aria-label={`${defect.id} 더보기`}
                      >
                        <MoreHorizontal className="tf-icon" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {drawerMode && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/20">
          <button type="button" className="flex-1 cursor-default" onClick={closeDrawer} aria-label="닫기" />
          <aside className="flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-[var(--border-subtle)] px-6 py-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                  {drawerMode === "create" ? "새 결함" : form.id}
                </div>
                <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">
                  {drawerMode === "create" ? "새 결함 등록" : form.title || "제목 없음"}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {drawerMode === "edit" && (
                  <>
                    <button
                      type="button"
                      onClick={duplicateDefect}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border-subtle)] px-3 text-sm font-medium hover:bg-[var(--surface-muted)]"
                    >
                      <Copy className="tf-icon" />
                      복제
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget(defects.find((defect) => defect.id === form.id) ?? null)
                      }
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-red-200 px-3 text-sm font-medium text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="tf-icon" />
                      삭제
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-[var(--surface-muted)]"
                  aria-label="Drawer 닫기"
                >
                  <X className="tf-icon" />
                </button>
              </div>
            </div>

            <div className="grid flex-1 overflow-y-auto lg:grid-cols-[280px_1fr]">
              <div className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] p-5 lg:border-b-0 lg:border-r">
                <div className="space-y-4">
                  <FieldSelect
                    label="상태"
                    value={form.status}
                    onChange={(value) => setForm((current) => ({ ...current, status: value as DefectStatus }))}
                    options={Object.entries(statusLabels)}
                  />
                  <FieldSelect
                    label="심각도"
                    value={form.severity}
                    onChange={(value) => setForm((current) => ({ ...current, severity: value as Severity }))}
                    options={Object.entries(severityLabels)}
                  />
                  <FieldSelect
                    label="우선순위"
                    value={form.priority}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, priority: value as DefectPriority }))
                    }
                    options={Object.entries(priorityLabels)}
                  />
                  <FieldSelect
                    label="담당자"
                    value={form.assignee}
                    onChange={(value) => setForm((current) => ({ ...current, assignee: value }))}
                    options={assignees.map((assignee) => [assignee, assignee])}
                  />
                  <MetaRow label="등록자" value={form.reporter} />
                  <MetaRow label="등록일" value={form.createdAt} />
                  <MetaRow label="마지막 수정" value={form.updatedAt} />
                  <div>
                    <div className="mb-1 text-xs font-semibold text-[var(--text-tertiary)]">연관 TC</div>
                    <div className="rounded-md border border-[var(--border-subtle)] bg-white p-3 text-sm">
                      <div className="font-semibold text-[var(--brand-primary)]">{form.linkedTestCaseId}</div>
                      <div className="mt-1 text-[var(--text-secondary)]">{form.linkedTestCaseTitle}</div>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-semibold text-[var(--text-tertiary)]">첨부 파일</div>
                    <div className="rounded-md border border-dashed border-[var(--border-subtle)] bg-white p-3 text-sm text-[var(--text-secondary)]">
                      <Paperclip className="tf-icon mb-2 text-[var(--text-tertiary)]" />
                      현재 첨부 {form.attachmentCount}개
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-5 p-6">
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-[var(--text-primary)]">제목</span>
                  <input
                    value={form.title}
                    onChange={(event) => {
                      setForm((current) => ({ ...current, title: event.target.value }));
                      setTitleError("");
                    }}
                    className={cn(
                      "h-10 w-full rounded-md border bg-white px-3 text-sm outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-blue-100",
                      titleError ? "border-red-300" : "border-[var(--border-subtle)]",
                    )}
                    placeholder="결함 제목을 입력하세요"
                  />
                  {titleError && <span className="mt-1 block text-xs text-red-600">{titleError}</span>}
                </label>
                <FieldTextarea
                  label="설명"
                  value={form.description}
                  onChange={(value) => setForm((current) => ({ ...current, description: value }))}
                  placeholder="문제 현상과 영향 범위를 입력하세요"
                  rows={5}
                />
                <FieldTextarea
                  label="재현 단계"
                  value={form.reproductionSteps}
                  onChange={(value) => setForm((current) => ({ ...current, reproductionSteps: value }))}
                  placeholder="1. 재현에 필요한 단계를 입력하세요"
                  rows={7}
                />
                <FieldTextarea
                  label="체크리스트"
                  value={form.checklistText}
                  onChange={(value) => setForm((current) => ({ ...current, checklistText: value }))}
                  placeholder="한 줄에 하나씩 확인 항목을 입력하세요"
                  rows={5}
                />

                <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                    <CheckCircle2 className="tf-icon text-emerald-600" />
                    체크리스트 미리보기
                  </div>
                  <div className="space-y-2">
                    {form.checklistText
                      .split("\n")
                      .map((item) => item.trim())
                      .filter(Boolean)
                      .map((item) => (
                        <label key={item} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                          <input type="checkbox" className="h-4 w-4 rounded border-[var(--border-subtle)]" />
                          {item}
                        </label>
                      ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] px-6 py-4">
              <button
                type="button"
                onClick={closeDrawer}
                className="h-10 rounded-md border border-[var(--border-subtle)] px-4 text-sm font-medium hover:bg-[var(--surface-muted)]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={saveDefect}
                className="h-10 rounded-md bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
              >
                저장
              </button>
            </div>
          </aside>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/30 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">결함 삭제</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              {deleteTarget === "selected"
                ? `선택한 ${selectedIds.length}개 결함을 삭제할까요?`
                : `${deleteTarget.id} 결함을 삭제할까요?`}
              이 작업은 mock 목록에서만 제거됩니다.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="h-9 rounded-md border border-[var(--border-subtle)] px-3 text-sm font-medium hover:bg-[var(--surface-muted)]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => deleteDefects(deleteTarget)}
                className="h-9 rounded-md bg-red-600 px-3 text-sm font-semibold text-white hover:bg-red-700"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[var(--text-tertiary)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-white px-3 text-sm outline-none focus:border-[var(--brand-primary)]"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function FieldTextarea({
  label,
  value,
  placeholder,
  rows,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  rows: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-[var(--text-primary)]">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full resize-none rounded-md border border-[var(--border-subtle)] bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-[var(--text-tertiary)]">{label}</div>
      <div className="text-sm text-[var(--text-primary)]">{value}</div>
    </div>
  );
}
