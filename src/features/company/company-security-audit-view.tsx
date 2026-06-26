"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, ScrollText, ShieldAlert } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/common/empty-state";
import {
  COMPANY_SECURITY_AUDIT_EVENT_TYPES,
  COMPANY_SECURITY_AUDIT_SIZES,
  SECURITY_AUDIT_EVENT_LABELS,
  normalizeSecurityAuditDate,
  normalizeSecurityAuditEventType,
  normalizeSecurityAuditPage,
  normalizeSecurityAuditQuery,
  normalizeSecurityAuditSize,
  normalizeSecurityAuditSort,
} from "@/lib/company/security-audit-filters";
import type {
  InvitationPagination,
  SecurityAuditEventDto,
  SecurityAuditEventTypeFilter,
  SecurityAuditSort,
  SecurityAuditSummary,
  SecurityAuditUserRef,
} from "@/lib/company/types";
import { cn } from "@/lib/utils";
import { CompanyUserDrawer } from "./company-user-drawer";

type LoadState =
  | { kind: "loading" }
  | { kind: "forbidden" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      events: SecurityAuditEventDto[];
      pagination: InvitationPagination;
      summary: SecurityAuditSummary;
    };

type AuditParamPatch = Record<string, string | number | null>;

const PARAM_DEFAULTS: Record<string, string | number> = {
  auditType: "ALL",
  auditSort: "newest",
  auditSize: 20,
  auditPage: 1,
};

const EVENT_TYPE_LABELS: Record<SecurityAuditEventTypeFilter, string> = {
  ALL: "전체",
  ...SECURITY_AUDIT_EVENT_LABELS,
} as Record<SecurityAuditEventTypeFilter, string>;

const EVENT_BADGE_STYLES: Record<string, string> = {
  COMPANY_USER_DEACTIVATED: "bg-[var(--bg-muted)] text-[var(--text-secondary)] ring-[var(--border-default)]",
  COMPANY_USER_REACTIVATED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  INACTIVE_COMPANY_ACCESS_DENIED: "bg-amber-50 text-amber-700 ring-amber-200",
};

const SORT_OPTIONS: Array<{ value: SecurityAuditSort; label: string }> = [
  { value: "newest", label: "최신순" },
  { value: "oldest", label: "오래된순" },
];

