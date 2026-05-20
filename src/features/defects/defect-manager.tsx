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
} from "lucide-react";
import { DialogShell } from "@/components/common/dialog-shell";
import { DrawerShell } from "@/components/common/drawer-shell";
import { EmptyState } from "@/components/common/empty-state";
import { FormField, SelectField, TextAreaField, TextInput } from "@/components/common/form-field";
import { PriorityBadge } from "@/components/common/priority-badge";
import { StatusBadge } from "@/components/common/status-badge";
import { TableActionBar } from "@/components/common/action-bar";
import { defectSeverityBadgeStyles } from "@/lib/domain/badge-maps";
import { cn } from "@/lib/utils";
import {
  loadDefectBackupSnapshot,
  loadMockDefects,
  saveDefectBackupSnapshot,
} from "@/lib/mock/mock-store";
import type { Defect, DefectSeverity, DefectStatus, Priority } from "@/lib/domain/types";

const statusLabels: Record<DefectStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

const severityLabels: Record<DefectSeverity, string> = {
  critical: "Critical",
  major: "Major",
  minor: "Minor",
  trivial: "Trivial",
};

const priorityLabels: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const assignees = ["김QA", "박개발", "이프론트", "최검색", "정QA", "미지정"];

type SortKey = "updated_desc" | "created_desc" | "severity" | "priority";

type DefectForm = {
  id: string;
  title: string;
  description: string;
  reproductionSteps: string;
  checklistText: string;
  severity: DefectSeverity;
  priority: Priority;
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

function toForm(defect?: Defect): DefectForm {
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

function toPayload(form: DefectForm) {
  const today = new Date().toISOString().slice(0, 10);

  return {
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
    testCaseIds: form.linkedTestCaseId ? [form.linkedTestCaseId] : [],
    testRunResultIds: form.linkedRunResultId ? [form.linkedRunResultId] : [],
    attachmentCount: form.attachmentCount,
  };
}

function SeverityBadge({ severity }: { severity: DefectSeverity }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ring-inset",
        defectSeverityBadgeStyles[severity],
      )}
    >
      {severityLabels[severity]}
    </span>
  );
}

function compareSeverity(a: DefectSeverity, b: DefectSeverity) {
  const order: Record<DefectSeverity, number> = { critical: 4, major: 3, minor: 2, trivial: 1 };
  return order[b] - order[a];
}

function comparePriority(a: Priority, b: Priority) {
  const order: Record<Priority, number> = { high: 3, medium: 2, low: 1 };
  return order[b] - order[a];
}

