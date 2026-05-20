"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Bug,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Link2,
  Lock,
  Share2,
  Timer,
} from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { DialogShell } from "@/components/common/dialog-shell";
import { PriorityBadge } from "@/components/common/priority-badge";
import { StatusBadge } from "@/components/common/status-badge";
import { FormField, SelectField } from "@/components/common/form-field";
import { priorityLabels } from "@/lib/domain/labels";
import type {
  DailyResultSummary,
  DefectTrendSummary,
  GroupedResultSummary,
  TopFailedTestCase,
} from "@/lib/domain/summary";
import type { ProjectReportSummaryResponse } from "@/lib/reports/report-summary";
import {
  loadReportSummaryBackupSnapshot,
  saveReportSummaryBackupSnapshot,
} from "@/lib/mock/mock-store";

type ReportFilter = {
  period: "7d" | "14d" | "30d" | "custom";
  plan: string;
  assignee: string;
  environment: string;
};

export function ReportDashboard({ projectId }: { projectId: string }) {
  const [summary, setSummary] = useState<ProjectReportSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<ReportFilter>({
    period: "7d",
    plan: "전체 플랜",
    assignee: "전체 담당자",
    environment: "전체 환경",
  });
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCreated, setShareCreated] = useState(false);
  const [exportNotice, setExportNotice] = useState("");
  const [expiry, setExpiry] = useState("7");
  const [passwordProtected, setPasswordProtected] = useState(true);
  const [includeDefects, setIncludeDefects] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function loadSummary() {
      setIsLoading(true);
      setNotice("");

      const params = new URLSearchParams({
        period: filter.period,
        plan: filter.plan,
        assignee: filter.assignee,
        environment: filter.environment,
      });

      try {
        const response = await fetch(`/api/projects/${projectId}/reports/summary?${params.toString()}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          data?: ProjectReportSummaryResponse;
          error?: { message?: string };
        };

        if (!response.ok || !payload.data) {
          throw new Error(payload.error?.message || "보고서 요약을 불러오지 못했습니다.");
        }

        if (ignore) {
          return;
        }

        setSummary(payload.data);
        saveReportSummaryBackupSnapshot(projectId, payload.data);
      } catch (error) {
        if (ignore) {
          return;
        }

        const backup = loadReportSummaryBackupSnapshot<ProjectReportSummaryResponse>(projectId);

        if (backup) {
          setSummary(backup.data);
          setNotice(`API 연결 실패로 ${formatBackupTime(backup.savedAt)} 백업 데이터를 표시 중입니다.`);
        } else {
          setSummary(null);
          setNotice(error instanceof Error ? error.message : "보고서 요약을 불러오지 못했습니다.");
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
  }, [filter.assignee, filter.environment, filter.period, filter.plan, projectId]);

  const plans = summary?.filters.plans ?? ["전체 플랜"];
  const assignees = summary?.filters.assignees ?? ["전체 담당자"];
  const environments = summary?.filters.environments ?? ["전체 환경"];
  const kpis = useMemo(
    () => [
      {
        label: "총 실행",
        value: (summary?.kpis.totalResults ?? 0).toLocaleString("ko-KR"),
        detail: "선택 조건 Result 기준",
        icon: BarChart3,
      },
      {
        label: "Pass 비율",
        value: `${summary?.kpis.passRate ?? 0}%`,
        detail: "Pending 제외 계산",
        icon: CheckCircle2,
      },
      {
        label: "발견 결함",
        value: (summary?.kpis.defectCount ?? 0).toString(),
        detail: `Critical ${summary?.kpis.criticalDefectCount ?? 0}건 포함`,
        icon: Bug,
      },
      {
        label: "평균 실행 시간",
        value: summary?.kpis.averageExecutionTimeLabel ?? "0분",
        detail: "실측 duration 필드 연결 전 임시 표시",
        icon: Timer,
      },
    ],
    [summary],
  );
  const hasData = Boolean(summary?.hasData);

  function updateFilter<Key extends keyof ReportFilter>(key: Key, value: ReportFilter[Key]) {
    setFilter((current) => ({ ...current, [key]: value }));
  }

  function openExportNotice(type: "PDF" | "엑셀") {
    setExportNotice(`${type} 내보내기는 후속 Phase에서 실제 파일 생성으로 연결됩니다.`);
    window.setTimeout(() => setExportNotice(""), 2600);
  }

  function createShareLink() {
    setShareCreated(true);
  }

  return (
    <div className="space-y-5">
      <section className="tf-card p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <FormField label="기간">
              <SelectField value={filter.period} onChange={(event) => updateFilter("period", event.target.value as ReportFilter["period"])}>
                <option value="7d">최근 7일</option>
                <option value="14d">최근 14일</option>
                <option value="30d">최근 30일</option>
                <option value="custom">전체 기간</option>
              </SelectField>
            </FormField>
            <FormField label="플랜">
              <SelectField value={filter.plan} onChange={(event) => updateFilter("plan", event.target.value)}>
                {plans.map((plan, index) => (
                  <option key={`${plan}-${index}`} value={plan}>
                    {plan}
                  </option>
                ))}
              </SelectField>
            </FormField>
            <FormField label="담당자">
              <SelectField value={filter.assignee} onChange={(event) => updateFilter("assignee", event.target.value)}>
                {assignees.map((assignee, index) => (
                  <option key={`${assignee}-${index}`} value={assignee}>
                    {assignee}
                  </option>
                ))}
              </SelectField>
            </FormField>
            <FormField label="환경">
              <SelectField value={filter.environment} onChange={(event) => updateFilter("environment", event.target.value)}>
                {environments.map((environment, index) => (
                  <option key={`${environment}-${index}`} value={environment}>
                    {environment}
                  </option>
                ))}
              </SelectField>
            </FormField>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openExportNotice("PDF")}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-white px-3 text-sm font-medium hover:bg-[var(--surface-muted)]"
            >
              <FileText className="tf-icon" />
              PDF
            </button>
            <button
              type="button"
              onClick={() => openExportNotice("엑셀")}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-white px-3 text-sm font-medium hover:bg-[var(--surface-muted)]"
            >
              <FileSpreadsheet className="tf-icon" />
              엑셀
            </button>
            <button
              type="button"
              onClick={() => {
                setShareOpen(true);
                setShareCreated(false);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--brand-primary)] px-3 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
            >
              <Share2 className="tf-icon" />
              공유
            </button>
          </div>
        </div>
        {exportNotice && (
          <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            {exportNotice}
          </div>
        )}
        {notice && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {notice}
          </div>
        )}
      </section>

      {isLoading && !summary ? (
        <div className="tf-card p-6 text-sm text-[var(--text-secondary)]">
          보고서 데이터를 불러오는 중입니다.
        </div>
      ) : !hasData ? (
        <EmptyState
          icon={BarChart3}
          title="선택한 조건의 보고서 데이터가 없습니다"
          description="다른 테스트 플랜이나 기간을 선택하면 DB에 저장된 보고서 데이터를 확인할 수 있습니다."
        />
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {kpis.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <article key={kpi.label} className="tf-card p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--text-secondary)]">{kpi.label}</span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-[var(--brand-primary)]">
                      <Icon className="tf-icon" />
                    </span>
                  </div>
                  <div className="mt-4 text-2xl font-semibold text-[var(--text-primary)]">{kpi.value}</div>
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">{kpi.detail}</p>
                </article>
              );
            })}
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.35fr_0.9fr]">
            <ChartCard title="일별 실행 추이" description="일자별 실행 건수와 Pass 결과">
              <DailyExecutionChart data={summary?.dailyTrends ?? []} />
            </ChartCard>
            <ChartCard title="결과 비율" description="Pass / Fail / Block / Skip 구성">
              <DonutChart data={summary?.resultRatio ?? []} />
            </ChartCard>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <ChartCard title="담당자별 결과" description="담당자별 실행 결과 분포">
              <StackedBars data={summary?.assigneeResults ?? []} />
            </ChartCard>
            <ChartCard title="카테고리별 결과" description="업무 영역별 품질 신호">
              <CategoryBars data={summary?.categoryResults ?? []} />
            </ChartCard>
          </section>

          <section className="grid gap-5 xl:grid-cols-[0.95fr_1.25fr]">
            <ChartCard title="결함 트렌드" description="일별 Open / Resolved 변화">
              <DefectTrendChart data={summary?.defectTrend ?? []} />
            </ChartCard>
            <TopFailedTable data={summary?.topFailedCases ?? []} />
          </section>
        </>
      )}

      {shareOpen && (
        <DialogShell
          title="공유 링크 생성"
          description="실제 공유 링크 발급은 후속 Phase에서 API로 연결합니다."
          onClose={() => setShareOpen(false)}
          maxWidth="max-w-lg"
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShareOpen(false)}
                className="h-10 rounded-md border border-[var(--border-subtle)] px-4 text-sm font-medium hover:bg-[var(--surface-muted)]"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={createShareLink}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
              >
                <Link2 className="tf-icon" />
                링크 생성
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <FormField label="만료 기간">
              <SelectField value={expiry} onChange={(event) => setExpiry(event.target.value)}>
                <option value="1">1일</option>
                <option value="7">7일</option>
                <option value="30">30일</option>
                <option value="never">만료 없음</option>
              </SelectField>
            </FormField>
            <ToggleRow
              icon={Lock}
              title="비밀번호 보호"
              description="공유 링크 접근 시 비밀번호 입력을 요구합니다."
              checked={passwordProtected}
              onChange={setPasswordProtected}
            />
            <ToggleRow
              icon={Bug}
              title="결함 상세 공개"
              description="Top Failed TC와 연결된 결함 상세를 함께 표시합니다."
              checked={includeDefects}
              onChange={setIncludeDefects}
            />
            {shareCreated && (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-800">
                  <Link2 className="tf-icon" />
                  생성된 mock 링크
                </div>
                <div className="break-all rounded-md bg-white px-3 py-2 text-sm text-[var(--text-secondary)]">
                  https://testflow.local/share/report-demo-7d
                </div>
              </div>
            )}
          </div>
        </DialogShell>
      )}
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="tf-card p-5">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>
        </div>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-tertiary)] hover:bg-[var(--surface-muted)]"
          aria-label={`${title} 다운로드`}
        >
          <Download className="tf-icon" />
        </button>
      </div>
      {children}
    </section>
  );
}

function DailyExecutionChart({ data }: { data: DailyResultSummary[] }) {
  const maxTotal = Math.max(...data.map((item) => item.total), 1);

  return (
    <div className="flex h-64 items-end gap-3">
      {data.map((item) => (
        <div key={item.date} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-48 w-full max-w-12 items-end rounded-md bg-[var(--surface-muted)] px-1">
            <div
              className="w-full rounded-t-md bg-[var(--brand-primary)]"
              style={{ height: `${Math.max((item.total / maxTotal) * 100, 6)}%` }}
            />
          </div>
          <div className="text-xs text-[var(--text-tertiary)]">{item.date}</div>
        </div>
      ))}
    </div>
  );
}

function DonutChart({
  data,
}: {
  data: Array<{ label: string; value: number; color: string }>;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let offset = 25;

  return (
    <div className="flex flex-col items-center gap-5 md:flex-row md:justify-center">
      <svg viewBox="0 0 44 44" className="h-44 w-44 -rotate-90">
        <circle cx="22" cy="22" r="15.9155" fill="transparent" stroke="#E2E8F0" strokeWidth="6" />
        {data.map((item) => {
          const dash = total > 0 ? (item.value / total) * 100 : 0;
          const circle = (
            <circle
              key={item.label}
              cx="22"
              cy="22"
              r="15.9155"
              fill="transparent"
              stroke={item.color}
              strokeWidth="6"
              strokeDasharray={`${dash} ${100 - dash}`}
              strokeDashoffset={offset}
            />
          );
          offset -= dash;
          return circle;
        })}
      </svg>
      <div className="space-y-2">
        {data.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-8 text-sm">
            <span className="flex items-center gap-2 text-[var(--text-secondary)]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
            <span className="font-semibold text-[var(--text-primary)]">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StackedBars({
  data,
}: {
  data: GroupedResultSummary[];
}) {
  return (
    <div className="space-y-4">
      {data.map((item) => {
        const total = item.pass + item.fail + item.block + item.skip;
        return (
          <div key={item.name}>
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-medium text-[var(--text-primary)]">{item.name}</span>
              <span className="text-[var(--text-tertiary)]">{total}건</span>
            </div>
            <div className="flex h-4 overflow-hidden rounded-full bg-[var(--surface-muted)]">
              <div className="bg-emerald-500" style={{ width: `${total > 0 ? (item.pass / total) * 100 : 0}%` }} />
              <div className="bg-red-500" style={{ width: `${total > 0 ? (item.fail / total) * 100 : 0}%` }} />
              <div className="bg-amber-500" style={{ width: `${total > 0 ? (item.block / total) * 100 : 0}%` }} />
              <div className="bg-slate-400" style={{ width: `${total > 0 ? (item.skip / total) * 100 : 0}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CategoryBars({ data }: { data: GroupedResultSummary[] }) {
  const max = Math.max(...data.map((item) => item.pass + item.fail + item.block + item.skip), 1);

  return (
    <div className="space-y-4">
      {data.map((item) => {
        const total = item.pass + item.fail + item.block + item.skip;
        return (
          <div key={item.name} className="grid grid-cols-[88px_1fr_44px] items-center gap-3">
            <span className="text-sm font-medium text-[var(--text-primary)]">{item.name}</span>
            <div className="h-9 rounded-md bg-[var(--surface-muted)]">
              <div
                className="flex h-9 items-center rounded-md bg-blue-100 px-3 text-xs font-semibold text-blue-700"
                style={{ width: `${Math.max((total / max) * 100, 12)}%` }}
              >
                Fail {item.fail}
              </div>
            </div>
            <span className="text-right text-sm text-[var(--text-secondary)]">{total}</span>
          </div>
        );
      })}
    </div>
  );
}

function DefectTrendChart({ data }: { data: DefectTrendSummary[] }) {
  const max = Math.max(...data.flatMap((item) => [item.open, item.resolved]), 1);

  return (
    <div className="space-y-4">
      {data.map((item) => (
        <div key={item.date} className="grid grid-cols-[52px_1fr] items-center gap-3">
          <span className="text-xs text-[var(--text-tertiary)]">{item.date}</span>
          <div className="space-y-1.5">
            <div className="h-2 rounded-full bg-red-100">
              <div className="h-2 rounded-full bg-red-500" style={{ width: `${(item.open / max) * 100}%` }} />
            </div>
            <div className="h-2 rounded-full bg-emerald-100">
              <div
                className="h-2 rounded-full bg-emerald-500"
                style={{ width: `${(item.resolved / max) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ))}
      <div className="flex gap-4 text-xs text-[var(--text-secondary)]">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
          Open
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Resolved
        </span>
      </div>
    </div>
  );
}

function TopFailedTable({ data }: { data: TopFailedTestCase[] }) {
  return (
    <section className="tf-card overflow-hidden">
      <div className="border-b border-[var(--border-subtle)] p-5">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">Top Failed Test Cases</h3>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          실패/차단 결과가 많은 테스트케이스입니다.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-[var(--surface-muted)] text-xs font-semibold uppercase text-[var(--text-tertiary)]">
            <tr>
              <th className="px-4 py-3 text-left">TC</th>
              <th className="px-4 py-3 text-left">폴더</th>
              <th className="px-4 py-3 text-left">우선순위</th>
              <th className="px-4 py-3 text-right">Fail</th>
              <th className="px-4 py-3 text-right">Block</th>
              <th className="px-4 py-3 text-right">결함</th>
              <th className="px-4 py-3 text-left">최근 실패</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {data.map((testCase) => (
              <tr key={testCase.id} className="hover:bg-blue-50/40">
                <td className="px-4 py-3">
                  <div className="font-semibold text-[var(--brand-primary)]">{testCase.id}</div>
                  <div className="mt-1 max-w-[280px] truncate text-[var(--text-primary)]">
                    {testCase.title}
                  </div>
                </td>
                <td className="px-4 py-3 text-[var(--text-secondary)]">{testCase.folder}</td>
                <td className="px-4 py-3">
                  <PriorityBadge
                    priority={testCase.priority}
                    label={priorityLabels[testCase.priority]}
                  />
                </td>
                <td className="px-4 py-3 text-right font-semibold text-red-600">{testCase.failCount}</td>
                <td className="px-4 py-3 text-right font-semibold text-amber-600">{testCase.blockCount}</td>
                <td className="px-4 py-3 text-right">
                  <StatusBadge status="open" label={`${testCase.linkedDefects}건`} />
                </td>
                <td className="px-4 py-3 text-[var(--text-secondary)]">{testCase.lastFailedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ToggleRow({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: typeof Lock;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-md border border-[var(--border-subtle)] p-3">
      <span className="flex gap-3">
        <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-blue-50 text-[var(--brand-primary)]">
          <Icon className="tf-icon" />
        </span>
        <span>
          <span className="block text-sm font-semibold text-[var(--text-primary)]">{title}</span>
          <span className="mt-1 block text-sm text-[var(--text-secondary)]">{description}</span>
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-[var(--border-subtle)]"
      />
    </label>
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
