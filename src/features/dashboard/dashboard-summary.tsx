"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Bug, CheckCircle2, FolderKanban, PlayCircle } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import type { Defect, Project, TestCase, TestRun } from "@/lib/domain/types";
import { runStatusLabels } from "@/lib/domain/labels";
import {
  calculatePassRate,
  countExecutedResults,
  countResults,
  flattenRunResults,
  summarizeByRunDate,
} from "@/lib/domain/summary";
import { mockDefects, mockProjects, mockTestCases, mockTestRuns } from "@/lib/mock/mock-data";
import { loadMockDefects, loadMockProjects, loadMockRuns, loadMockTestCases } from "@/lib/mock/mock-store";

export function DashboardSummary() {
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [testCases, setTestCases] = useState<TestCase[]>(mockTestCases);
  const [runs, setRuns] = useState<TestRun[]>(mockTestRuns);
  const [defects, setDefects] = useState<Defect[]>(mockDefects);

  useEffect(() => {
    setProjects(loadMockProjects());
    setTestCases(loadMockTestCases());
    setRuns(loadMockRuns());
    setDefects(loadMockDefects());
  }, []);

  const results = flattenRunResults(runs);
  const resultCounts = countResults(results);
  const executedCount = countExecutedResults(results);
  const passRate = calculatePassRate(results);
  const dailyResults = summarizeByRunDate(runs);
  const activeProjects = projects.filter((project) => project.status === "active").slice(0, 4);
  const recentRuns = runs.slice(0, 3);
  const recentDefects = defects.slice(0, 3);

  const kpis = [
    { label: "전체 프로젝트", value: projects.length.toLocaleString("ko-KR"), icon: FolderKanban },
    { label: "진행 중 테스트", value: runs.filter((run) => run.status === "in_progress").length.toString(), icon: PlayCircle },
    { label: "실행된 Result", value: executedCount.toLocaleString("ko-KR"), icon: CheckCircle2 },
    { label: "발견된 결함", value: defects.length.toLocaleString("ko-KR"), icon: Bug },
  ];

  return (
    <div className="space-y-6">
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
                중앙 mock store의 TestRunResult 기준으로 계산됩니다.
              </p>
            </div>
            <StatusBadge status={passRate >= 80 ? "passed" : "blocked"} label={`Pass ${passRate}%`} />
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
                <ResultPill label="Pass" value={resultCounts.passed} className="bg-emerald-50 text-emerald-700" />
                <ResultPill label="Fail" value={resultCounts.failed} className="bg-red-50 text-red-700" />
                <ResultPill label="Block" value={resultCounts.blocked} className="bg-amber-50 text-amber-700" />
                <ResultPill label="Skip" value={resultCounts.skipped} className="bg-slate-100 text-slate-700" />
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
            {recentRuns.map((run) => (
              <Link
                key={run.id}
                href={`/projects/demo-project/runs/${run.id}`}
                className="block rounded-md border border-[var(--border-subtle)] p-3 hover:bg-[var(--surface-muted)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-semibold text-[var(--text-primary)]">{run.title}</span>
                  <StatusBadge status={run.status === "completed" ? "passed" : "in_progress"} label={runStatusLabels[run.status]} />
                </div>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  {run.assignee} · {run.environment} · {run.results.length}개 TC
                </p>
              </Link>
            ))}
            {recentDefects.map((defect) => (
              <div key={defect.id} className="rounded-md border border-[var(--border-subtle)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-semibold text-[var(--text-primary)]">{defect.title}</span>
                  <StatusBadge status={defect.status} label={defect.status === "in_progress" ? "In Progress" : defect.status} />
                </div>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  {defect.id} · {defect.linkedTestCaseId}
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
              중앙 Project/TestCase/Run mock 데이터를 함께 표시합니다.
            </p>
          </div>
          <span className="text-sm text-[var(--text-tertiary)]">TC {testCases.length}개</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {activeProjects.map((project) => (
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