export function DefectManager({ projectId }: { projectId: string }) {
  const [defects, setDefects] = useState<Defect[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackupMode, setIsBackupMode] = useState(false);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<DefectStatus | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<DefectSeverity | "all">("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("updated_desc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState<DefectForm>(() => toForm());
  const [titleError, setTitleError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Defect | "selected" | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDefects() {
      setIsLoading(true);
      setActionError("");
      setNotice("");

      try {
        const apiDefects = await requestData<Defect[]>(
          `/api/projects/${encodeURIComponent(projectId)}/defects`,
        );

        if (!active) {
          return;
        }

        setDefects(apiDefects);
        saveDefectBackupSnapshot(projectId, apiDefects);
        setIsBackupMode(false);
      } catch {
        if (!active) {
          return;
        }

        const snapshot = loadDefectBackupSnapshot(projectId);

        if (snapshot) {
          setDefects(snapshot.defects);
          setNotice(
            `백업 데이터 표시 중입니다. 마지막 백업: ${formatBackupTime(snapshot.savedAt)}`,
          );
        } else {
          setDefects(loadMockDefects());
          setNotice("API 연결에 실패해 기존 mock fallback 데이터를 표시 중입니다.");
        }

        setIsBackupMode(true);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadDefects();

    return () => {
      active = false;
    };
  }, [projectId]);

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

  function openEditDrawer(defect: Defect) {
    setForm(toForm(defect));
    setTitleError("");
    setDrawerMode("edit");
  }

  function closeDrawer() {
    setDrawerMode(null);
    setTitleError("");
  }

  async function saveDefect() {
    if (!form.title.trim()) {
      setTitleError("결함 제목을 입력해주세요.");
      return;
    }

    setActionError("");

    try {
      if (drawerMode === "create") {
        const createdDefect = await requestData<Defect>(
          `/api/projects/${encodeURIComponent(projectId)}/defects`,
          {
            method: "POST",
            body: JSON.stringify(toPayload(form)),
          },
        );
        const nextDefects = [createdDefect, ...defects];
        setDefects(nextDefects);
        saveDefectBackupSnapshot(projectId, nextDefects);
        closeDrawer();
        return;
      }

      if (drawerMode === "edit") {
        const updatedDefect = await requestData<Defect>(
          `/api/projects/${encodeURIComponent(projectId)}/defects/${encodeURIComponent(form.id)}`,
          {
            method: "PATCH",
            body: JSON.stringify(toPayload(form)),
          },
        );
        const nextDefects = defects.map((defect) =>
          defect.id === updatedDefect.id ? updatedDefect : defect,
        );
        setDefects(nextDefects);
        saveDefectBackupSnapshot(projectId, nextDefects);
        closeDrawer();
      }
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  async function duplicateDefect() {
    setActionError("");

    try {
      const duplicated = await requestData<Defect>(
        `/api/projects/${encodeURIComponent(projectId)}/defects`,
        {
          method: "POST",
          body: JSON.stringify(
            toPayload({
              ...form,
              title: `${form.title} 복제본`,
              status: "open",
            }),
          ),
        },
      );
      const nextDefects = [duplicated, ...defects];
      setDefects(nextDefects);
      saveDefectBackupSnapshot(projectId, nextDefects);
      setForm(toForm(duplicated));
      setDrawerMode("edit");
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  async function deleteDefects(target: Defect | "selected") {
    const targetIds = target === "selected" ? selectedIds : [target.id];

    setActionError("");

    try {
      await Promise.all(
        targetIds.map((id) =>
          requestData<{ id: string }>(
            `/api/projects/${encodeURIComponent(projectId)}/defects/${encodeURIComponent(id)}`,
            { method: "DELETE" },
          ),
        ),
      );
      const nextDefects = defects.filter((defect) => !targetIds.includes(defect.id));
      setDefects(nextDefects);
      saveDefectBackupSnapshot(projectId, nextDefects);
      setSelectedIds((current) => current.filter((id) => !targetIds.includes(id)));
      setDeleteTarget(null);
      closeDrawer();
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
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

  async function bulkUpdateStatus(status: DefectStatus) {
    await bulkPatchSelected({ status });
  }

  async function bulkUpdateAssignee(assignee: string) {
    await bulkPatchSelected({ assignee });
  }

  async function bulkPatchSelected(payload: Partial<Pick<Defect, "status" | "assignee">>) {
    setActionError("");

    try {
      const updatedDefects = await Promise.all(
        selectedIds.map((id) =>
          requestData<Defect>(
            `/api/projects/${encodeURIComponent(projectId)}/defects/${encodeURIComponent(id)}`,
            {
              method: "PATCH",
              body: JSON.stringify(payload),
            },
          ),
        ),
      );
      const updatedById = new Map(updatedDefects.map((defect) => [defect.id, defect]));
      const nextDefects = defects.map((defect) => updatedById.get(defect.id) ?? defect);
      setDefects(nextDefects);
      saveDefectBackupSnapshot(projectId, nextDefects);
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  return (
    <div className="space-y-5">
      {(isLoading || isBackupMode || actionError) && (
        <div
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            actionError
              ? "border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-text)]"
              : "border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]",
          )}
        >
          {isLoading ? "결함 데이터를 불러오는 중입니다." : actionError || notice}
        </div>
      )}

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
              onChange={(event) => setSeverityFilter(event.target.value as DefectSeverity | "all")}
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
        <TableActionBar count={selectedIds.length}>
          <div className="flex flex-wrap gap-2">
            <select
              onChange={(event) => {
                if (event.target.value) {
                  void bulkUpdateStatus(event.target.value as DefectStatus);
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
                  void bulkUpdateAssignee(event.target.value);
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
        </TableActionBar>
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
        <DrawerShell
          title={drawerMode === "create" ? "새 결함 등록" : form.title || "제목 없음"}
          description={drawerMode === "create" ? "새 결함" : form.id}
          onClose={closeDrawer}
          widthClassName="max-w-4xl"
          actions={
            drawerMode === "edit" ? (
              <>
                <button
                  type="button"
                onClick={() => void duplicateDefect()}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border-subtle)] px-3 text-sm font-medium hover:bg-[var(--surface-muted)]"
                >
                  <Copy className="tf-icon" />
                  복제
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(defects.find((defect) => defect.id === form.id) ?? null)}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-red-200 px-3 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="tf-icon" />
                  삭제
                </button>
              </>
            ) : undefined
          }
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDrawer}
                className="h-10 rounded-md border border-[var(--border-subtle)] px-4 text-sm font-medium hover:bg-[var(--surface-muted)]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void saveDefect()}
                className="h-10 rounded-md bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
              >
                저장
              </button>
            </div>
          }
        >
          <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[280px_1fr]">
              <div className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] p-5 lg:border-b-0 lg:border-r">
                <div className="space-y-4">
                  <FormField label="상태">
                    <SelectField
                      value={form.status}
                      onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as DefectStatus }))}
                    >
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </SelectField>
                  </FormField>
                  <FormField label="심각도">
                    <SelectField
                      value={form.severity}
                      onChange={(event) => setForm((current) => ({ ...current, severity: event.target.value as DefectSeverity }))}
                    >
                      {Object.entries(severityLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </SelectField>
                  </FormField>
                  <FormField label="우선순위">
                    <SelectField
                      value={form.priority}
                      onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as Priority }))}
                    >
                      {Object.entries(priorityLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </SelectField>
                  </FormField>
                  <FormField label="담당자">
                    <SelectField
                      value={form.assignee}
                      onChange={(event) => setForm((current) => ({ ...current, assignee: event.target.value }))}
                    >
                      {assignees.map((assignee) => (
                        <option key={assignee} value={assignee}>
                          {assignee}
                        </option>
                      ))}
                    </SelectField>
                  </FormField>
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
                <FormField label="제목" required error={titleError || undefined}>
                  <TextInput
                    value={form.title}
                    onChange={(event) => {
                      setForm((current) => ({ ...current, title: event.target.value }));
                      setTitleError("");
                    }}
                    placeholder="결함 제목을 입력하세요"
                    className={titleError ? "border-red-300" : undefined}
                  />
                </FormField>
                <FormField label="설명">
                  <TextAreaField
                    value={form.description}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    placeholder="문제 현상과 영향 범위를 입력하세요"
                    rows={5}
                  />
                </FormField>
                <FormField label="재현 단계">
                  <TextAreaField
                    value={form.reproductionSteps}
                    onChange={(event) => setForm((current) => ({ ...current, reproductionSteps: event.target.value }))}
                    placeholder="1. 재현에 필요한 단계를 입력하세요"
                    rows={7}
                  />
                </FormField>
                <FormField label="체크리스트">
                  <TextAreaField
                    value={form.checklistText}
                    onChange={(event) => setForm((current) => ({ ...current, checklistText: event.target.value }))}
                    placeholder="한 줄에 하나씩 확인 항목을 입력하세요"
                    rows={5}
                  />
                </FormField>

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
                      .map((item, index) => (
                        <label key={`checklist-preview-${index}-${item}`} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                          <input type="checkbox" className="h-4 w-4 rounded border-[var(--border-subtle)]" />
                          {item}
                        </label>
                      ))}
                  </div>
                </div>
              </div>
            </div>
        </DrawerShell>
      )}

      {deleteTarget && (
        <DialogShell
          title="결함 삭제"
          description={
            deleteTarget === "selected"
              ? `선택한 ${selectedIds.length}개 결함을 삭제할까요?`
              : `${deleteTarget.id} 결함을 삭제할까요?`
          }
          onClose={() => setDeleteTarget(null)}
          maxWidth="max-w-md"
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="h-9 rounded-md border border-[var(--border-subtle)] px-3 text-sm font-medium hover:bg-[var(--surface-muted)]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void deleteDefects(deleteTarget)}
                className="h-9 rounded-md bg-red-600 px-3 text-sm font-semibold text-white hover:bg-red-700"
              >
                삭제
              </button>
            </div>
          }
        >
          <div className="text-sm leading-6 text-[var(--text-secondary)]">
            이 작업은 DB에 저장된 결함을 삭제 처리합니다.
          </div>
        </DialogShell>
      )}
    </div>
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

async function requestData<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: T; error?: { message?: string } }
    | null;

  if (!response.ok || payload?.data === undefined) {
    throw new Error(payload?.error?.message || "API 요청에 실패했습니다.");
  }

  return payload.data;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "요청 처리 중 오류가 발생했습니다.";
}

function formatBackupTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "알 수 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
