"use client";

import {
  Calendar,
  Circle,
  Clock,
  MoreVertical,
  Play,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { cn } from "@/lib/utils";
import {
  createRun,
  loadMockRuns,
  mockTestCases,
  saveMockRuns,
  summarizeRun,
  toRunId,
  type MockTestRun,
  type RunStatus,
} from "@/features/test-runs/mock-test-run-store";

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

export function TestRunList({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [runs, setRuns] = useState<MockTestRun[]>(() => loadMockRuns());
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<RunStatus | "all">("all");
  const [isCreateOpen, setCreateOpen] = useState(false);

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

  function persist(nextRuns: MockTestRun[]) {
    setRuns(nextRuns);
    saveMockRuns(nextRuns);
  }

  function handleCreate(run: MockTestRun, startNow: boolean) {
    const nextRuns = [run, ...runs];
    persist(nextRuns);
    setCreateOpen(false);

    if (startNow) {
      router.push(`/projects/${projectId}/runs/${run.id}`);
    }
  }

  return (
    <>
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
          onClick={() => setCreateOpen(true)}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--brand-primary)] px-3 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)]"
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
          onClose={() => setCreateOpen(false)}
          onCreate={handleCreate}
        />
      )}
    </>
  );
}

function RunCard({ run, onOpen }: { run: MockTestRun; onOpen: () => void }) {
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
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (run: MockTestRun, startNow: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState("김QA");
  const [environment, setEnvironment] = useState("QA Server");
  const [startDate, setStartDate] = useState("2026-05-18");
  const [dueDate, setDueDate] = useState("2026-05-21");
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const titleError = submitted && !title.trim();
  const selectionError = submitted && selectedCaseIds.length === 0;

  function buildRun() {
    const id = toRunId(title);

    return createRun({
      id,
      title: title.trim(),
      description: description.trim() || "새 테스트 플랜",
      assignee,
      environment,
      startDate,
      dueDate,
      status: "in_progress",
      createdLabel: "방금 전",
      cases: mockTestCases.filter((testCase) =>
        selectedCaseIds.includes(testCase.id),
      ),
    });
  }

  function handleSubmit(startNow: boolean) {
    setSubmitted(true);

    if (!title.trim() || selectedCaseIds.length === 0) {
      return;
    }

    onCreate(buildRun(), startNow);
  }

  function toggleCase(id: string) {
    setSelectedCaseIds((current) =>
      current.includes(id)
        ? current.filter((caseId) => caseId !== id)
        : [...current, id],
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-lg border border-[var(--border-default)] bg-white shadow-xl">
        <header className="flex h-14 items-center justify-between border-b border-[var(--border-default)] px-5">
          <h2 className="text-base font-semibold">새 테스트 플랜 만들기</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-tertiary)] hover:bg-[var(--bg-muted)]"
            aria-label="닫기"
          >
            <X className="tf-icon" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section>
            <h3 className="mb-3 text-sm font-semibold">기본 정보</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium md:col-span-2">
                플랜 이름 <span className="text-[var(--status-fail)]">*</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className={cn(
                    "mt-2 h-10 w-full rounded-md border px-3 text-sm outline-none focus:border-[var(--brand-primary)]",
                    titleError
                      ? "border-[var(--status-fail)]"
                      : "border-[var(--border-default)]",
                  )}
                  placeholder="Sprint 13 회귀 테스트"
                />
                {titleError && (
                  <span className="mt-1 block text-xs text-[var(--status-fail)]">
                    플랜 이름을 입력하세요.
                  </span>
                )}
              </label>
              <label className="block text-sm font-medium md:col-span-2">
                설명
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  className="mt-2 w-full resize-none rounded-md border border-[var(--border-default)] px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
                />
              </label>
              <SelectField
                label="담당자"
                value={assignee}
                onChange={setAssignee}
                options={["김QA", "홍길동", "이PM", "박개발"]}
              />
              <SelectField
                label="실행 환경"
                value={environment}
                onChange={setEnvironment}
                options={["Dev", "QA Server", "Staging", "Prod"]}
              />
              <DateField label="시작일" value={startDate} onChange={setStartDate} />
              <DateField label="마감일" value={dueDate} onChange={setDueDate} />
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">테스트케이스 선택</h3>
              <span className="text-sm text-[var(--text-secondary)]">
                현재 {selectedCaseIds.length}/{mockTestCases.length}개 선택됨
              </span>
            </div>
            {selectionError && (
              <p className="mb-2 text-sm text-[var(--status-fail)]">
                실행할 테스트케이스를 1개 이상 선택하세요.
              </p>
            )}
            <div className="max-h-72 overflow-y-auto rounded-lg border border-[var(--border-default)]">
              {mockTestCases.length === 0 ? (
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
                          checked={selectedCaseIds.length === mockTestCases.length}
                          onChange={() =>
                            setSelectedCaseIds((current) =>
                              current.length === mockTestCases.length
                                ? []
                                : mockTestCases.map((testCase) => testCase.id),
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
                    {mockTestCases.map((testCase) => (
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
          </section>
        </div>

        <footer className="flex justify-end gap-2 border-t border-[var(--border-default)] px-5 py-4">
          <button
            onClick={onClose}
            className="h-9 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            취소
          </button>
          <button
            onClick={() => handleSubmit(false)}
            className="h-9 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            임시저장
          </button>
          <button
            onClick={() => handleSubmit(true)}
            className="h-9 rounded-md bg-[var(--brand-primary)] px-3 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)]"
          >
            플랜 생성 & 실행 시작
          </button>
        </footer>
      </div>
    </div>
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

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-10 w-full rounded-md border border-[var(--border-default)] bg-white px-3 text-sm outline-none focus:border-[var(--brand-primary)]"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
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
