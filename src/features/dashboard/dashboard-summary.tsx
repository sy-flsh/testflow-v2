"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Bug, CheckCircle2, FolderKanban, PlayCircle } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { runStatusLabels } from "@/lib/domain/labels";
import type { DashboardSummaryResponse } from "@/lib/reports/report-summary";
import {
  loadDashboardSummaryBackupSnapshot,
  saveDashboardSummaryBackupSnapshot,
} from "@/lib/mock/mock-store";

export function DashboardSummary() {
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadSummary() {
      setIsLoading(true);
      setNotice("");

      try {
        const response = await fetch("/api/dashboard/summary", { cache: "no-store" });
        const payload = (await response.json()) as {
          data?: DashboardSummaryResponse;
          error?: { message?: string };
        };

        if (!response.ok || !payload.data) {
          throw new Error(payload.error?.message || "대시보드 요약을 불러오지 못했습니다.");
        }

        if (ignore) {
          return;
        }

        setSummary(payload.data);
        saveDashboardSummaryBackupSnapshot(payload.data);
      } catch (error) {
        if (ignore) {
          return;
        }

        const backup = loadDashboardSummaryBackupSnapshot<DashboardSummaryResponse>();

        if (backup) {
          setSummary(backup.data);
          setNotice(`API 연결 실패로 ${formatBackupTime(backup.savedAt)} 백업 데이터를 표시 중입니다.`);
        } else {
          setNotice(error instanceof Error ? error.message : "대시보드 요약을 불러오지 못했습니다.");
          setSummary(null);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadSummary();

    return () => {
      ignore = true;
    };
  }, []);

  if (isLoading && !summary) {
    return (
      <div className="tf-card p-6 text-sm text-[var(--text-secondary)]">
        대시보드 데이터를 불러오는 중입니다.
      </div>
    );
  }

  if (!summary) {
    return (
      <EmptyState
        icon={BarChart3}
        title="대시보드 데이터를 불러오지 못했습니다"
        description={notice || "잠시 후 다시 시도해 주세요."}
      />
    );
  }

  const kpis = [
    { label: "전체 프로젝트", value: summary.counts.projects.toLocaleString("ko-KR"), icon: FolderKanban },
    { label: "진행 중 테스트", value: summary.counts.executingRuns.toString(), icon: PlayCircle },
    { label: "실행된 Result", value: summary.counts.executedResults.toLocaleString("ko-KR"), icon: CheckCircle2 },
    { label: "발견된 결함", value: summary.counts.defects.toLocaleString("ko-KR"), icon: Bug },
  ];
  const executedCount = summary.counts.executedResults;
  const dailyResults = summary.dailyResults;

  return (
    <div className="space-y-6">
      {notice && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {notice}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <article key={kpi.label} className="tf-card p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[var(--text-secondary)]">{kpi.label}</p>
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-[var(--brand-primary)]">
                  <Icon className="tf-icon" />
                </span>
              </div>
              <p className="mt-3 text-2xl font-semibold">{kpi.value}</p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="tf-card p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">테스트 실행 요약</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                PostgreSQL TestRunResult 기준으로 계산됩니다.
              </p>
            </div>
            <StatusBadge status={summary.passRate >= 80 ? "passed" : "blocked"} label={`Pass ${summary.passRate}%`} />
          </div>
          {executedCount === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="아직 실행된 Result가 없습니다"
              description="테스트 실행 화면에서 Pass, Fail, Block, Skip 결과를 저장하면 이 영역에 반영됩니다."
            />
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-4">
                <ResultPill label="Pass" value={summary.resultCounts.passed} className="bg-emerald-50 text-emerald-700" />
                <ResultPill label="Fail" value={summary.resultCounts.failed} className="bg-red-50 text-red-700" />
                <ResultPill label="Block" value={summary.resultCounts.blocked} className="bg-amber-50 text-amber-700" />
                <ResultPill label="Skip" value={summary.resultCounts.skipped} className="bg-slate-100 text-slate-700" />
              </div>
              <div className="flex h-44 items-end gap-3">
                {dailyResults.map((item) => (
                  <div key={item.date} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-32 w-full max-w-14 items-end rounded-md bg-[var(--surface-muted)] px-1">
                      <div
                        className="w-full rounded-t-md bg-[var(--brand-primary)]"
                        style={{
                          height: `${Math.max((item.total / Math.max(...dailyResults.map((daily) => daily.total), 1)) * 100, 8)}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-[var(--text-tertiary)]">{item.date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </article>

        <article className="tf-card p-5">
          <h2 className="text-base font-semibold">최근 활동</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            ActivityEvent가 연결되기 전까지 실행/결함 데이터에서 요약합니다.
          </p>
          <div className="mt-5 space-y-3">
            {summary.recentRuns.map((run) => (
              <Link
                key={run.id}
                href={`/projects/${run.projectId}/runs/${run.id}`}
                className="block rounded-md border border-[var(--border-subtle)] p-3 hover:bg-[var(--surface-muted)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-semibold text-[var(--text-primary)]">{run.title}</span>
                  <StatusBadge status={run.status === "completed" ? "passed" : "in_progress"} label={runStatusLabels[run.status]} />
                </div>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  {run.assignee} · {run.environment} · {run.resultCount}개 TC
                </p>
              </Link>
            ))}
            {summary.recentDefects.map((defect) => (
              <div key={defect.id} className="rounded-md border border-[var(--border-subtle)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-semibold text-[var(--text-primary)]">{defect.title}</span>
                  <StatusBadge status={defect.status} label={defect.status === "in_progress" ? "In Progress" : defect.status} />
                </div>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  {defect.id} · {defect.linkedTestCaseId || "연결 TC 없음"}
                </p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="tf-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">진행 중 프로젝트</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              PostgreSQL Project/TestCase/Run 데이터를 함께 표시합니다.
            </p>
          </div>
          <span className="text-sm text-[var(--text-tertiary)]">TC {summary.counts.testCases}개</span>
        </div>
        {summary.activeProjects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="진행 중 프로젝트가 없습니다"
            description="활성 상태의 프로젝트가 생성되면 이 영역에 표시됩니다."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {summary.activeProjects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}/testcases`}
                className="rounded-lg border border-[var(--border-subtle)] p-4 hover:border-blue-200 hover:bg-blue-50/40"
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: project.color }} />
                  <span className="truncate text-sm font-semibold text-[var(--text-primary)]">{project.name}</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--surface-muted)]">
                  <div className="h-2 rounded-full bg-[var(--brand-primary)]" style={{ width: `${project.progress}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-xs text-[var(--text-tertiary)]">
                  <span>{project.progress}%</span>
                  <span>{project.updatedAtLabel}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ResultPill({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className={`rounded-md px-3 py-2 ${className}`}>
      <p className="text-xs font-semibold">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function formatBackupTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "최근";
  }

  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
