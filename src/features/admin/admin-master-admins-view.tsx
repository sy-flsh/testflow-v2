"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldAlert, ShieldCheck, ShieldX, UserPlus } from "lucide-react";
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
import type {
  MasterAdminCandidateDto,
  MasterAdminDto,
  RevokeBlockedReasonDto,
} from "@/lib/admin/types";
import type { InvitationPagination } from "@/lib/company/types";
import { cn } from "@/lib/utils";

type ReadyData = { masterAdmins: MasterAdminDto[]; pagination: InvitationPagination; legacyUnboundCount: number };
type Status = "loading" | "forbidden" | "error" | "ready";

const PARAM_DEFAULTS: Record<string, string | number> = {
  adminMasterStatus: "ACTIVE",
  adminMasterSort: "newest",
  adminMasterSize: 20,
  adminMasterPage: 1,
};

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "활성" },
  { value: "INACTIVE", label: "비활성" },
  { value: "ALL", label: "전체" },
];
const SORT_OPTIONS = [
  { value: "newest", label: "최근 등록순" },
  { value: "oldest", label: "오래된 등록순" },
];
const STATUS_LABEL: Record<string, string> = { ACTIVE: "활성", INACTIVE: "비활성", ACCOUNT_DELETED: "계정 탈퇴" };
const REVOKE_REASON_LABEL: Record<RevokeBlockedReasonDto, string> = {
  SELF: "자기 권한은 직접 해제할 수 없습니다.",
  LAST_ACTIVE_MASTER: "마지막 활성 MasterAdmin 권한은 해제할 수 없습니다.",
  NOT_ACTIVE: "비활성 권한입니다.",
  ACCOUNT_DELETED: "탈퇴한 계정입니다.",
};
const GRANT_PHRASE = "MasterAdmin 권한을 부여합니다";
const REVOKE_PHRASE = "MasterAdmin 권한을 해제합니다";

function normalizeStatus(value: string | null): "ACTIVE" | "INACTIVE" | "ALL" {
  return value === "INACTIVE" || value === "ALL" ? value : "ACTIVE";
}

