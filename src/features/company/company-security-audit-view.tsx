"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Link2, ScrollText, ShieldAlert, X } from "lucide-react";
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
import {
  activePreset,
  buildActiveChips,
  exportButtonLabel,
  presetPatch,
  toggleEventTypePatch,
} from "@/lib/company/security-audit-url";
import type {
  AuditParamPatch,
  AuditPresetKey,
} from "@/lib/company/security-audit-url";
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

type ReadyData = {
  events: SecurityAuditEventDto[];
  pagination: InvitationPagination;
  summary: SecurityAuditSummary;
};

type Status = "loading" | "forbidden" | "error" | "ready";

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

const PRESETS: Array<[AuditPresetKey, string]> = [
  ["all", "전체"],
  ["today", "오늘"],
  ["7d", "최근 7일"],
  ["30d", "최근 30일"],
];

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
  const { eventType, from, to, user, guard, page, size, sort } = params;
  const preset = activePreset(from, to);

  const [data, setData] = useState<ReadyData | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refetching, setRefetching] = useState(false);
  const [userDraft, setUserDraft] = useState(params.user);
  const [guardDraft, setGuardDraft] = useState(params.guard);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  // load() 가 매 data 변경마다 재생성되지 않도록 초기/재조회 구분은 ref 로 읽는다.
  const dataRef = useRef<ReadyData | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setUserDraft(user);
  }, [user]);
  useEffect(() => {
    setGuardDraft(guard);
  }, [guard]);
  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

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
      // 같은 URL 로의 불필요한 push 방지(server clamp 의 replace 는 제외).
      if (!opts?.replace && query === searchParams.toString()) {
        return;
      }
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
    const initial = dataRef.current === null;
    if (initial) {
      setStatus("loading");
    } else {
      setRefetching(true);
    }
    setErrorMessage(null);
    const query = buildQuery(true);

    try {
      const response = await fetch(
        `/api/company/security-audit${query ? `?${query}` : ""}`,
        { cache: "no-store" },
      );
      const payload = (await response.json().catch(() => null)) as
        | { data?: ReadyData; error?: { message?: string } }
        | null;

      if (response.status === 403) {
        dataRef.current = null;
        setData(null);
        setStatus("forbidden");
        return;
      }
      if (!response.ok || !payload?.data) {
        const message = payload?.error?.message ?? "보안 감사 로그를 불러오지 못했습니다.";
        setErrorMessage(message);
        if (dataRef.current === null) setStatus("error");
        return;
      }

      dataRef.current = payload.data;
      setData(payload.data);
      setStatus("ready");

      if (payload.data.pagination.page !== page) {
        updateUrl({ auditPage: payload.data.pagination.page }, { replace: true });
      }
    } catch {
      setErrorMessage("보안 감사 로그를 불러오지 못했습니다.");
      if (dataRef.current === null) setStatus("error");
    } finally {
      setRefetching(false);
    }
  }, [buildQuery, page, updateUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  function handleCardToggle(cardType: SecurityAuditEventTypeFilter) {
    const patch = toggleEventTypePatch(eventType, cardType);
    if (patch) updateUrl(patch);
  }

  function removeChip(chip: { key: string; removePatch: AuditParamPatch }) {
    if (chip.key === "user") setUserDraft("");
    if (chip.key === "guard") setGuardDraft("");
    updateUrl(chip.removePatch);
  }

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

  async function handleCopyLink() {
    const link = typeof window !== "undefined" ? window.location.href : "";
    if (copyTimer.current) clearTimeout(copyTimer.current);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else if (!legacyCopy(link)) {
        throw new Error("execCommand copy failed");
      }
      setCopyState("copied");
      copyTimer.current = setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      // Clipboard API 실패 시 legacy textarea fallback 을 한 번 더 시도.
      if (legacyCopy(link)) {
        setCopyState("copied");
        copyTimer.current = setTimeout(() => setCopyState("idle"), 2000);
      } else {
        setCopyState("error");
      }
    }
  }

  const summary = data?.summary ?? null;
  const total = data?.pagination.total ?? null;
  const chips = buildActiveChips(
    { eventType, from, to, user, guard, sort, size },
    SECURITY_AUDIT_EVENT_LABELS,
  );
  const hasFilter = chips.length > 0;

  if (status === "forbidden") {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="CO 권한이 필요합니다"
        description="보안 감사 로그는 Company 소유자(CO)만 확인할 수 있습니다."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* 통계 카드 (현재 date/user/guard 기준, eventType 무관). 클릭 시 목록 유형 필터 toggle. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          label="전체 이벤트"
          value={summary?.total}
          tone="neutral"
          active={eventType === "ALL"}
          onToggle={() => handleCardToggle("ALL")}
        />
        <SummaryCard
          label="사용자 비활성화"
          value={summary?.byEventType.COMPANY_USER_DEACTIVATED}
          tone="neutral"
          active={eventType === "COMPANY_USER_DEACTIVATED"}
          onToggle={() => handleCardToggle("COMPANY_USER_DEACTIVATED")}
        />
        <SummaryCard
          label="사용자 활성화"
          value={summary?.byEventType.COMPANY_USER_REACTIVATED}
          tone="emerald"
          active={eventType === "COMPANY_USER_REACTIVATED"}
          onToggle={() => handleCardToggle("COMPANY_USER_REACTIVATED")}
        />
        <SummaryCard
          label="비활성 사용자 접근 차단"
          value={summary?.byEventType.INACTIVE_COMPANY_ACCESS_DENIED}
          tone="amber"
          active={eventType === "INACTIVE_COMPANY_ACCESS_DENIED"}
          onToggle={() => handleCardToggle("INACTIVE_COMPANY_ACCESS_DENIED")}
        />
      </div>
      <p className="text-xs text-[var(--text-tertiary)]">
        통계 카드를 클릭하면 해당 이벤트만 목록에 표시됩니다. 통계는 현재 기간·사용자·Guard 조건 기준이며, 이벤트 유형 선택과 무관하게 전체 유형을 비교합니다. 기간은 UTC 기준으로 조회됩니다.
      </p>

      {/* 기간 프리셋 + 내보내기/링크 복사 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {PRESETS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={preset === key}
              onClick={() => updateUrl(presetPatch(key))}
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
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              aria-label="현재 보안 감사 로그 필터 링크 복사"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
            >
              <Link2 className="h-4 w-4" />
              {copyState === "copied" ? "복사됨" : "링크 복사"}
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              title={`현재 필터 결과 ${total ?? 0}건을 CSV로 내보내기`}
              aria-label={`현재 필터 결과 ${total ?? 0}건을 CSV로 내보내기`}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {exportButtonLabel(total, exporting)}
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {copyState === "error" && (
              <span className="text-[var(--danger-text)]">링크를 복사하지 못했습니다.</span>
            )}
            {exportError ? (
              <span className="text-[var(--danger-text)]">{exportError}</span>
            ) : (
              <span className="text-[var(--text-tertiary)]">현재 필터 기준 전체 결과를 내보냅니다.</span>
            )}
          </div>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-wrap gap-1">
          {COMPANY_SECURITY_AUDIT_EVENT_TYPES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={eventType === value}
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
          aria-label="정렬"
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
          aria-label="페이지당 항목 수"
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
          ariaLabel="처리자 또는 대상 사용자 검색"
          draft={userDraft}
          setDraft={setUserDraft}
          onApply={() => updateUrl({ auditUser: userDraft.trim() || null, auditPage: null })}
        />
        <SearchInput
          placeholder="Guard 또는 경로 검색"
          ariaLabel="Guard 또는 경로 검색"
          draft={guardDraft}
          setDraft={setGuardDraft}
          onApply={() => updateUrl({ auditGuard: guardDraft.trim() || null, auditPage: null })}
        />
      </div>

      {/* 활성 필터 칩 */}
      {hasFilter && (
        <div className="flex flex-wrap items-center gap-2" role="region" aria-label="적용된 필터">
          <span className="text-xs font-medium text-[var(--text-tertiary)]">현재 필터 적용 중</span>
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex h-7 items-center gap-1 rounded-full bg-[var(--bg-muted)] py-0.5 pl-2.5 pr-1 text-xs font-medium text-[var(--text-secondary)] ring-1 ring-inset ring-[var(--border-default)]"
            >
              {chip.label}
              <button
                type="button"
                onClick={() => removeChip(chip)}
                aria-label={`${chip.label} 필터 제거`}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[var(--text-tertiary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-secondary)]"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* 콘텐츠 */}
      {status === "loading" && !data && (
        <div className="rounded-lg border border-[var(--border-default)] bg-white px-6 py-12 text-center text-sm text-[var(--text-secondary)]">
          보안 감사 로그를 불러오는 중입니다.
        </div>
      )}

      {status === "error" && !data && (
        <div className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] px-6 py-8 text-center">
          <p className="text-sm text-[var(--danger-text)]">{errorMessage}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 inline-flex h-9 items-center rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            다시 시도
          </button>
        </div>
      )}

      {data && (
        <>
          {/* 재조회 실패 시: 기존 목록 유지 + 보조 경고. */}
          {errorMessage && (
            <p className="text-xs text-[var(--danger-text)]" role="alert">
              {errorMessage} (이전 결과를 표시 중)
            </p>
          )}

          {data.events.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title={hasFilter ? "조건에 맞는 보안 이벤트가 없습니다" : "기록된 보안 이벤트가 없습니다"}
              description={
                hasFilter
                  ? "필터 칩의 X 또는 [필터 초기화]로 조건을 완화해 보세요."
                  : "사용자 상태 변경 또는 접근 제한 이벤트가 발생하면 이곳에 표시됩니다."
              }
            />
          ) : (
            <>
              <div
                className={cn(
                  "overflow-hidden rounded-lg border border-[var(--border-default)] bg-white transition-opacity",
                  refetching && "opacity-60",
                )}
                aria-busy={refetching}
              >
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
                    {data.events.map((event) => (
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

              <Pagination
                pagination={data.pagination}
                eventTypeLabel={eventType !== "ALL" ? EVENT_TYPE_LABELS[eventType] : null}
                refetching={refetching}
                onParamsChange={updateUrl}
              />
            </>
          )}
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

/** legacy clipboard fallback: temporary textarea + execCommand. 성공 여부 boolean. */
function legacyCopy(text: string): boolean {
  if (typeof document === "undefined") return false;
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}

function SummaryCard({
  label,
  value,
  tone,
  active,
  onToggle,
}: {
  label: string;
  value: number | undefined;
  tone: "neutral" | "emerald" | "amber";
  active: boolean;
  onToggle: () => void;
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "amber"
        ? "text-amber-700"
        : "text-[var(--text-primary)]";
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={cn(
        "rounded-lg border bg-white px-4 py-3 text-left transition-colors hover:border-[var(--brand-primary)]",
        active
          ? "border-[var(--brand-primary)] ring-1 ring-[var(--brand-primary)]"
          : "border-[var(--border-default)]",
      )}
    >
      <div className="text-xs text-[var(--text-tertiary)]">{label}</div>
      <div className={cn("mt-1 text-2xl font-semibold", toneClass)}>{value ?? "—"}</div>
    </button>
  );
}

function SearchInput({
  placeholder,
  ariaLabel,
  draft,
  setDraft,
  onApply,
}: {
  placeholder: string;
  ariaLabel: string;
  draft: string;
  setDraft: (value: string) => void;
  onApply: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        value={draft}
        aria-label={ariaLabel}
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
  eventTypeLabel,
  refetching,
  onParamsChange,
}: {
  pagination: InvitationPagination;
  eventTypeLabel: string | null;
  refetching: boolean;
  onParamsChange: (patch: AuditParamPatch) => void;
}) {
  const { page, totalPages, total, hasPrevious, hasNext } = pagination;

  return (
    <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
      <span aria-live="polite">
        {eventTypeLabel ? `‘${eventTypeLabel}’ ` : ""}총 {total}건
        {refetching && <span className="ml-2 text-xs text-[var(--text-tertiary)]">갱신 중…</span>}
      </span>
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
