"use client";

import {
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  MinusCircle,
  Paperclip,
  Pause,
  Play,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DialogShell } from "@/components/common/dialog-shell";
import { EmptyState } from "@/components/common/empty-state";
import { PriorityBadge } from "@/components/common/priority-badge";
import { FormField, SelectField, TextAreaField } from "@/components/common/form-field";
import { StatusBadge } from "@/components/common/status-badge";
import { getPermissionMessage, useCurrentAuth } from "@/features/auth/use-current-auth";
import {
  loadMockRuns,
  loadTestRunDetailBackupSnapshot,
  saveTestRunDetailBackupSnapshot,
} from "@/lib/mock/mock-store";
import { cn } from "@/lib/utils";
import type { ResultStatus, TestRun, TestRunResult } from "@/lib/domain/types";

type DefectDialogInput = {
  title: string;
  severity: string;
  priority: string;
  reproductionSteps: string;
};

const resultGroups: Array<{
  status: ResultStatus;
  label: string;
  badge: "pending" | "passed" | "failed" | "blocked" | "skipped";
}> = [
  { status: "pending", label: "Pending", badge: "pending" },
  { status: "passed", label: "Pass", badge: "passed" },
  { status: "failed", label: "Fail", badge: "failed" },
  { status: "blocked", label: "Block", badge: "blocked" },
  { status: "skipped", label: "Skip", badge: "skipped" },
];

