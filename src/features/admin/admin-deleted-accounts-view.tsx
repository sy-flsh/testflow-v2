"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArchiveRestore, ShieldAlert, UserX } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DialogShell } from "@/components/common/dialog-shell";
import { EmptyState } from "@/components/common/empty-state";
import { useAdminReauth } from "@/features/admin/admin-reauth-context";
import {
  normalizeAdminDeletedPage,
  normalizeAdminDeletedQuery,
  normalizeAdminDeletedSize,
  normalizeAdminDeletedSort,
  ADMIN_DELETED_SIZES,
} from "@/lib/admin/admin-deleted-filters";
import type { AdminParamPatch } from "@/lib/admin/admin-deleted-filters";
import type { DeletedAccountDto } from "@/lib/admin/types";
import type { InvitationPagination } from "@/lib/company/types";
import { cn } from "@/lib/utils";

type ReadyData = { users: DeletedAccountDto[]; pagination: InvitationPagination };
type Status = "loading" | "forbidden" | "error" | "ready";

const PARAM_DEFAULTS: Record<string, string | number> = {
  adminDeletedSort: "newest",
  adminDeletedSize: 20,
  adminDeletedPage: 1,
};

const SORT_OPTIONS: Array<{ value: "newest" | "oldest"; label: string }> = [
  { value: "newest", label: "최근 탈퇴순" },
  { value: "oldest", label: "오래된 탈퇴순" },
];

function reasonLabel(reason: string | null): string {
  if (reason === "SELF_WITHDRAWAL") return "본인 탈퇴";
  return reason ? "기타" : "-";
}

