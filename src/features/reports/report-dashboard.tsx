"use client";

import { useMemo, useState } from "react";
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
  X,
} from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PriorityBadge } from "@/components/common/priority-badge";
import { StatusBadge } from "@/components/common/status-badge";

type ReportFilter = {
  period: "7d" | "14d" | "30d" | "custom";
  plan: string;
  assignee: string;
  environment: string;
};

type DailyTrend = {
  date: string;
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
};

type TopFailedCase = {
  id: string;
  title: string;
  folder: string;
  failCount: number;
  blockCount: number;
  linkedDefects: number;
  priority: "high" | "medium" | "low";
  lastFailedAt: string;
};

const plans = ["전체 플랜", "Sprint 12 회귀 테스트", "결제 모듈 Smoke Test", "출시 전 최종 검증"];
const assignees = ["전체 담당자", "김QA", "홍길동", "정QA"];
const environments = ["전체 환경", "QA Server", "Staging", "Prod Mirror"];

const dailyTrends: DailyTrend[] = [
  { date: "05/12", total: 18, passed: 14, failed: 2, blocked: 1, skipped: 1 },
  { date: "05/13", total: 24, passed: 18, failed: 3, blocked: 2, skipped: 1 },
  { date: "05/14", total: 31, passed: 22, failed: 5, blocked: 3, skipped: 1 },
  { date: "05/15", total: 27, passed: 20, failed: 4, blocked: 2, skipped: 1 },
  { date: "05/16", total: 34, passed: 27, failed: 4, blocked: 2, skipped: 1 },
  { date: "05/17", total: 42, passed: 33, failed: 5, blocked: 2, skipped: 2 },
  { date: "05/18", total: 29, passed: 23, failed: 3, blocked: 2, skipped: 1 },
];

const resultRatio = [
  { label: "Pass", value: 157, color: "#10B981" },
  { label: "Fail", value: 26, color: "#EF4444" },
  { label: "Block", value: 14, color: "#F59E0B" },
  { label: "Skip", value: 8, color: "#64748B" },
];

const assigneeResults = [
  { name: "김QA", pass: 64, fail: 10, block: 5, skip: 3 },
  { name: "홍길동", pass: 48, fail: 7, block: 4, skip: 2 },
  { name: "정QA", pass: 45, fail: 9, block: 5, skip: 3 },
];

const categoryResults = [
  { name: "결제하기", pass: 54, fail: 13, block: 6 },
  { name: "환불", pass: 33, fail: 5, block: 3 },
  { name: "회원가입", pass: 38, fail: 4, block: 2 },
  { name: "마이페이지", pass: 32, fail: 4, block: 3 },
];

const defectTrend = [
  { date: "05/12", open: 3, resolved: 1 },
  { date: "05/13", open: 5, resolved: 2 },
  { date: "05/14", open: 9, resolved: 3 },
  { date: "05/15", open: 8, resolved: 5 },
  { date: "05/16", open: 7, resolved: 6 },
  { date: "05/17", open: 6, resolved: 8 },
  { date: "05/18", open: 5, resolved: 10 },
];

const topFailedCases: TopFailedCase[] = [
  {
    id: "TC-002",
    title: "잔액 부족 시 결제 실패 처리",
    folder: "결제하기",
    failCount: 5,
    blockCount: 1,
    linkedDefects: 2,
    priority: "high",
    lastFailedAt: "2026-05-18",
  },
  {
    id: "TC-005",
    title: "결제 중 네트워크 단절 시 복구",
    folder: "결제하기",
    failCount: 4,
    blockCount: 2,
    linkedDefects: 1,
    priority: "high",
    lastFailedAt: "2026-05-17",
  },
  {
    id: "TC-003",
    title: "환불 요청 후 영수증 발행 확인",
    folder: "환불",
    failCount: 3,
    blockCount: 1,
    linkedDefects: 1,
    priority: "medium",
    lastFailedAt: "2026-05-16",
  },
  {
    id: "TC-008",
    title: "검색어 자동완성 결과 표시",
    folder: "검색",
    failCount: 2,
    blockCount: 0,
    linkedDefects: 1,
    priority: "low",
    lastFailedAt: "2026-05-15",
  },
];