export function TestRunRunner({
  projectId,
  runId,
}: {
  projectId: string;
  runId: string;
}) {
  const { permissions, isLoading: isAuthLoading } = useCurrentAuth();
  const [run, setRun] = useState<TestRun | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackupMode, setIsBackupMode] = useState(false);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [activeResultId, setActiveResultId] = useState<string | null>(null);
  const [defectTarget, setDefectTarget] = useState<TestRunResult | null>(null);
  const [actualResult, setActualResult] = useState("");
  const canCreate = permissions?.canCreate === true;
  const canUpdate = permissions?.canUpdate === true;
  const permissionMessage = getPermissionMessage(isAuthLoading);

  const apiBase = `/api/projects/${encodeURIComponent(projectId)}/runs/${encodeURIComponent(runId)}`;

  useEffect(() => {
    let active = true;

    async function loadRun() {
      setIsLoading(true);
      setActionError("");
      setNotice("");

      try {
        const apiRun = await requestData<TestRun>(apiBase);

        if (!active) {
          return;
        }

        setRun(apiRun);
        saveTestRunDetailBackupSnapshot(projectId, runId, apiRun);
        setIsBackupMode(false);
      } catch {
        if (!active) {
          return;
        }

        const snapshot = loadTestRunDetailBackupSnapshot(projectId, runId);

        if (snapshot) {
          setRun(snapshot.run);
          setNotice(
            `백업 데이터 표시 중입니다. 마지막 백업: ${formatBackupTime(snapshot.savedAt)}`,
          );
        } else {
          const fallbackRun = loadMockRuns().find((item) => item.id === runId) ?? null;
          setRun(fallbackRun);
          setNotice("API 연결에 실패해 기존 mock fallback 데이터를 표시 중입니다.");
        }

        setIsBackupMode(true);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadRun();

    return () => {
      active = false;
    };
  }, [apiBase, projectId, runId]);

  const summary = run ? summarizeRun(run) : null;
  const activeResult =
    run?.results.find((result) => result.id === activeResultId) ??
    run?.results.find((result) => result.status === "pending") ??
    run?.results[0] ??
    null;

  useEffect(() => {
    if (!activeResult) {
      return;
    }

    setActiveResultId(activeResult.id);
    setActualResult(activeResult.actualResult);
  }, [activeResult]);

  const groupedResults = useMemo(() => {
    if (!run) {
      return new Map<ResultStatus, TestRunResult[]>();
    }

    return resultGroups.reduce((map, group) => {
      map.set(
        group.status,
        run.results.filter((result) => result.status === group.status),
      );
      return map;
    }, new Map<ResultStatus, TestRunResult[]>());
  }, [run]);

  async function updateResult(status: ResultStatus) {
    if (!run || !activeResult) {
      return;
    }

    if (!canUpdate) {
      setActionError(permissionMessage);
      return;
    }

    setActionError("");

    try {
      const updatedResult = await requestData<TestRunResult>(
        `${apiBase}/results/${encodeURIComponent(activeResult.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status,
            actualResult,
          }),
        },
      );
      const nextRun: TestRun = {
        ...run,
        status: run.status === "planned" ? "in_progress" : run.status,
        results: run.results.map((result) =>
          result.id === updatedResult.id ? updatedResult : result,
        ),
      };
      setRun(nextRun);
      saveTestRunDetailBackupSnapshot(projectId, runId, nextRun);

      const nextPending = nextRun.results.find(
        (result) => result.status === "pending" && result.id !== updatedResult.id,
      );

      if (status === "failed" || status === "blocked") {
        setDefectTarget(updatedResult);
      }

      if (nextPending) {
        setActiveResultId(nextPending.id);
        setActualResult(nextPending.actualResult);
      }
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  function move(delta: number) {
    if (!run || !activeResult) {
      return;
    }

    const index = run.results.findIndex((result) => result.id === activeResult.id);
    const next = run.results[index + delta];
    if (next) {
      setActiveResultId(next.id);
      setActualResult(next.actualResult);
    }
  }

  async function registerDefect(input: DefectDialogInput) {
    if (!run || !defectTarget) {
      setDefectTarget(null);
      return;
    }

    if (!canCreate) {
      setActionError(permissionMessage);
      setDefectTarget(null);
      return;
    }

    setActionError("");

    try {
      const payload = await requestData<{ result: TestRunResult | null }>(
        `${apiBase}/results/${encodeURIComponent(defectTarget.id)}/defects`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      );
      const updatedResult =
        payload.result ?? { ...defectTarget, defectCount: defectTarget.defectCount + 1 };
      const nextRun: TestRun = {
        ...run,
        results: run.results.map((result) =>
          result.id === updatedResult.id ? updatedResult : result,
        ),
      };
      setRun(nextRun);
      saveTestRunDetailBackupSnapshot(projectId, runId, nextRun);
      setDefectTarget(null);
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  if (!run || !summary) {
    return (
      <>
        {(isLoading || isBackupMode || actionError) && (
          <RunNotice
            isLoading={isLoading}
            isBackupMode={isBackupMode}
            notice={notice}
            actionError={actionError}
          />
        )}
        <EmptyState
          icon={Play}
          title="테스트 실행을 찾을 수 없습니다"
          description="목록에서 테스트 실행을 선택하거나 새 테스트 플랜을 생성하세요."
        />
      </>
    );
  }

  if (!activeResult) {
    return (
      <EmptyState
        icon={Play}
        title="실행할 테스트케이스가 없습니다"
        description="테스트 플랜 생성 시 실행 대상 테스트케이스를 1개 이상 선택해야 합니다."
      />
    );
  }

  return (
    <>
      {(isLoading || isBackupMode || actionError) && (
        <RunNotice
          isLoading={isLoading}
          isBackupMode={isBackupMode}
          notice={notice}
          actionError={actionError}
        />
      )}

      <section className="tf-card mb-5 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">{run.title}</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              담당자 {run.assignee} · 시작일 {run.startDate} · 환경 {run.environment}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              disabled={!canUpdate}
              title={!canUpdate ? permissionMessage : undefined}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Pause className="tf-icon" />
              일시정지
            </button>
            <button
              disabled={!canUpdate}
              title={!canUpdate ? permissionMessage : undefined}
              className="h-9 rounded-md bg-[var(--brand-primary)] px-3 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              완료
            </button>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-sm text-[var(--text-secondary)]">
            <span>
              {summary.done}/{summary.total} ({summary.progress}%)
            </span>
            <span>
              Pass {summary.pass} · Fail {summary.fail} · Block {summary.block} ·
              Skip {summary.skip}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-muted)]">
            <div
              className="h-full rounded-full bg-[var(--brand-primary)]"
              style={{ width: `${summary.progress}%` }}
            />
          </div>
        </div>
      </section>

      <div className="grid min-h-[640px] grid-cols-1 overflow-hidden rounded-lg border border-[var(--border-default)] bg-white xl:grid-cols-[minmax(320px,40%)_minmax(0,1fr)]">
        <aside className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] p-4 xl:border-b-0 xl:border-r">
          <h3 className="mb-3 text-sm font-semibold">실행 대상</h3>
          <div className="space-y-4">
            {resultGroups.map((group) => {
              const items = groupedResults.get(group.status) ?? [];
              return (
                <section key={group.status}>
                  <div className="mb-2 flex items-center justify-between">
                    <StatusBadge status={group.badge} label={group.label} />
                    <span className="text-xs text-[var(--text-secondary)]">
                      {items.length}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {items.map((result) => (
                      <button
                        key={result.id}
                        onClick={() => {
                          setActiveResultId(result.id);
                          setActualResult(result.actualResult);
                        }}
                        className={cn(
                          "w-full rounded-md border px-3 py-2 text-left text-sm",
                          activeResult.id === result.id
                            ? "border-[var(--brand-primary)] bg-white shadow-sm"
                            : "border-transparent text-[var(--text-secondary)] hover:bg-white",
                        )}
                      >
                        <span className="font-mono text-xs">{result.testCase.id}</span>
                        <span className="ml-2">{result.testCase.title}</span>
                        {result.defectCount > 0 && (
                          <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">
                            결함 {result.defectCount}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </aside>

        <section className="min-w-0 p-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 font-mono text-xs text-[var(--text-tertiary)]">
                {activeResult.testCase.id}
              </p>
              <h2 className="text-xl font-semibold">{activeResult.testCase.title}</h2>
            </div>
            <PriorityBadge
              priority={activeResult.testCase.priority}
              label={activeResult.testCase.priority}
            />
          </div>

          <InfoBox
            title="사전 조건"
            items={activeResult.testCase.preconditions
              .split("\n")
              .map((item) => item.replace(/^-\s*/, "").trim())
              .filter(Boolean)}
          />
          <InfoBox title="실행 단계" items={activeResult.testCase.steps} ordered />
          <div className="mb-5 rounded-lg bg-[var(--bg-subtle)] p-4">
            <h3 className="mb-2 text-sm font-semibold">기대 결과</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              {activeResult.testCase.expectedResult}
            </p>
          </div>

          <label className="mb-5 block text-sm font-medium">
            실제 결과
            <textarea
              value={actualResult}
              onChange={(event) => setActualResult(event.target.value)}
              disabled={!canUpdate}
              rows={4}
              className="mt-2 w-full resize-none rounded-md border border-[var(--border-default)] px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)] disabled:cursor-not-allowed disabled:bg-[var(--bg-subtle)]"
              placeholder="실제 실행 결과를 입력하세요"
            />
          </label>

          {!canUpdate && (
            <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {permissionMessage} 실행 결과 저장은 Admin 또는 Member 권한이 필요합니다.
            </div>
          )}

          <div className="mb-5 rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)] p-4">
            <div className="mb-1 flex items-center gap-2 text-sm font-medium">
              <Paperclip className="tf-icon" />
              첨부 파일
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              첨부 저장은 후속 단계에서 구현합니다.
            </p>
          </div>

          <div className="mb-5 grid gap-3 md:grid-cols-4">
            <ResultButton
              label="Pass"
              hotkey="1"
              icon={CheckCircle}
              className="bg-[var(--status-pass)] hover:bg-emerald-700"
              disabled={!canUpdate}
              title={!canUpdate ? permissionMessage : undefined}
              onClick={() => updateResult("passed")}
            />
            <ResultButton
              label="Fail"
              hotkey="2"
              icon={XCircle}
              className="bg-[var(--status-fail)] hover:bg-red-600"
              disabled={!canUpdate}
              title={!canUpdate ? permissionMessage : undefined}
              onClick={() => updateResult("failed")}
            />
            <ResultButton
              label="Block"
              hotkey="3"
              icon={AlertTriangle}
              className="bg-[var(--status-block)] hover:bg-amber-600"
              disabled={!canUpdate}
              title={!canUpdate ? permissionMessage : undefined}
              onClick={() => updateResult("blocked")}
            />
            <ResultButton
              label="Skip"
              hotkey="4"
              icon={MinusCircle}
              className="bg-[var(--status-skip)] hover:bg-slate-700"
              disabled={!canUpdate}
              title={!canUpdate ? permissionMessage : undefined}
              onClick={() => updateResult("skipped")}
            />
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => move(-1)}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
            >
              <ChevronLeft className="tf-icon" />
              이전 TC
            </button>
            <button
              onClick={() => move(1)}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
            >
              다음 TC
              <ChevronRight className="tf-icon" />
            </button>
          </div>
        </section>
      </div>

      {defectTarget && (
        <DefectDialog
          result={defectTarget}
          onClose={() => setDefectTarget(null)}
          onSubmit={(input) => void registerDefect(input)}
        />
      )}
    </>
  );
}

function RunNotice({
  isLoading,
  notice,
  actionError,
}: {
  isLoading: boolean;
  isBackupMode: boolean;
  notice: string;
  actionError: string;
}) {
  return (
    <div
      className={cn(
        "mb-4 rounded-lg border px-4 py-3 text-sm",
        actionError
          ? "border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-text)]"
          : "border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]",
      )}
    >
      {isLoading ? "테스트 실행 데이터를 불러오는 중입니다." : actionError || notice}
    </div>
  );
}

function InfoBox({
  title,
  items,
  ordered,
}: {
  title: string;
  items: string[];
  ordered?: boolean;
}) {
  return (
    <div className="mb-5 rounded-lg bg-[var(--bg-subtle)] p-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {ordered ? (
        <ol className="space-y-1 text-sm text-[var(--text-secondary)]">
          {items.map((item, index) => (
            <li key={`${item}-${index}`}>
              {index + 1}. {item}
            </li>
          ))}
        </ol>
      ) : (
        <ul className="space-y-1 text-sm text-[var(--text-secondary)]">
          {items.map((item, index) => (
            <li key={`${item}-${index}`}>- {item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ResultButton({
  label,
  hotkey,
  icon: Icon,
  className,
  onClick,
  disabled,
  title,
}: {
  label: string;
  hotkey: string;
  icon: React.ComponentType<{ className?: string }>;
  className: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg px-4 py-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        className,
        disabled && "cursor-not-allowed opacity-45 hover:translate-y-0 hover:shadow-sm",
      )}
    >
      <Icon className="tf-icon-md" />
      <span>{label}</span>
      <kbd className="rounded bg-white/20 px-1.5 py-0.5 text-xs">{hotkey}</kbd>
    </button>
  );
}

function DefectDialog({
  result,
  onClose,
  onSubmit,
}: {
  result: TestRunResult;
  onClose: () => void;
  onSubmit: (input: DefectDialogInput) => void;
}) {
  const [title, setTitle] = useState(`${result.testCase.title} 실패`);
  const [severity, setSeverity] = useState(result.status === "blocked" ? "major" : "critical");
  const [priority, setPriority] = useState("high");
  const [reproductionSteps, setReproductionSteps] = useState(
    result.testCase.steps.map((step, index) => `${index + 1}. ${step}`).join("\n"),
  );
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit() {
    setSubmitted(true);
    if (!title.trim()) {
      return;
    }
    onSubmit({
      title: title.trim(),
      severity,
      priority,
      reproductionSteps,
    });
  }

  return (
    <DialogShell
      title="결함 등록"
      description={`연관 TC: ${result.testCase.id} ${result.testCase.title}`}
      onClose={onClose}
      maxWidth="max-w-lg"
      footer={
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="h-9 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            className="h-9 rounded-md bg-[var(--brand-primary)] px-3 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)]"
          >
            결함 등록
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="rounded-md bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)]">
          연관 TC: {result.testCase.id} {result.testCase.title}
        </p>
        <FormField label="제목" required error={submitted && !title.trim() ? "제목을 입력하세요." : undefined}>
          <TextAreaField
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            rows={1}
            className="min-h-10"
          />
        </FormField>
        <div className="grid gap-3 md:grid-cols-2">
          <FormField label="심각도">
            <SelectField value={severity} onChange={(event) => setSeverity(event.target.value)}>
              <option value="critical">Critical</option>
              <option value="major">Major</option>
              <option value="minor">Minor</option>
              <option value="trivial">Trivial</option>
            </SelectField>
          </FormField>
          <FormField label="우선순위">
            <SelectField value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </SelectField>
          </FormField>
        </div>
        <FormField label="재현 단계">
          <TextAreaField
            value={reproductionSteps}
            onChange={(event) => setReproductionSteps(event.target.value)}
            rows={5}
          />
        </FormField>
      </div>
    </DialogShell>
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