export function AdminDeletedAccountsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const params = {
    q: normalizeAdminDeletedQuery(searchParams.get("adminDeletedQ")),
    page: normalizeAdminDeletedPage(searchParams.get("adminDeletedPage")),
    size: normalizeAdminDeletedSize(searchParams.get("adminDeletedSize")),
    sort: normalizeAdminDeletedSort(searchParams.get("adminDeletedSort")),
  };
  const { q, page, size, sort } = params;

  const [data, setData] = useState<ReadyData | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refetching, setRefetching] = useState(false);
  const [qDraft, setQDraft] = useState(params.q);
  const [restoreTarget, setRestoreTarget] = useState<DeletedAccountDto | null>(null);
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
        if (isDefault) {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }
      const query = next.toString();
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

  const load = useCallback(async () => {
    const initial = dataRef.current === null;
    if (initial) {
      setStatus("loading");
    } else {
      setRefetching(true);
    }
    setErrorMessage(null);

    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (sort !== "newest") sp.set("sort", sort);
    if (size !== 20) sp.set("size", String(size));
    if (page !== 1) sp.set("page", String(page));
    const query = sp.toString();

    try {
      const response = await fetch(`/api/admin/accounts/deleted${query ? `?${query}` : ""}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | { data?: ReadyData; error?: { message?: string; code?: string } }
        | null;

      if (response.status === 403) {
        // c10-5: elevation 만료/없음 → 목록 즉시 숨기고 gate 로 전환(stale 미노출).
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
        const message = payload?.error?.message ?? "탈퇴 계정 목록을 불러오지 못했습니다.";
        setErrorMessage(message);
        if (dataRef.current === null) setStatus("error");
        return;
      }

      dataRef.current = payload.data;
      setData(payload.data);
      setStatus("ready");

      if (payload.data.pagination.page !== page) {
        updateUrl({ adminDeletedPage: payload.data.pagination.page }, { replace: true });
      }
    } catch {
      setErrorMessage("탈퇴 계정 목록을 불러오지 못했습니다.");
      if (dataRef.current === null) setStatus("error");
    } finally {
      setRefetching(false);
    }
  }, [q, sort, size, page, updateUrl, onReauthRequired]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetFilters() {
    updateUrl({
      adminDeletedQ: null,
      adminDeletedPage: null,
      adminDeletedSize: null,
      adminDeletedSort: null,
    });
  }

  const hasFilter = Boolean(q) || sort !== "newest" || size !== 20;

  if (status === "forbidden") {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="관리자 권한이 필요합니다"
        description="탈퇴 계정 관리는 MasterAdmin만 사용할 수 있습니다."
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
              if (e.key === "Enter") updateUrl({ adminDeletedQ: qDraft.trim() || null, adminDeletedPage: null });
            }}
            placeholder="이름 또는 이메일 검색"
            className="h-9 w-64 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-primary)]"
          />
          <button
            type="button"
            onClick={() => updateUrl({ adminDeletedQ: qDraft.trim() || null, adminDeletedPage: null })}
            className="h-9 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            검색
          </button>
        </div>

        <select
          value={sort}
          aria-label="정렬"
          onChange={(e) => updateUrl({ adminDeletedSort: e.target.value, adminDeletedPage: null })}
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
          onChange={(e) => updateUrl({ adminDeletedSize: Number(e.target.value), adminDeletedPage: null })}
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
          탈퇴 계정을 불러오는 중입니다.
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
              icon={UserX}
              title={hasFilter ? "조건에 맞는 탈퇴 계정이 없습니다" : "탈퇴 처리된 계정이 없습니다"}
              description={hasFilter ? "검색어를 조정해 보세요." : "현재 복구할 수 있는 탈퇴 계정이 없습니다."}
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
                      <th className="px-4 py-3">탈퇴 시각</th>
                      <th className="px-4 py-3">사용자</th>
                      <th className="px-4 py-3">탈퇴 사유</th>
                      <th className="px-4 py-3">실행자 ID</th>
                      <th className="px-4 py-3 text-right">작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.map((user) => (
                      <tr key={user.userId} className="border-b border-[var(--border-default)] last:border-0">
                        <td className="whitespace-nowrap px-4 py-3 text-[var(--text-tertiary)]">
                          {new Date(user.deletedAt).toLocaleString("ko-KR")}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-[var(--text-primary)]">{user.name}</div>
                          <div className="text-xs text-[var(--text-tertiary)]">{user.email}</div>
                        </td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{reasonLabel(user.deletionReason)}</td>
                        <td className="px-4 py-3">
                          {user.deletedByUserId ? (
                            <span className="font-mono text-xs text-[var(--text-tertiary)]">
                              {user.deletedByUserId.slice(0, 8)}
                            </span>
                          ) : (
                            <span className="text-xs text-[var(--text-tertiary)]">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setRestoreTarget(user)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border-default)] px-3 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                          >
                            <ArchiveRestore className="h-3.5 w-3.5" />
                            복구
                          </button>
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

      {restoreTarget && (
        <RestoreModal
          target={restoreTarget}
          onClose={() => setRestoreTarget(null)}
          onRestored={() => {
            setRestoreTarget(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function RestoreModal({
  target,
  onClose,
  onRestored,
}: {
  target: DeletedAccountDto;
  onClose: () => void;
  onRestored: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { onReauthRequired } = useAdminReauth();

  async function handleRestore() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/accounts/${target.userId}/restore`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = (await response.json().catch(() => null)) as
        | { data?: { ok?: boolean }; error?: { message?: string; code?: string } }
        | null;
      if (!response.ok || !payload?.data?.ok) {
        // c10-5: 진행 중 elevation 만료 → 복구 미실행, 메시지 표시 후 gate 로 전환.
        if (payload?.error?.code === "ADMIN_REAUTH_REQUIRED") {
          setError(payload.error.message ?? "관리자 인증이 필요합니다.");
          onReauthRequired();
          return;
        }
        setError(payload?.error?.message ?? "계정 복구를 처리하지 못했습니다.");
        return;
      }
      onRestored();
    } catch {
      setError("계정 복구를 처리하지 못했습니다. 네트워크 상태를 확인해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogShell
      title="계정 복구"
      description="복구하면 해당 사용자는 다시 로그인할 수 있습니다."
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
            onClick={handleRestore}
            disabled={submitting}
            className="h-10 rounded-md bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "복구 중…" : "계정 복구"}
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
        <ul className="list-disc space-y-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-5 py-3 text-xs leading-5 text-[var(--text-secondary)]">
          <li>기존 회사 및 워크스페이스 권한은 그대로 유지됩니다.</li>
          <li>기존 로그인 세션은 복구되지 않으며, 사용자는 다시 로그인해야 합니다.</li>
          <li>회사에서 비활성화(INACTIVE) 상태였다면 해당 회사 접근 제한은 그대로 유지됩니다.</li>
        </ul>
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
            onClick={() => onParamsChange({ adminDeletedPage: page - 1 })}
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
            onClick={() => onParamsChange({ adminDeletedPage: page + 1 })}
            className="inline-flex h-8 items-center rounded-md border border-[var(--border-default)] bg-white px-3 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
