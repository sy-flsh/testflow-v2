"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldAlert, UserCheck, UserX } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DialogShell } from "@/components/common/dialog-shell";
import { EmptyState } from "@/components/common/empty-state";
import { useAdminReauth } from "@/features/admin/admin-reauth-context";
import {
  ADMIN_DELETED_SIZES,
  normalizeAdminDeletedPage,
  normalizeAdminDeletedQuery,
  normalizeAdminDeletedSize,
  normalizeAdminDeletedSort,
} from "@/lib/admin/admin-deleted-filters";
import type { AdminParamPatch } from "@/lib/admin/admin-deleted-filters";
import type { ActiveAccountDto, ForceDeleteBlockedReason } from "@/lib/admin/types";
import type { InvitationPagination } from "@/lib/company/types";
import { cn } from "@/lib/utils";

type ReadyData = { users: ActiveAccountDto[]; pagination: InvitationPagination };
type Status = "loading" | "forbidden" | "error" | "ready";

const PARAM_DEFAULTS: Record<string, string | number> = {
  adminActiveSort: "newest",
  adminActiveSize: 20,
  adminActivePage: 1,
};

const SORT_OPTIONS: Array<{ value: "newest" | "oldest"; label: string }> = [
  { value: "newest", label: "최근 가입순" },
  { value: "oldest", label: "오래된 가입순" },
];

const BLOCK_REASON_LABEL: Record<ForceDeleteBlockedReason, string> = {
  SELF: "본인 계정",
  LAST_MASTER_ADMIN: "마지막 활성 MasterAdmin",
  LAST_ACTIVE_CO: "마지막 회사 관리자",
};

const CONFIRMATION_PHRASE = "강제 정지합니다";