// --- UTC 날짜 helper (audit API 가 UTC day boundary 를 사용) ---
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoUtc(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
type PresetKey = "all" | "today" | "7d" | "30d";
function activePreset(from: string, to: string): PresetKey | null {
  if (!from && !to) return "all";
  const today = todayUtc();
  if (from === today && to === today) return "today";
  if (from === daysAgoUtc(6) && to === today) return "7d";
  if (from === daysAgoUtc(29) && to === today) return "30d";
  return null;
}

export function CompanySecurityAuditView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const params = {
    eventType: normalizeSecurityAuditEventType(searchParams.get("auditType")),
    from: normalizeSecurityAuditDate(searchParams.get("auditFrom")) ?? "",
    to: normalizeSecurityAuditDate(searchParams.get("auditTo")) ?? "",
    user: normalizeSecurityAuditQuery(searchParams.get("auditUser")),
    guard: normalizeSecurityAuditQuery(searchParams.get("auditGuard")),
    page: normalizeSecurityAuditPage(searchParams.get("auditPage")),
    size: normalizeSecurityAuditSize(searchParams.get("auditSize")),
    sort: normalizeSecurityAuditSort(searchParams.get("auditSort")),
  };

  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [userDraft, setUserDraft] = useState(params.user);
  const [guardDraft, setGuardDraft] = useState(params.guard);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { eventType, from, to, user, guard, page, size, sort } = params;
  const preset = activePreset(from, to);

  useEffect(() => {
    setUserDraft(user);
  }, [user]);
  useEffect(() => {
    setGuardDraft(guard);
  }, [guard]);

  const updateUrl = useCallback(
    (patch: AuditParamPatch, opts?: { replace?: boolean }) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        const isDefault =
          value === null || value === undefined || value === "" || PARAM_DEFAULTS[key] === value;
        if (isDefault) {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }
      const query = next.toString();
      const href = query ? `${pathname}?${query}` : pathname;
      if (opts?.replace) {
        router.replace(href, { scroll: false });
      } else {
        router.push(href, { scroll: false });
      }
    },
    [searchParams, pathname, router],
  );

  // 현재 필터 → API query string (page/size 포함). export 는 page/size 제외.
  const buildQuery = useCallback(
    (includePaging: boolean) => {
      const sp = new URLSearchParams();
      if (eventType !== "ALL") sp.set("eventType", eventType);
      if (from) sp.set("from", from);
      if (to) sp.set("to", to);
      if (user) sp.set("user", user);
      if (guard) sp.set("guard", guard);
      if (sort !== "newest") sp.set("sort", sort);
      if (includePaging) {
        if (size !== 20) sp.set("size", String(size));
        if (page !== 1) sp.set("page", String(page));
      }
      return sp.toString();
    },
    [eventType, from, to, user, guard, sort, size, page],
  );

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const query = buildQuery(true);

    try {
      const response = await fetch(
        `/api/company/security-audit${query ? `?${query}` : ""}`,
        { cache: "no-store" },
      );
      const payload = (await response.json().catch(() => null)) as
        | {
            data?: {
              events: SecurityAuditEventDto[];
              pagination: InvitationPagination;
              summary: SecurityAuditSummary;
            };
            error?: { message?: string };
          }
        | null;

      if (response.status === 403) {
        setState({ kind: "forbidden" });
        return;
      }
      if (!response.ok || !payload?.data) {
        setState({
          kind: "error",
          message: payload?.error?.message ?? "보안 감사 로그를 불러오지 못했습니다.",
        });
        return;
      }

      setState({
        kind: "ready",
        events: payload.data.events,
        pagination: payload.data.pagination,
        summary: payload.data.summary,
      });

      if (payload.data.pagination.page !== page) {
        updateUrl({ auditPage: payload.data.pagination.page }, { replace: true });
      }
    } catch {
      setState({ kind: "error", message: "보안 감사 로그를 불러오지 못했습니다." });
    }
  }, [buildQuery, page, updateUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    const query = buildQuery(false);
    try {
      const response = await fetch(
        `/api/company/security-audit/export${query ? `?${query}` : ""}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setExportError(payload?.error?.message ?? "보안 감사 로그를 내보내지 못했습니다.");
        return;
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? "security-audit.csv";

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setExportError("내보내기에 실패했습니다. 네트워크 상태를 확인해 주세요.");
    } finally {
      setExporting(false);
    }
  }

  const hasFilter =
    eventType !== "ALL" || Boolean(from) || Boolean(to) || Boolean(user) || Boolean(guard);

  function resetFilters() {
    updateUrl({
      auditType: null,
      auditFrom: null,
      auditTo: null,
      auditUser: null,
      auditGuard: null,
      auditPage: null,
      auditSize: null,
      auditSort: null,
    });
  }

  function applyPreset(key: PresetKey) {
    if (key === "all") {
      updateUrl({ auditFrom: null, auditTo: null, auditPage: null });
      return;
    }
    const today = todayUtc();
    const fromDate = key === "today" ? today : key === "7d" ? daysAgoUtc(6) : daysAgoUtc(29);
    updateUrl({ auditFrom: fromDate, auditTo: today, auditPage: null });
  }

  if (state.kind === "forbidden") {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="CO 권한이 필요합니다"
        description="보안 감사 로그는 Company 소유자(CO)만 확인할 수 있습니다."
      />
    );
  }

  const summary = state.kind === "ready" ? state.summary : null;

  return (
    <div className="space-y-4">
      {/* 통계 카드 (현재 date/user/guard 기준, eventType 무관) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="전체 이벤트" value={summary?.total} tone="neutral" />
        <SummaryCard label="사용자 비활성화" value={summary?.byEventType.COMPANY_USER_DEACTIVATED} tone="neutral" />
        <SummaryCard label="사용자 활성화" value={summary?.byEventType.COMPANY_USER_REACTIVATED} tone="emerald" />
        <SummaryCard label="비활성 사용자 접근 차단" value={summary?.byEventType.INACTIVE_COMPANY_ACCESS_DENIED} tone="amber" />
      </div>
      <p className="text-xs text-[var(--text-tertiary)]">
        통계 카드는 현재 기간·사용자·Guard 조건 기준이며, 이벤트 유형 선택과 무관하게 전체 유형을 비교합니다. 기간은 UTC 기준으로 조회됩니다.
      </p>

      {/* 기간 프리셋 + 내보내기 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {([
            ["all", "전체"],
            ["today", "오늘"],
            ["7d", "최근 7일"],
            ["30d", "최근 30일"],
          ] as Array<[PresetKey, string]>).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className={cn(
                "h-8 rounded-md px-3 text-xs font-medium ring-1 ring-inset transition-colors",
                preset === key
                  ? "bg-[var(--brand-primary)] text-white ring-[var(--brand-primary)]"
                  : "bg-white text-[var(--text-secondary)] ring-[var(--border-default)] hover:bg-[var(--bg-subtle)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {exportError && <span className="text-xs text-[var(--danger-text)]">{exportError}</span>}
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            {exporting ? "내보내는 중…" : "CSV 내보내기"}
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-wrap gap-1">
          {COMPANY_SECURITY_AUDIT_EVENT_TYPES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => updateUrl({ auditType: value, auditPage: null })}
              className={cn(
                "h-8 rounded-md px-3 text-xs font-medium ring-1 ring-inset transition-colors",
                eventType === value
                  ? "bg-[var(--brand-primary)] text-white ring-[var(--brand-primary)]"
                  : "bg-white text-[var(--text-secondary)] ring-[var(--border-default)] hover:bg-[var(--bg-subtle)]",
              )}
            >
              {EVENT_TYPE_LABELS[value]}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
          시작일
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => updateUrl({ auditFrom: e.target.value || null, auditPage: null })}
            className="h-9 rounded-md border border-[var(--border-default)] bg-white px-2 text-sm text-[var(--text-secondary)] outline-none focus:border-[var(--brand-primary)]"
          />
        </label>
        <label className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
          종료일
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => updateUrl({ auditTo: e.target.value || null, auditPage: null })}
            className="h-9 rounded-md border border-[var(--border-default)] bg-white px-2 text-sm text-[var(--text-secondary)] outline-none focus:border-[var(--brand-primary)]"
          />
        </label>

        <select
          value={sort}
          onChange={(e) => updateUrl({ auditSort: e.target.value, auditPage: null })}
          className="h-9 rounded-md border border-[var(--border-default)] bg-white px-2 text-sm text-[var(--text-secondary)] outline-none focus:border-[var(--brand-primary)]"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={size}
          onChange={(e) => updateUrl({ auditSize: Number(e.target.value), auditPage: null })}
          className="h-9 rounded-md border border-[var(--border-default)] bg-white px-2 text-sm text-[var(--text-secondary)] outline-none focus:border-[var(--brand-primary)]"
        >
          {COMPANY_SECURITY_AUDIT_SIZES.map((option) => (
            <option key={option} value={option}>
              {option}개씩
            </option>
          ))}
        </select>

        {hasFilter && (
          <button
            type="button"
            onClick={resetFilters}
            className="h-9 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            필터 초기화
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          placeholder="처리자 또는 대상 사용자 검색"
          draft={userDraft}
          setDraft={setUserDraft}
          onApply={() => updateUrl({ auditUser: userDraft.trim() || null, auditPage: null })}
        />
        <SearchInput
          placeholder="Guard 또는 경로 검색"
          draft={guardDraft}
          setDraft={setGuardDraft}
          onApply={() => updateUrl({ auditGuard: guardDraft.trim() || null, auditPage: null })}
        />
      </div>

      {/* 콘텐츠 */}
      {state.kind === "loading" && (
        <div className="rounded-lg border border-[var(--border-default)] bg-white px-6 py-12 text-center text-sm text-[var(--text-secondary)]">
          보안 감사 로그를 불러오는 중입니다.
        </div>
      )}

      {state.kind === "error" && (
        <div className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] px-6 py-8 text-center">
          <p className="text-sm text-[var(--danger-text)]">{state.message}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 inline-flex h-9 items-center rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            다시 시도
          </button>
        </div>
      )}

      {state.kind === "ready" && state.events.length === 0 && (
        <EmptyState
          icon={ScrollText}
          title={hasFilter ? "조건에 맞는 보안 이벤트가 없습니다" : "기록된 보안 이벤트가 없습니다"}
          description={
            hasFilter
              ? "필터를 조정하거나 기간을 변경해 보세요."
              : "사용자 상태 변경 또는 접근 제한 이벤트가 발생하면 이곳에 표시됩니다."
          }
        />
      )}

      {state.kind === "ready" && state.events.length > 0 && (
        <>
          <div className="overflow-hidden rounded-lg border border-[var(--border-default)] bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] text-left text-xs font-medium text-[var(--text-tertiary)]">
                  <th className="px-4 py-3">발생 시각</th>
                  <th className="px-4 py-3">이벤트</th>
                  <th className="px-4 py-3">처리자</th>
                  <th className="px-4 py-3">대상 사용자</th>
                  <th className="px-4 py-3">발생 위치</th>
                </tr>
              </thead>
              <tbody>
                {state.events.map((event) => (
                  <tr key={event.id} className="border-b border-[var(--border-default)] last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--text-tertiary)]">
                      {formatDateTime(event.occurredAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ring-inset",
                          EVENT_BADGE_STYLES[event.eventType] ??
                            "bg-[var(--bg-muted)] text-[var(--text-secondary)] ring-[var(--border-default)]",
                        )}
                      >
                        {EVENT_TYPE_LABELS[event.eventType]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <UserCell user={event.actor} emptyLabel="시스템" onOpen={setSelectedUserId} />
                    </td>
                    <td className="px-4 py-3">
                      <UserCell user={event.target} emptyLabel="-" onOpen={setSelectedUserId} />
                    </td>
                    <td className="px-4 py-3">
                      {event.guardName ? (
                        <span className="font-mono text-xs text-[var(--text-tertiary)]">{event.guardName}</span>
                      ) : (
                        <span className="text-xs text-[var(--text-tertiary)]">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination pagination={state.pagination} onParamsChange={updateUrl} />
        </>
      )}

      {selectedUserId && (
        <CompanyUserDrawer
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onSaved={() => undefined}
          onStatusChanged={() => undefined}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | undefined;
  tone: "neutral" | "emerald" | "amber";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "amber"
        ? "text-amber-700"
        : "text-[var(--text-primary)]";
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-white px-4 py-3">
      <div className="text-xs text-[var(--text-tertiary)]">{label}</div>
      <div className={cn("mt-1 text-2xl font-semibold", toneClass)}>{value ?? "—"}</div>
    </div>
  );
}

function SearchInput({
  placeholder,
  draft,
  setDraft,
  onApply,
}: {
  placeholder: string;
  draft: string;
  setDraft: (value: string) => void;
  onApply: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onApply();
          }
        }}
        placeholder={placeholder}
        className="h-9 w-56 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-primary)]"
      />
      <button
        type="button"
        onClick={onApply}
        className="h-9 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
      >
        검색
      </button>
    </div>
  );
}

function UserCell({
  user,
  emptyLabel,
  onOpen,
}: {
  user: SecurityAuditUserRef | null;
  emptyLabel: string;
  onOpen: (userId: string) => void;
}) {
  if (!user) {
    return <span className="text-[var(--text-tertiary)]">{emptyLabel}</span>;
  }

  // 삭제된 사용자(name/email null): 클릭 불가.
  if (user.name === null && user.email === null) {
    return (
      <div>
        <div className="text-[var(--text-secondary)]">삭제된 사용자</div>
        <div className="font-mono text-xs text-[var(--text-tertiary)]">{user.userId.slice(0, 8)}</div>
      </div>
    );
  }

  // 존재하는 사용자: 클릭 시 상세 Drawer.
  return (
    <button
      type="button"
      onClick={() => onOpen(user.userId)}
      className="text-left hover:underline"
    >
      <div className="font-medium text-[var(--brand-primary)]">{user.name}</div>
      {user.email && <div className="text-xs text-[var(--text-tertiary)]">{user.email}</div>}
    </button>
  );
}

function Pagination({
  pagination,
  onParamsChange,
}: {
  pagination: InvitationPagination;
  onParamsChange: (patch: AuditParamPatch) => void;
}) {
  const { page, totalPages, total, hasPrevious, hasNext } = pagination;

  return (
    <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
      <span>총 {total}건</span>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!hasPrevious}
            onClick={() => onParamsChange({ auditPage: page - 1 })}
            className="inline-flex h-8 items-center rounded-md border border-[var(--border-default)] bg-white px-3 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            이전
          </button>
          <span className="text-xs text-[var(--text-tertiary)]">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={!hasNext}
            onClick={() => onParamsChange({ auditPage: page + 1 })}
            className="inline-flex h-8 items-center rounded-md border border-[var(--border-default)] bg-white px-3 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR");
}