export function AdminMasterAdminsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const q = normalizeAdminDeletedQuery(searchParams.get("adminMasterQ"));
  const status = normalizeStatus(searchParams.get("adminMasterStatus"));
  const page = normalizeAdminDeletedPage(searchParams.get("adminMasterPage"));
  const size = normalizeAdminDeletedSize(searchParams.get("adminMasterSize"));
  const sort = normalizeAdminDeletedSort(searchParams.get("adminMasterSort"));

  const [data, setData] = useState<ReadyData | null>(null);
  const [state, setState] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refetching, setRefetching] = useState(false);
  const [qDraft, setQDraft] = useState(q);
  const [revokeTarget, setRevokeTarget] = useState<MasterAdminDto | null>(null);
  const [grantOpen, setGrantOpen] = useState(false);
  const dataRef = useRef<ReadyData | null>(null);
  const { onReauthRequired } = useAdminReauth();

  useEffect(() => setQDraft(q), [q]);

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
    if (initial) setState("loading");
    else setRefetching(true);
    setErrorMessage(null);

    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (status !== "ACTIVE") sp.set("status", status);
    if (sort !== "newest") sp.set("sort", sort);
    if (size !== 20) sp.set("size", String(size));
    if (page !== 1) sp.set("page", String(page));
    const query = sp.toString();

    try {
      const response = await fetch(`/api/admin/master-admins${query ? `?${query}` : ""}`, { cache: "no-store" });
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
        setState("forbidden");
        return;
      }
      if (!response.ok || !payload?.data) {
        setErrorMessage(payload?.error?.message ?? "MasterAdmin 목록을 불러오지 못했습니다.");
        if (dataRef.current === null) setState("error");
        return;
      }
      dataRef.current = payload.data;
      setData(payload.data);
      setState("ready");
      if (payload.data.pagination.page !== page) {
        updateUrl({ adminMasterPage: payload.data.pagination.page }, { replace: true });
      }
    } catch {
      setErrorMessage("MasterAdmin 목록을 불러오지 못했습니다.");
      if (dataRef.current === null) setState("error");
    } finally {
      setRefetching(false);
    }
  }, [q, status, sort, size, page, updateUrl, onReauthRequired]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetFilters() {
    updateUrl({ adminMasterQ: null, adminMasterStatus: null, adminMasterPage: null, adminMasterSize: null, adminMasterSort: null });
  }
  const hasFilter = Boolean(q) || status !== "ACTIVE" || sort !== "newest" || size !== 20;

  if (state === "forbidden") {
    return (
      <EmptyState icon={ShieldAlert} title="관리자 권한이 필요합니다" description="MasterAdmin 관리는 MasterAdmin만 사용할 수 있습니다." />
    );
  }

  return (
    <div className="space-y-4">
      {data && data.legacyUnboundCount > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          사용자 연결이 확인되지 않은 기존 MasterAdmin 레코드가 {data.legacyUnboundCount}건 있습니다. 이 레코드는 권한으로 인정되지 않으며 별도 확인이 필요합니다.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={qDraft}
            aria-label="이름 또는 이메일 검색"
            onChange={(e) => setQDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") updateUrl({ adminMasterQ: qDraft.trim() || null, adminMasterPage: null });
            }}
            placeholder="이름 또는 이메일 검색"
            className="h-9 w-60 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-primary)]"
          />
          <button type="button" onClick={() => updateUrl({ adminMasterQ: qDraft.trim() || null, adminMasterPage: null })} className="h-9 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]">검색</button>
          <select value={status} aria-label="상태" onChange={(e) => updateUrl({ adminMasterStatus: e.target.value, adminMasterPage: null })} className="h-9 rounded-md border border-[var(--border-default)] bg-white px-2 text-sm text-[var(--text-secondary)] outline-none focus:border-[var(--brand-primary)]">
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={sort} aria-label="정렬" onChange={(e) => updateUrl({ adminMasterSort: e.target.value, adminMasterPage: null })} className="h-9 rounded-md border border-[var(--border-default)] bg-white px-2 text-sm text-[var(--text-secondary)] outline-none focus:border-[var(--brand-primary)]">
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={size} aria-label="페이지당 항목 수" onChange={(e) => updateUrl({ adminMasterSize: Number(e.target.value), adminMasterPage: null })} className="h-9 rounded-md border border-[var(--border-default)] bg-white px-2 text-sm text-[var(--text-secondary)] outline-none focus:border-[var(--brand-primary)]">
            {ADMIN_DELETED_SIZES.map((o) => <option key={o} value={o}>{o}개씩</option>)}
          </select>
          {hasFilter && <button type="button" onClick={resetFilters} className="h-9 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]">필터 초기화</button>}
        </div>
        <button type="button" onClick={() => setGrantOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--brand-primary)] px-3 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)]">
          <UserPlus className="h-4 w-4" />
          MasterAdmin 권한 부여
        </button>
      </div>

      {state === "loading" && !data && (
        <div className="rounded-lg border border-[var(--border-default)] bg-white px-6 py-12 text-center text-sm text-[var(--text-secondary)]">MasterAdmin 목록을 불러오는 중입니다.</div>
      )}
      {state === "error" && !data && (
        <div className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] px-6 py-8 text-center">
          <p className="text-sm text-[var(--danger-text)]">{errorMessage}</p>
          <button type="button" onClick={() => void load()} className="mt-3 inline-flex h-9 items-center rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]">다시 시도</button>
        </div>
      )}

      {data && (
        <>
          {errorMessage && <p className="text-xs text-[var(--danger-text)]" role="alert">{errorMessage} (이전 결과를 표시 중)</p>}
          {data.masterAdmins.length === 0 ? (
            <EmptyState icon={ShieldCheck} title={hasFilter ? "조건에 맞는 MasterAdmin이 없습니다" : "MasterAdmin이 없습니다"} description={hasFilter ? "검색어/상태를 조정해 보세요." : "권한 부여로 MasterAdmin을 지정할 수 있습니다."} />
          ) : (
            <>
              <div className={cn("overflow-hidden rounded-lg border border-[var(--border-default)] bg-white transition-opacity", refetching && "opacity-60")} aria-busy={refetching}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] text-left text-xs font-medium text-[var(--text-tertiary)]">
                      <th className="px-4 py-3">사용자</th>
                      <th className="px-4 py-3">상태</th>
                      <th className="px-4 py-3">등록 시각</th>
                      <th className="px-4 py-3">최근 변경 시각</th>
                      <th className="px-4 py-3 text-right">작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.masterAdmins.map((m) => (
                      <tr key={m.masterAdminId} className="border-b border-[var(--border-default)] last:border-0">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="font-medium text-[var(--text-primary)]">{m.name}</div>
                              <div className="text-xs text-[var(--text-tertiary)]">{m.email}</div>
                            </div>
                            {m.isCurrentActor && <span className="inline-flex h-5 items-center rounded-full bg-[var(--bg-muted)] px-2 text-[10px] font-medium text-[var(--text-secondary)] ring-1 ring-inset ring-[var(--border-default)]">현재 사용자</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ring-inset",
                            m.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                              : m.status === "ACCOUNT_DELETED" ? "bg-red-50 text-red-700 ring-red-200"
                                : "bg-[var(--bg-muted)] text-[var(--text-tertiary)] ring-[var(--border-default)]")}>
                            {STATUS_LABEL[m.status]}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[var(--text-tertiary)]">{new Date(m.createdAt).toLocaleString("ko-KR")}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-[var(--text-tertiary)]">{new Date(m.updatedAt).toLocaleString("ko-KR")}</td>
                        <td className="px-4 py-3 text-right">
                          {m.revokeAllowed ? (
                            <button type="button" onClick={() => setRevokeTarget(m)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-200 px-3 text-xs font-medium text-red-700 hover:bg-red-50">
                              <ShieldX className="h-3.5 w-3.5" /> 권한 해제
                            </button>
                          ) : (
                            <div className="flex flex-col items-end gap-0.5">
                              <button type="button" disabled className="inline-flex h-8 cursor-not-allowed items-center gap-1.5 rounded-md border border-[var(--border-default)] px-3 text-xs font-medium text-[var(--text-tertiary)] opacity-60">
                                <ShieldX className="h-3.5 w-3.5" /> 권한 해제
                              </button>
                              {m.revokeBlockedReason && <span className="text-[10px] text-[var(--text-tertiary)]">{REVOKE_REASON_LABEL[m.revokeBlockedReason]}</span>}
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

      {grantOpen && <GrantModal onClose={() => setGrantOpen(false)} onGranted={() => { setGrantOpen(false); void load(); }} />}
      {revokeTarget && <RevokeModal target={revokeTarget} onClose={() => setRevokeTarget(null)} onRevoked={() => { setRevokeTarget(null); void load(); }} />}
    </div>
  );
}

const ELIGIBILITY_LABEL: Record<string, string> = {
  ELIGIBLE: "위임 가능",
  ALREADY_ACTIVE_MASTER: "이미 활성 MasterAdmin입니다",
  INACTIVE_MASTER_CAN_REACTIVATE: "기존 비활성 MasterAdmin 권한 재활성화",
  LEGACY_BINDING_REQUIRED: "기존 사용자 연결 확인이 필요합니다",
};

function GrantModal({ onClose, onGranted }: { onClose: () => void; onGranted: () => void }) {
  const { onReauthRequired } = useAdminReauth();
  const [searchDraft, setSearchDraft] = useState("");
  const [candidates, setCandidates] = useState<MasterAdminCandidateDto[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<MasterAdminCandidateDto | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    const q = searchDraft.trim();
    if (q.length < 2) {
      setCandidates([]);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/master-admins/candidates?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const payload = (await res.json().catch(() => null)) as { data?: { candidates?: MasterAdminCandidateDto[] }; error?: { code?: string; message?: string } } | null;
      if (res.status === 403 && payload?.error?.code === "ADMIN_REAUTH_REQUIRED") {
        onReauthRequired();
        return;
      }
      setCandidates(payload?.data?.candidates ?? []);
    } catch {
      setError("후보를 불러오지 못했습니다.");
    } finally {
      setSearching(false);
    }
  }

  async function handleGrant() {
    if (!selected || confirmation.trim() !== GRANT_PHRASE || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/master-admins/${selected.userId}/grant`, {
        method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: confirmation.trim() }),
      });
      const payload = (await res.json().catch(() => null)) as { data?: { ok?: boolean }; error?: { message?: string; code?: string } } | null;
      if (!res.ok || !payload?.data?.ok) {
        if (payload?.error?.code === "ADMIN_REAUTH_REQUIRED") { setError(payload.error.message ?? "관리자 인증이 필요합니다."); onReauthRequired(); return; }
        setError(payload?.error?.message ?? "권한 부여를 처리하지 못했습니다.");
        return;
      }
      onGranted();
    } catch {
      setError("권한 부여를 처리하지 못했습니다. 네트워크 상태를 확인해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  const selectable = (c: MasterAdminCandidateDto) => c.eligibility === "ELIGIBLE" || c.eligibility === "INACTIVE_MASTER_CAN_REACTIVATE";

  return (
    <DialogShell
      title="MasterAdmin 권한 부여"
      description="대상 사용자를 검색해 전역 운영 권한을 위임합니다. 대상은 별도 로그인·재인증 후 관리자 기능을 사용할 수 있습니다."
      onClose={() => { if (!submitting) onClose(); }}
      maxWidth="max-w-lg"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={submitting} className="h-10 rounded-md border border-[var(--border-subtle)] px-4 text-sm font-medium hover:bg-[var(--surface-muted)] disabled:opacity-60">취소</button>
          <button type="button" onClick={handleGrant} disabled={!selected || confirmation.trim() !== GRANT_PHRASE || submitting} className="h-10 rounded-md bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? "처리 중…" : "권한 부여"}
          </button>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2">
          <input value={searchDraft} aria-label="대상 사용자 검색" onChange={(e) => setSearchDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void search(); }} placeholder="이름 또는 이메일 (2글자 이상)" className="h-9 flex-1 rounded-md border border-[var(--border-default)] px-3 text-sm outline-none focus:border-[var(--brand-primary)]" />
          <button type="button" onClick={() => void search()} className="h-9 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]">검색</button>
        </div>

        {candidates !== null && (
          <div className="max-h-56 overflow-y-auto rounded-md border border-[var(--border-default)]">
            {searching ? (
              <p className="px-3 py-4 text-center text-xs text-[var(--text-tertiary)]">검색 중…</p>
            ) : candidates.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-[var(--text-tertiary)]">검색 결과가 없습니다.</p>
            ) : (
              candidates.map((c) => (
                <button
                  key={c.userId}
                  type="button"
                  disabled={!selectable(c)}
                  onClick={() => setSelected(c)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-3 py-2 text-left last:border-0",
                    selectable(c) ? "hover:bg-[var(--bg-subtle)]" : "cursor-not-allowed opacity-60",
                    selected?.userId === c.userId && "bg-[var(--bg-muted)]",
                  )}
                >
                  <span>
                    <span className="font-medium text-[var(--text-primary)]">{c.name}</span>
                    <span className="ml-2 text-xs text-[var(--text-tertiary)]">{c.email}</span>
                  </span>
                  <span className="text-[10px] text-[var(--text-tertiary)]">{ELIGIBILITY_LABEL[c.eligibility]}</span>
                </button>
              ))
            )}
          </div>
        )}

        {selected && (
          <div className="space-y-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-3">
            <p className="text-xs text-[var(--text-secondary)]">대상: <strong>{selected.name}</strong> ({selected.email})</p>
            <label className="block">
              <span className="text-[var(--text-secondary)]">계속하려면 <strong>{GRANT_PHRASE}</strong>를 정확히 입력해 주세요.</span>
              <input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder={GRANT_PHRASE} aria-label="부여 확인 문구" className="mt-2 h-10 w-full rounded-md border border-[var(--border-default)] px-3 text-sm outline-none focus:border-[var(--brand-primary)]" />
            </label>
            <p className="text-[11px] text-[var(--text-tertiary)]">대상은 현재 세션에서 자동으로 관리자 권한이 활성화되지 않으며, 다시 로그인·재인증해야 합니다.</p>
          </div>
        )}
        {error && <p className="text-sm text-[var(--danger-text)]">{error}</p>}
      </div>
    </DialogShell>
  );
}

function RevokeModal({ target, onClose, onRevoked }: { target: MasterAdminDto; onClose: () => void; onRevoked: () => void }) {
  const { onReauthRequired } = useAdminReauth();
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRevoke() {
    if (confirmation.trim() !== REVOKE_PHRASE || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/master-admins/${target.userId}/revoke`, {
        method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: confirmation.trim() }),
      });
      const payload = (await res.json().catch(() => null)) as { data?: { ok?: boolean }; error?: { message?: string; code?: string } } | null;
      if (!res.ok || !payload?.data?.ok) {
        if (payload?.error?.code === "ADMIN_REAUTH_REQUIRED") { setError(payload.error.message ?? "관리자 인증이 필요합니다."); onReauthRequired(); return; }
        setError(payload?.error?.message ?? "권한 해제를 처리하지 못했습니다.");
        return;
      }
      onRevoked();
    } catch {
      setError("권한 해제를 처리하지 못했습니다. 네트워크 상태를 확인해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogShell
      title="MasterAdmin 권한 해제"
      description="권한을 해제해도 일반 로그인과 기존 회사 권한은 유지됩니다. 대상의 기존 관리자 재인증은 즉시 무효화됩니다."
      onClose={() => { if (!submitting) onClose(); }}
      maxWidth="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={submitting} className="h-10 rounded-md border border-[var(--border-subtle)] px-4 text-sm font-medium hover:bg-[var(--surface-muted)] disabled:opacity-60">취소</button>
          <button type="button" onClick={handleRevoke} disabled={confirmation.trim() !== REVOKE_PHRASE || submitting} className="h-10 rounded-md bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-200">
            {submitting ? "처리 중…" : "권한 해제"}
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
        <label className="block">
          <span className="text-[var(--text-secondary)]">계속하려면 <strong>{REVOKE_PHRASE}</strong>를 정확히 입력해 주세요.</span>
          <input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder={REVOKE_PHRASE} aria-label="해제 확인 문구" className="mt-2 h-10 w-full rounded-md border border-[var(--border-default)] px-3 text-sm outline-none focus:border-red-500" />
        </label>
        {error && <p className="text-sm text-[var(--danger-text)]">{error}</p>}
      </div>
    </DialogShell>
  );
}

function Pagination({ pagination, refetching, onParamsChange }: { pagination: InvitationPagination; refetching: boolean; onParamsChange: (patch: AdminParamPatch) => void }) {
  const { page, totalPages, total, hasPrevious, hasNext } = pagination;
  return (
    <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
      <span aria-live="polite">총 {total}건{refetching && <span className="ml-2 text-xs text-[var(--text-tertiary)]">갱신 중…</span>}</span>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button type="button" disabled={!hasPrevious} onClick={() => onParamsChange({ adminMasterPage: page - 1 })} className="inline-flex h-8 items-center rounded-md border border-[var(--border-default)] bg-white px-3 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:opacity-40">이전</button>
          <span className="text-xs text-[var(--text-tertiary)]">{page} / {totalPages}</span>
          <button type="button" disabled={!hasNext} onClick={() => onParamsChange({ adminMasterPage: page + 1 })} className="inline-flex h-8 items-center rounded-md border border-[var(--border-default)] bg-white px-3 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:opacity-40">다음</button>
        </div>
      )}
    </div>
  );
}