export function AdminActiveAccountsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const q = normalizeAdminDeletedQuery(searchParams.get("adminActiveQ"));
  const page = normalizeAdminDeletedPage(searchParams.get("adminActivePage"));
  const size = normalizeAdminDeletedSize(searchParams.get("adminActiveSize"));
  const sort = normalizeAdminDeletedSort(searchParams.get("adminActiveSort"));

  const [data, setData] = useState<ReadyData | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refetching, setRefetching] = useState(false);
  const [qDraft, setQDraft] = useState(q);
  const [target, setTarget] = useState<ActiveAccountDto | null>(null);
  const dataRef = useRef<ReadyData | null>(null);
  const { onReauthRequired } = useAdminReauth();

  useEffect(() => {
    setQDraft(q);
  }, [q]);

  const updateUrl = useCallback(
    (patch: AdminParamPatch, opts?: { replace?: boolean }) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        const isDefault =
          value === null || value === undefined || value === "" || PARAM_DEFAULTS[key] === value;
        if (isDefault) next.delete(key);
        else next.set(key, String(value));
      }
      const query = next.toString();
      if (!opts?.replace && query === searchParams.toString()) return;
      const href = query ? `${pathname}?${query}` : pathname;
      if (opts?.replace) router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    },
    [searchParams, pathname, router],
  );

  const load = useCallback(async () => {
    const initial = dataRef.current === null;
    if (initial) setStatus("loading");
    else setRefetching(true);
    setErrorMessage(null);

    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (sort !== "newest") sp.set("sort", sort);
    if (size !== 20) sp.set("size", String(size));
    if (page !== 1) sp.set("page", String(page));
    const query = sp.toString();

    try {
      const response = await fetch(`/api/admin/accounts/active${query ? `?${query}` : ""}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | { data?: ReadyData; error?: { message?: string; code?: string } }
        | null;

      if (response.status === 403) {
        if (payload?.error?.code === "ADMIN_REAUTH_REQUIRED") {
          dataRef.current = null;
          setData(null);
          onReauthRequired();
          return;
        }
        dataRef.current = null;
        setData(null);
        setStatus("forbidden");
        return;
      }
      if (!response.ok || !payload?.data) {
        setErrorMessage(payload?.error?.message ?? "활성 계정 목록을 불러오지 못했습니다.");
        if (dataRef.current === null) setStatus("error");
        return;
      }

      dataRef.current = payload.data;
      setData(payload.data);
      setStatus("ready");
      if (payload.data.pagination.page !== page) {
        updateUrl({ adminActivePage: payload.data.pagination.page }, { replace: true });
      }
    } catch {
      setErrorMessage("활성 계정 목록을 불러오지 못했습니다.");
      if (dataRef.current === null) setStatus("error");
    } finally {
      setRefetching(false);
    }
  }, [q, sort, size, page, updateUrl, onReauthRequired]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetFilters() {
    updateUrl({ adminActiveQ: null, adminActivePage: null, adminActiveSize: null, adminActiveSort: null });
  }

  const hasFilter = Boolean(q) || sort !== "newest" || size !== 20;

  if (status === "forbidden") {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="관리자 권한이 필요합니다"
        description="활성 계정 관리는 MasterAdmin만 사용할 수 있습니다."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <input
            value={qDraft}
            aria-label="이름 또는 이메일 검색"
            onChange={(e) => setQDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") updateUrl({ adminActiveQ: qDraft.trim() || null, adminActivePage: null });
            }}
            placeholder="이름 또는 이메일 검색"
            className="h-9 w-64 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-primary)]"
          />
          <button
            type="button"
            onClick={() => updateUrl({ adminActiveQ: qDraft.trim() || null, adminActivePage: null })}
            className="h-9 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            검색
          </button>
        </div>
        <select
          value={sort}
          aria-label="정렬"
          onChange={(e) => updateUrl({ adminActiveSort: e.target.value, adminActivePage: null })}
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
          onChange={(e) => updateUrl({ adminActiveSize: Number(e.target.value), adminActivePage: null })}
          className="h-9 rounded-md border border-[var(--border-default)] bg-white px-2 text-sm text-[var(--text-secondary)] outline-none focus:border-[var(--brand-primary)]"
        >
          {ADMIN_DELETED_SIZES.map((option) => (
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

      {status === "loading" && !data && (
        <div className="rounded-lg border border-[var(--border-default)] bg-white px-6 py-12 text-center text-sm text-[var(--text-secondary)]">
          활성 계정을 불러오는 중입니다.
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
          {errorMessage && (
            <p className="text-xs text-[var(--danger-text)]" role="alert">
              {errorMessage} (이전 결과를 표시 중)
            </p>
          )}
          {data.users.length === 0 ? (
            <EmptyState
              icon={UserCheck}
              title={hasFilter ? "조건에 맞는 활성 계정이 없습니다" : "활성 계정이 없습니다"}
              description={hasFilter ? "검색어를 조정해 보세요." : "현재 활성 상태의 계정이 없습니다."}
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
                      <th className="px-4 py-3">가입일</th>
                      <th className="px-4 py-3">사용자</th>
                      <th className="px-4 py-3">마지막 로그인</th>
                      <th className="px-4 py-3">유형</th>
                      <th className="px-4 py-3 text-right">작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.map((u) => (
                      <tr key={u.userId} className="border-b border-[var(--border-default)] last:border-0">
                        <td className="whitespace-nowrap px-4 py-3 text-[var(--text-tertiary)]">
                          {new Date(u.createdAt).toLocaleDateString("ko-KR")}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-[var(--text-primary)]">{u.name}</div>
                          <div className="text-xs text-[var(--text-tertiary)]">{u.email}</div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[var(--text-tertiary)]">
                          {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("ko-KR") : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {u.isMasterAdmin && (
                              <span className="inline-flex h-6 items-center rounded-full bg-sky-50 px-2.5 text-xs font-medium text-sky-700 ring-1 ring-inset ring-sky-200">
                                MasterAdmin
                              </span>
                            )}
                            {u.isLastActiveCompanyOwner && (
                              <span className="inline-flex h-6 items-center rounded-full bg-amber-50 px-2.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                                마지막 CO
                              </span>
                            )}
                            {!u.isMasterAdmin && !u.isLastActiveCompanyOwner && (
                              <span className="text-xs text-[var(--text-tertiary)]">일반</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {u.forceDeleteAllowed ? (
                            <button
                              type="button"
                              onClick={() => setTarget(u)}
                              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-200 px-3 text-xs font-medium text-red-700 hover:bg-red-50"
                            >
                              <UserX className="h-3.5 w-3.5" />
                              강제 정지
                            </button>
                          ) : (
                            <div className="flex flex-col items-end gap-0.5">
                              <button
                                type="button"
                                disabled
                                title={u.forceDeleteBlockedReason ? BLOCK_REASON_LABEL[u.forceDeleteBlockedReason] : undefined}
                                className="inline-flex h-8 cursor-not-allowed items-center gap-1.5 rounded-md border border-[var(--border-default)] px-3 text-xs font-medium text-[var(--text-tertiary)] opacity-60"
                              >
                                <UserX className="h-3.5 w-3.5" />
                                강제 정지
                              </button>
                              {u.forceDeleteBlockedReason && (
                                <span className="text-[10px] text-[var(--text-tertiary)]">
                                  {BLOCK_REASON_LABEL[u.forceDeleteBlockedReason]}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination pagination={data.pagination} refetching={refetching} onParamsChange={updateUrl} />
            </>
          )}
        </>
      )}

      {target && (
        <ForceDeleteModal
          target={target}
          onClose={() => setTarget(null)}
          onForced={() => {
            setTarget(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function ForceDeleteModal({
  target,
  onClose,
  onForced,
}: {
  target: ActiveAccountDto;
  onClose: () => void;
  onForced: () => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { onReauthRequired } = useAdminReauth();

  const canSubmit = confirmation.trim() === CONFIRMATION_PHRASE && !submitting;

  async function handleForce() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/accounts/${target.userId}/force-delete`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: confirmation.trim() }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { data?: { ok?: boolean }; error?: { message?: string; code?: string } }
        | null;
      if (!response.ok || !payload?.data?.ok) {
        if (payload?.error?.code === "ADMIN_REAUTH_REQUIRED") {
          setError(payload.error.message ?? "관리자 인증이 필요합니다.");
          onReauthRequired();
          return;
        }
        // 409 등은 UI hint 와 다를 수 있으므로 API 메시지를 우선 표시.
        setError(payload?.error?.message ?? "계정 강제 정지를 처리하지 못했습니다.");
        return;
      }
      onForced();
    } catch {
      setError("계정 강제 정지를 처리하지 못했습니다. 네트워크 상태를 확인해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogShell
      title="계정 강제 정지"
      description="이 작업은 되돌리기 어렵습니다. MasterAdmin만 계정을 복구할 수 있습니다."
      onClose={() => {
        if (!submitting) onClose();
      }}
      maxWidth="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-10 rounded-md border border-[var(--border-subtle)] px-4 text-sm font-medium hover:bg-[var(--surface-muted)] disabled:opacity-60"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleForce}
            disabled={!canSubmit}
            className="h-10 rounded-md bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-200"
          >
            {submitting ? "처리 중…" : "계정 강제 정지"}
          </button>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        <dl className="grid grid-cols-[64px_1fr] gap-y-1">
          <dt className="text-[var(--text-tertiary)]">이름</dt>
          <dd className="text-[var(--text-primary)]">{target.name}</dd>
          <dt className="text-[var(--text-tertiary)]">이메일</dt>
          <dd className="text-[var(--text-secondary)]">{target.email}</dd>
        </dl>
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-xs leading-5 text-red-700">
          강제 정지하면 해당 사용자는 즉시 모든 로그인 세션이 종료됩니다.
          <br />
          기존 회사 및 워크스페이스 권한 정보는 보존되며, MasterAdmin만 계정을 복구할 수 있습니다.
        </div>
        <label className="block">
          <span className="text-[var(--text-secondary)]">
            계속하려면 <strong>{CONFIRMATION_PHRASE}</strong>를 정확히 입력해 주세요.
          </span>
          <input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder={CONFIRMATION_PHRASE}
            aria-label="강제 정지 확인 문구"
            className="mt-2 h-10 w-full rounded-md border border-[var(--border-default)] px-3 text-sm outline-none placeholder:text-[var(--text-tertiary)] focus:border-red-500"
          />
        </label>
        {error && <p className="text-sm text-[var(--danger-text)]">{error}</p>}
      </div>
    </DialogShell>
  );
}

function Pagination({
  pagination,
  refetching,
  onParamsChange,
}: {
  pagination: InvitationPagination;
  refetching: boolean;
  onParamsChange: (patch: AdminParamPatch) => void;
}) {
  const { page, totalPages, total, hasPrevious, hasNext } = pagination;
  return (
    <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
      <span aria-live="polite">
        총 {total}건
        {refetching && <span className="ml-2 text-xs text-[var(--text-tertiary)]">갱신 중…</span>}
      </span>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!hasPrevious}
            onClick={() => onParamsChange({ adminActivePage: page - 1 })}
            className="inline-flex h-8 items-center rounded-md border border-[var(--border-default)] bg-white px-3 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            이전
          </button>
          <span className="text-xs text-[var(--text-tertiary)]">{page} / {totalPages}</span>
          <button
            type="button"
            disabled={!hasNext}
            onClick={() => onParamsChange({ adminActivePage: page + 1 })}
            className="inline-flex h-8 items-center rounded-md border border-[var(--border-default)] bg-white px-3 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
