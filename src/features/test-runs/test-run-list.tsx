"use client";

import {
  Calendar,
  Circle,
  Clock,
  MoreVertical,
  Play,
  Plus,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/common/empty-state";
import { DialogShell } from "@/components/common/dialog-shell";
import { FormField, SelectField, TextAreaField } from "@/components/common/form-field";
import { StatusBadge } from "@/components/common/status-badge";
import { getPermissionMessage, useCurrentAuth } from "@/features/auth/use-current-auth";
import { cn } from "@/lib/utils";
import type { RunStatus, TestCase, TestRun } from "@/lib/domain/types";
import {
  loadMockRuns,
  loadTestRunBackupSnapshot,
  saveTestRunBackupSnapshot,
} from "@/lib/mock/mock-store";
import { mockTestCases } from "@/features/test-runs/mock-test-run-store";

const runStatusLabels: Record<RunStatus, string> = {
  planned: "예정",
  in_progress: "진행 중",
  paused: "일시정지",
  completed: "완료",
};

const runStatusBadge: Record<RunStatus, "pending" | "blocked" | "closed" | "passed"> = {
  planned: "pending",
  in_progress: "blocked",
  paused: "closed",
  completed: "passed",
};

type CreateRunInput = {
  title: string;
  description: string;
  assignee: string;
  environment: string;
  startDate: string;
  dueDate: string;
  testCaseIds: string[];
  startNow: boolean;
};

export function TestRunList({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { permissions, isLoading: isAuthLoading } = useCurrentAuth();
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackupMode, setIsBackupMode] = useState(false);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<RunStatus | "all">("all");
  const [isCreateOpen, setCreateOpen] = useState(false);
  const canCreate = permissions?.canCreate === true;
  const permissionMessage = getPermissionMessage(isAuthLoading);

  const apiBase = `/api/projects/${encodeURIComponent(projectId)}`;

  useEffect(() => {
    let active = true;

    async function loadData() {
      setIsLoading(true);
      setNotice("");
      setActionError("");

      try {
        const [apiRuns, apiTestCases] = await Promise.all([
          requestData<TestRun[]>(`${apiBase}/runs`),
          requestData<TestCase[]>(`${apiBase}/test-cases`),
        ]);

        if (!active) {
          return;
        }

        setRuns(apiRuns);
        setTestCases(apiTestCases);
        saveTestRunBackupSnapshot(projectId, apiRuns);
        setIsBackupMode(false);
      } catch {
        if (!active) {
          return;
        }

        const snapshot = loadTestRunBackupSnapshot(projectId);

        if (snapshot) {
          setRuns(snapshot.runs);
          setNotice(
            `백업 데이터 표시 중입니다. 마지막 백업: ${formatBackupTime(snapshot.savedAt)}`,
          );
        } else {
          setRuns(loadMockRuns());
          setNotice("API 연결에 실패해 기존 mock fallback 데이터를 표시 중입니다.");
        }

        setTestCases(mockTestCases);
        setIsBackupMode(true);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [apiBase, projectId]);

  const visibleRuns = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return runs.filter((run) => {
      const matchesQuery =
        !normalizedQuery ||
        run.title.toLowerCase().includes(normalizedQuery) ||
        run.description.toLowerCase().includes(normalizedQuery);
      const matchesStatus =
        statusFilter === "all" || run.status === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [query, runs, statusFilter]);

  async function handleCreate(input: CreateRunInput) {
    if (!canCreate) {
      setActionError(permissionMessage);
      return false;
    }

    setActionError("");

    try {
      const createdRun = await requestData<TestRun>(`${apiBase}/runs`, {
        method: "POST",
        body: JSON.stringify({
          ...input,
          status: input.startNow ? "in_progress" : "planned",
        }),
      });
      const nextRuns = [createdRun, ...runs];
      setRuns(nextRuns);
      saveTestRunBackupSnapshot(projectId, nextRuns);
      setCreateOpen(false);

      if (input.startNow) {
        router.push(`/projects/${projectId}/runs/${createdRun.id}`);
      }

      return true;
    } catch (error) {
      setActionError(getErrorMessage(error));
      return false;
    }
  }

  return (
    <>
      {(isLoading || isBackupMode || actionError) && (
        <div
          className={cn(
            "mb-4 rounded-lg border px-4 py-3 text-sm",
            actionError
              ? "border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-text)]"
              : "border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]",
          )}
        >
          {isLoading ? "테스트 실행 목록을 불러오는 중입니다." : actionError || notice}
        </div>
      )}

      <div className="mb-5 flex flex-col gap-3 rounded-lg border border-[var(--border-default)] bg-white p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-3 md:flex-row">
          <label className="relative block min-w-64 flex-1">
            <Search className="tf-icon pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-9 w-full rounded-md border border-[var(--border-default)] bg-white pl-9 pr-3 text-sm outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-primary)]"
              placeholder="테스트 실행 검색..."
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as RunStatus | "all")
            }
            className="h-9 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm text-[var(--text-secondary)] outline-none focus:border-[var(--brand-primary)]"
          >
            <option value="all">전체 상태</option>
            <option value="planned">예정</option>
            <option value="in_progress">진행 중</option>
            <option value="completed">완료</option>
            <option value="paused">일시정지</option>
          </select>
        </div>

        <button
          onClick={() => {
            if (!canCreate) {
              setActionError(permissionMessage);
              return;
            }
            setCreateOpen(true);
          }}
          disabled={!canCreate}
          title={!canCreate ? permissionMessage : undefined}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--brand-primary)] px-3 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          <Plus className="tf-icon" />
          새 테스트 플랜 만들기
        </button>
      </div>

      {visibleRuns.length === 0 ? (
        <EmptyState
          icon={Play}
          title="테스트 실행이 없습니다"
          description="새 테스트 플랜을 만들고 실행 대상 테스트케이스를 선택하세요."
        />
      ) : (
        <div className="space-y-4">
          {visibleRuns.map((run) => (
            <RunCard
              key={run.id}
              run={run}
              onOpen={() => router.push(`/projects/${projectId}/runs/${run.id}`)}
            />
          ))}
        </div>
      )}

      {isCreateOpen && (
        <CreateRunDialog
          testCases={testCases}
          submitError={actionError}
          onClose={() => setCreateOpen(false)}
          onCreate={handleCreate}
          canCreate={canCreate}
          permissionMessage={permissionMessage}
        />
      )}
    </>
  );
}

function RunCard({ run, onOpen }: { run: TestRun; onOpen: () => void }) {
  const summary = summarizeRun(run);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          onOpen();
        }
      }}
      className="rounded-lg border border-[var(--border-default)] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-md"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-base font-semibold">{run.title}</h2>
            <StatusBadge
              status={runStatusBadge[run.status]}
              label={runStatusLabels[run.status]}
            />
          </div>
          <p className="text-sm text-[var(--text-secondary)]">{run.description}</p>
        </div>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-tertiary)] hover:bg-[var(--bg-muted)]"
          aria-label="더보기"
          onClick={(event) => event.stopPropagation()}
        >
          <MoreVertical className="tf-icon" />
        </button>
      </div>

      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between text-sm text-[var(--text-secondary)]">
          <span>
            {summary.done}/{summary.total} ({summary.progress}%)
          </span>
          <span>{run.createdLabel}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-muted)]">
          <div
            className="h-full rounded-full bg-[var(--brand-primary)]"
            style={{ width: `${summary.progress}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3 text-sm">
          <ResultCount color="var(--status-pass)" label="Pass" value={summary.pass} />
          <ResultCount color="var(--status-fail)" label="Fail" value={summary.fail} />
          <ResultCount color="var(--status-block)" label="Block" value={summary.block} />
          <ResultCount color="var(--status-skip)" label="Skip" value={summary.skip} />
        </div>
        <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1.5">
            <Circle className="tf-icon" />
            {run.assignee}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="tf-icon" />
            {run.startDate}
          </span>
        </div>
      </div>
    </article>
  );
}

function CreateRunDialog({
  testCases,
  submitError,
  onClose,
  onCreate,
  canCreate,
  permissionMessage,
}: {
  testCases: TestCase[];
  submitError?: string;
  onClose: () => void;
  onCreate: (input: CreateRunInput) => Promise<boolean>;
  canCreate: boolean;
  permissionMessage: string;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState("김QA");
  const [environment, setEnvironment] = useState("QA Server");
  const [startDate, setStartDate] = useState("2026-05-18");
  const [dueDate, setDueDate] = useState("2026-05-21");
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const titleError = submitted && !title.trim();
  const selectionError = submitted && selectedCaseIds.length === 0;

  async function handleSubmit(startNow: boolean) {
    if (!canCreate) {
      return;
    }

    setSubmitted(true);

    if (!title.trim() || selectedCaseIds.length === 0) {
      return;
    }

    setSubmitting(true);
    const created = await onCreate({
      title: title.trim(),
      description: description.trim(),
      assignee,
      environment,
      startDate,
      dueDate,
      testCaseIds: selectedCaseIds,
      startNow,
    });
    setSubmitting(false);

    if (created && !startNow) {
      onClose();
    }
  }

  function toggleCase(id: string) {
    setSelectedCaseIds((current) =>
      current.includes(id)
        ? current.filter((caseId) => caseId !== id)
        : [...current, id],
    );
  }

  return (
    <DialogShell
      title="새 테스트 플랜 만들기"
      description="실행 대상 테스트케이스를 선택해 테스트 플랜을 생성합니다."
      onClose={onClose}
      maxWidth="max-w-5xl"
      footer={
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="h-9 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            취소
          </button>
          <button
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting || !canCreate}
            title={!canCreate ? permissionMessage : undefined}
            className="h-9 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            임시저장
          </button>
          <button
            onClick={() => handleSubmit(true)}
            disabled={isSubmitting || !canCreate}
            title={!canCreate ? permissionMessage : undefined}
            className="h-9 rounded-md bg-[var(--brand-primary)] px-3 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            플랜 생성 & 실행 시작
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <section>
          <h3 className="mb-3 text-sm font-semibold">기본 정보</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="플랜 이름" required error={titleError ? "플랜 이름을 입력하세요." : undefined} className="md:col-span-2">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={cn(
                  "h-10 w-full rounded-md border px-3 text-sm outline-none focus:border-[var(--brand-primary)]",
                  titleError ? "border-[var(--status-fail)]" : "border-[var(--border-default)]",
                )}
                placeholder="Sprint 13 회귀 테스트"
              />
            </FormField>
            <FormField label="설명" className="md:col-span-2">
              <TextAreaField
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
              />
            </FormField>
            <FormField label="담당자">
              <SelectField value={assignee} onChange={(event) => setAssignee(event.target.value)}>
                <option value="김QA">김QA</option>
                <option value="홍길동">홍길동</option>
                <option value="이PM">이PM</option>
                <option value="박개발">박개발</option>
              </SelectField>
            </FormField>
            <FormField label="실행 환경">
              <SelectField value={environment} onChange={(event) => setEnvironment(event.target.value)}>
                <option value="Dev">Dev</option>
                <option value="QA Server">QA Server</option>
                <option value="Staging">Staging</option>
                <option value="Prod">Prod</option>
              </SelectField>
            </FormField>
            <DateField label="시작일" value={startDate} onChange={setStartDate} />
            <DateField label="마감일" value={dueDate} onChange={setDueDate} />
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">테스트케이스 선택</h3>
            <span className="text-sm text-[var(--text-secondary)]">
              현재 {selectedCaseIds.length}/{testCases.length}개 선택됨
            </span>
          </div>
          {selectionError && (
            <p className="mb-2 text-sm text-[var(--status-fail)]">
              실행할 테스트케이스를 1개 이상 선택하세요.
            </p>
          )}
          <div className="max-h-72 overflow-y-auto rounded-lg border border-[var(--border-default)]">
            {testCases.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={Clock}
                  title="선택할 테스트케이스가 없습니다"
                  description="테스트케이스를 먼저 생성한 뒤 테스트 플랜을 만들 수 있습니다."
                />
              </div>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-[var(--bg-subtle)] text-left text-[var(--text-secondary)]">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedCaseIds.length === testCases.length}
                        onChange={() =>
                          setSelectedCaseIds((current) =>
                            current.length === testCases.length
                              ? []
                              : testCases.map((testCase) => testCase.id),
                          )
                        }
                      />
                    </th>
                    <th className="px-4 py-3 font-medium">ID</th>
                    <th className="px-4 py-3 font-medium">제목</th>
                    <th className="px-4 py-3 font-medium">우선순위</th>
                    <th className="px-4 py-3 font-medium">태그</th>
                  </tr>
                </thead>
                <tbody>
                  {testCases.map((testCase) => (
                    <tr
                      key={testCase.id}
                      className="border-t border-[var(--border-default)] hover:bg-[var(--bg-subtle)]"
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedCaseIds.includes(testCase.id)}
                          onChange={() => toggleCase(testCase.id)}
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">
                        {testCase.id}
                      </td>
                      <td className="px-4 py-3 font-medium">{testCase.title}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        {testCase.priority}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        {testCase.tags.map((tag) => `#${tag}`).join(" ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {submitError && (
            <p className="mt-3 rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger-text)]">
              {submitError}
            </p>
          )}
        </section>
      </div>
    </DialogShell>
  );
}

function ResultCount({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label} {value}
    </span>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-10 w-full rounded-md border border-[var(--border-default)] bg-white px-3 text-sm outline-none focus:border-[var(--brand-primary)]"
      />
    </label>
  );
}

function summarizeRun(run: TestRun) {
  const total = run.results.length;
  const pass = run.results.filter((result) => result.status === "passed").length;
  const fail = run.results.filter((result) => result.status === "failed").length;
  const block = run.results.filter((result) => result.status === "blocked").length;
  const skip = run.results.filter((result) => result.status === "skipped").length;
  const done = run.results.filter((result) => result.status !== "pending").length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  return { total, done, pass, fail, block, skip, progress };
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