export function ReportDashboard() {
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

  const hasData = filter.plan !== "출시 전 최종 검증";

  const kpis = useMemo(() => {
    const total = dailyTrends.reduce((sum, item) => sum + item.total, 0);
    const passed = dailyTrends.reduce((sum, item) => sum + item.passed, 0);
    const defects = resultRatio.find((item) => item.label === "Fail")?.value ?? 0;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

    return [
      { label: "총 실행", value: total.toLocaleString("ko-KR"), detail: "최근 7일 기준", icon: BarChart3 },
      { label: "Pass 비율", value: `${passRate}%`, detail: "전주 대비 +4.2%", icon: CheckCircle2 },
      { label: "발견 결함", value: defects.toString(), detail: "Critical 3건 포함", icon: Bug },
      { label: "평균 실행 시간", value: "4분 18초", detail: "TC 1건 평균", icon: Timer },
    ];
  }, []);

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
            <FieldSelect
              label="기간"
              value={filter.period}
              onChange={(value) => updateFilter("period", value as ReportFilter["period"])}
              options={[
                ["7d", "최근 7일"],
                ["14d", "최근 14일"],
                ["30d", "최근 30일"],
                ["custom", "사용자 지정"],
              ]}
            />
            <FieldSelect
              label="플랜"
              value={filter.plan}
              onChange={(value) => updateFilter("plan", value)}
              options={plans.map((plan) => [plan, plan])}
            />
            <FieldSelect
              label="담당자"
              value={filter.assignee}
              onChange={(value) => updateFilter("assignee", value)}
              options={assignees.map((assignee) => [assignee, assignee])}
            />
            <FieldSelect
              label="환경"
              value={filter.environment}
              onChange={(value) => updateFilter("environment", value)}
              options={environments.map((environment) => [environment, environment])}
            />
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
      </section>

      {!hasData ? (
        <EmptyState
          icon={BarChart3}
          title="선택한 조건의 보고서 데이터가 없습니다"
          description="다른 테스트 플랜이나 기간을 선택하면 mock 보고서 데이터를 확인할 수 있습니다."
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
              <DailyExecutionChart data={dailyTrends} />
            </ChartCard>
            <ChartCard title="결과 비율" description="Pass / Fail / Block / Skip 구성">
              <DonutChart />
            </ChartCard>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <ChartCard title="담당자별 결과" description="담당자별 실행 결과 분포">
              <StackedBars data={assigneeResults} />
            </ChartCard>
            <ChartCard title="카테고리별 결과" description="업무 영역별 품질 신호">
              <CategoryBars />
            </ChartCard>
          </section>

          <section className="grid gap-5 xl:grid-cols-[0.95fr_1.25fr]">
            <ChartCard title="결함 트렌드" description="일별 Open / Resolved 변화">
              <DefectTrendChart />
            </ChartCard>
            <TopFailedTable />
          </section>
        </>
      )}

      {shareOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">공유 링크 생성</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  실제 공유 링크 발급은 후속 Phase에서 API로 연결합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShareOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-[var(--surface-muted)]"
                aria-label="공유 Dialog 닫기"
              >
                <X className="tf-icon" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <FieldSelect
                label="만료 기간"
                value={expiry}
                onChange={setExpiry}
                options={[
                  ["1", "1일"],
                  ["7", "7일"],
                  ["30", "30일"],
                  ["never", "만료 없음"],
                ]}
              />
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
            <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-4">
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
        className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-white px-3 text-sm outline-none focus:border-[var(--brand-primary)]"
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

function DailyExecutionChart({ data }: { data: DailyTrend[] }) {
  const maxTotal = Math.max(...data.map((item) => item.total));

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

function DonutChart() {
  const total = resultRatio.reduce((sum, item) => sum + item.value, 0);
  let offset = 25;

  return (
    <div className="flex flex-col items-center gap-5 md:flex-row md:justify-center">
      <svg viewBox="0 0 44 44" className="h-44 w-44 -rotate-90">
        <circle cx="22" cy="22" r="15.9155" fill="transparent" stroke="#E2E8F0" strokeWidth="6" />
        {resultRatio.map((item) => {
          const dash = (item.value / total) * 100;
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
        {resultRatio.map((item) => (
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
  data: Array<{ name: string; pass: number; fail: number; block: number; skip: number }>;
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
              <div className="bg-emerald-500" style={{ width: `${(item.pass / total) * 100}%` }} />
              <div className="bg-red-500" style={{ width: `${(item.fail / total) * 100}%` }} />
              <div className="bg-amber-500" style={{ width: `${(item.block / total) * 100}%` }} />
              <div className="bg-slate-400" style={{ width: `${(item.skip / total) * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CategoryBars() {
  const max = Math.max(...categoryResults.map((item) => item.pass + item.fail + item.block));

  return (
    <div className="space-y-4">
      {categoryResults.map((item) => {
        const total = item.pass + item.fail + item.block;
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

function DefectTrendChart() {
  const max = Math.max(...defectTrend.flatMap((item) => [item.open, item.resolved]));

  return (
    <div className="space-y-4">
      {defectTrend.map((item) => (
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

function TopFailedTable() {
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
            {topFailedCases.map((testCase) => (
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
                    label={testCase.priority === "high" ? "High" : testCase.priority === "medium" ? "Medium" : "Low"}
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
