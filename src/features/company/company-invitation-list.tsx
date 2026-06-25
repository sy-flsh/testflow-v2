"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, ShieldAlert } from "lucide-react";
import type { InvitationStatus } from "@prisma/client";
import { EmptyState } from "@/components/common/empty-state";
import {
  INVITATION_SIZES,
  INVITATION_STATUS_FILTERS,
} from "@/lib/company/invitation-filters";
import type {
  CompanyInvitationDto,
  InvitationPagination,
  InvitationSort,
  InvitationStatusFilter,
} from "@/lib/company/types";
import { cn } from "@/lib/utils";
import { InviteSuccessDrawer, type InviteSuccessData } from "./invite-success";
import { inviteErrorMessage, rolesToSummaryTokens } from "./role-matrix-utils";

export type InvitationParams = {
  q: string;
  status: InvitationStatusFilter;
  page: number;
  size: number;
  sort: InvitationSort;
};

export type InvitationParamPatch = Record<string, string | number | null>;

type LoadState =
  | { kind: "loading" }
  | { kind: "forbidden" }
  | { kind: "error"; message: string }
  | { kind: "ready"; invitations: CompanyInvitationDto[]; pagination: InvitationPagination };

const STATUS_LABELS: Record<InvitationStatus, string> = {
  PENDING: "대기 중",
  ACCEPTED: "수락 완료",
  REVOKED: "취소됨",
  EXPIRED: "만료됨",
};

const STATUS_FILTER_LABELS: Record<InvitationStatusFilter, string> = {
  ALL: "전체",
  PENDING: "대기 중",
  ACCEPTED: "수락 완료",
  REVOKED: "취소됨",
  EXPIRED: "만료됨",
};

const STATUS_STYLES: Record<InvitationStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700 ring-amber-200",
  ACCEPTED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  REVOKED: "bg-[var(--bg-muted)] text-[var(--text-tertiary)] ring-[var(--border-default)]",
  EXPIRED: "bg-[var(--bg-muted)] text-[var(--text-tertiary)] ring-[var(--border-default)]",
};

const SORT_OPTIONS: Array<{ value: InvitationSort; label: string }> = [
  { value: "newest", label: "최신 생성순" },
  { value: "oldest", label: "오래된 생성순" },
  { value: "expiresAtAsc", label: "만료 임박순" },
  { value: "expiresAtDesc", label: "만료 늦은순" },
];

export function CompanyInvitationList({
  params,
  refreshNonce,
  onParamsChange,
}: {
  params: InvitationParams;
  refreshNonce: number;
  onParamsChange: (patch: InvitationParamPatch, opts?: { replace?: boolean }) => void;
}) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [qDraft, setQDraft] = useState(params.q);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [resendConfirmId, setResendConfirmId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState<InviteSuccessData | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  const { q, status, page, size, sort } = params;

  // 검색어가 URL(뒤로/앞으로)로 바뀌면 입력 draft 도 동기화.
  useEffect(() => {
    setQDraft(q);
  }, [q]);

  const load = useCallback(async () => {
    setState({ kind: "loading" });

    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (status !== "ALL") sp.set("status", status);
    if (sort !== "newest") sp.set("sort", sort);
    if (size !== 20) sp.set("size", String(size));
    if (page !== 1) sp.set("page", String(page));
    const query = sp.toString();

    try {
      const response = await fetch(
        `/api/company/invitations${query ? `?${query}` : ""}`,
        { cache: "no-store" },
      );
      const payload = (await response.json().catch(() => null)) as
        | {
            data?: { invitations: CompanyInvitationDto[]; pagination: InvitationPagination };
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
          message: payload?.error?.message ?? "초대 목록을 불러오지 못했습니다.",
        });
        return;
      }

      setState({
        kind: "ready",
        invitations: payload.data.invitations,
        pagination: payload.data.pagination,
      });

      // 서버가 page 를 clamp 했으면(범위 초과) URL page 를 보정한다(history 오염 방지 위해 replace).
      if (payload.data.pagination.page !== page) {
        onParamsChange({ page: payload.data.pagination.page }, { replace: true });
      }
    } catch {
      setState({ kind: "error", message: "초대 목록을 불러오지 못했습니다." });
    }
  }, [q, status, sort, size, page, onParamsChange]);

  useEffect(() => {
    void load();
  }, [load, refreshNonce]);

  function applySearch() {
    onParamsChange({ q: qDraft.trim() || null, page: null });
  }

  async function revoke(id: string) {
    setRevokingId(id);
    setRowError(null);

    try {
      const response = await fetch(`/api/company/invitations/${id}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = (await response.json().catch(() => null)) as
        | { data?: unknown; error?: { message?: string; code?: string } }
        | null;

      if (!response.ok || !payload?.data) {
        setRowError({ id, message: inviteErrorMessage(payload?.error?.code, payload?.error?.message) });
        return;
      }

      // 성공: 현재 조건으로 재조회(상태 필터/페이지 비움 보정 포함).
      setConfirmingId(null);
      await load();
    } catch {
      setRowError({ id, message: "초대 취소에 실패했습니다. 네트워크 상태를 확인해 주세요." });
    } finally {
      setRevokingId(null);
    }
  }

  async function resend(id: string) {
    setResendingId(id);
    setRowError(null);

    try {
      const response = await fetch(`/api/company/invitations/${id}/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = (await response.json().catch(() => null)) as
        | { data?: InviteSuccessData; error?: { message?: string; code?: string } }
        | null;

      if (!response.ok || !payload?.data) {
        setRowError({ id, message: inviteErrorMessage(payload?.error?.code, payload?.error?.message) });
        return;
      }

      setResendConfirmId(null);
      setResendSuccess(payload.data);
    } catch {
      setRowError({ id, message: "초대 재발송에 실패했습니다. 네트워크 상태를 확인해 주세요." });
    } finally {
      setResendingId(null);
    }
  }

  async function closeResendSuccess() {
    // raw inviteUrl 을 state 에서 제거하고 목록을 최신화(기존 REVOKED + 새 PENDING 반영).
    setResendSuccess(null);
    await load();
  }

  if (state.kind === "forbidden") {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="CO 권한이 필요합니다"
        description="초대 관리는 Company 소유자(CO)만 사용할 수 있습니다."
      />
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* 검색 / 상태 필터 / 정렬 / size */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 items-center gap-2">
            <input
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  applySearch();
                }
              }}
              placeholder="초대 이메일 검색"
              className="h-9 w-full max-w-xs rounded-md border border-[var(--border-default)] bg-white px-3 text-sm outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-primary)]"
            />
            <button
              type="button"
              onClick={applySearch}
              className="h-9 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
            >
              검색
            </button>
          </div>

          <select
            value={sort}
            onChange={(e) => onParamsChange({ sort: e.target.value, page: null })}
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
            onChange={(e) => onParamsChange({ size: Number(e.target.value), page: null })}
            className="h-9 rounded-md border border-[var(--border-default)] bg-white px-2 text-sm text-[var(--text-secondary)] outline-none focus:border-[var(--brand-primary)]"
          >
            {INVITATION_SIZES.map((option) => (
              <option key={option} value={option}>
                {option}개씩
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-1">
          {INVITATION_STATUS_FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onParamsChange({ status: value, page: null })}
              className={cn(
                "h-8 rounded-md px-3 text-xs font-medium ring-1 ring-inset transition-colors",
                status === value
                  ? "bg-[var(--brand-primary)] text-white ring-[var(--brand-primary)]"
                  : "bg-white text-[var(--text-secondary)] ring-[var(--border-default)] hover:bg-[var(--bg-subtle)]",
              )}
            >
              {STATUS_FILTER_LABELS[value]}
            </button>
          ))}
        </div>

        {/* 콘텐츠 */}
        {state.kind === "loading" && (
          <div className="rounded-lg border border-[var(--border-default)] bg-white px-6 py-12 text-center text-sm text-[var(--text-secondary)]">
            초대 목록을 불러오는 중입니다.
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

        {state.kind === "ready" && state.invitations.length === 0 && (
          <EmptyState
            icon={Mail}
            title={q || status !== "ALL" ? "조건에 맞는 초대가 없습니다" : "초대가 없습니다"}
            description={
              q || status !== "ALL"
                ? "검색어나 상태 필터를 변경해 보세요."
                : "상단 [사용자 초대] 버튼으로 새 초대를 생성하세요."
            }
          />
        )}

        {state.kind === "ready" && state.invitations.length > 0 && (
          <>
            <div className="overflow-hidden rounded-lg border border-[var(--border-default)] bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] text-left text-xs font-medium text-[var(--text-tertiary)]">
                    <th className="px-4 py-3">이메일</th>
                    <th className="px-4 py-3">권한 요약</th>
                    <th className="px-4 py-3">상태</th>
                    <th className="px-4 py-3">초대한 사람</th>
                    <th className="px-4 py-3">생성일</th>
                    <th className="px-4 py-3">만료일</th>
                    <th className="px-4 py-3 text-right">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {state.invitations.map((invitation) => {
                    const tokens = rolesToSummaryTokens(invitation.roles);

                    return (
                      <tr
                        key={invitation.id}
                        className="border-b border-[var(--border-default)] last:border-0"
                      >
                        <td className="px-4 py-3 text-[var(--text-primary)]">
                          <div className="font-medium">{invitation.email}</div>
                          {invitation.existingUser && (
                            <div className="text-xs text-[var(--text-tertiary)]">기존 계정</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {tokens.map((t, i) => (
                              <span
                                key={`${t}-${i}`}
                                className="inline-flex h-6 items-center rounded-full bg-[var(--bg-muted)] px-2.5 text-xs font-medium text-[var(--text-secondary)] ring-1 ring-inset ring-[var(--border-default)]"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ring-inset",
                              STATUS_STYLES[invitation.status],
                            )}
                          >
                            {STATUS_LABELS[invitation.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">
                          {invitation.invitedBy?.name ?? invitation.invitedBy?.email ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-[var(--text-tertiary)]">
                          {formatDate(invitation.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-[var(--text-tertiary)]">
                          {formatDate(invitation.expiresAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {invitation.status === "PENDING" ? (
                            resendConfirmId === invitation.id ? (
                              <div className="inline-flex items-center gap-2">
                                <span className="text-xs text-[var(--text-tertiary)]">
                                  기존 링크는 즉시 무효화되고 새 링크가 생성됩니다.
                                </span>
                                <button
                                  type="button"
                                  disabled={resendingId === invitation.id}
                                  onClick={() => resend(invitation.id)}
                                  className="inline-flex h-8 items-center rounded-md bg-[var(--brand-primary)] px-3 text-xs font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-60"
                                >
                                  {resendingId === invitation.id ? "재발송 중…" : "재발송"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setResendConfirmId(null)}
                                  className="inline-flex h-8 items-center rounded-md border border-[var(--border-default)] px-3 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                                >
                                  취소
                                </button>
                              </div>
                            ) : confirmingId === invitation.id ? (
                              <div className="inline-flex items-center gap-2">
                                <span className="text-xs text-[var(--text-tertiary)]">취소할까요?</span>
                                <button
                                  type="button"
                                  disabled={revokingId === invitation.id}
                                  onClick={() => revoke(invitation.id)}
                                  className="inline-flex h-8 items-center rounded-md bg-[var(--status-fail)] px-3 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-60"
                                >
                                  {revokingId === invitation.id ? "취소 중…" : "확인"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmingId(null)}
                                  className="inline-flex h-8 items-center rounded-md border border-[var(--border-default)] px-3 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                                >
                                  유지
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRowError(null);
                                    setConfirmingId(null);
                                    setResendConfirmId(invitation.id);
                                  }}
                                  className="inline-flex h-8 items-center rounded-md border border-[var(--border-default)] px-3 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                                >
                                  재발송
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRowError(null);
                                    setResendConfirmId(null);
                                    setConfirmingId(invitation.id);
                                  }}
                                  className="inline-flex h-8 items-center rounded-md border border-[var(--border-default)] px-3 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                                >
                                  초대 취소
                                </button>
                              </div>
                            )
                          ) : (
                            <span className="text-xs text-[var(--text-tertiary)]">—</span>
                          )}
                          {rowError?.id === invitation.id && (
                            <div className="mt-1 text-xs text-[var(--danger-text)]">{rowError.message}</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination pagination={state.pagination} onParamsChange={onParamsChange} />
          </>
        )}
      </div>

      {resendSuccess && (
        <InviteSuccessDrawer
          title="초대 재발송 완료"
          data={resendSuccess}
          onClose={closeResendSuccess}
        />
      )}
    </>
  );
}

function Pagination({
  pagination,
  onParamsChange,
}: {
  pagination: InvitationPagination;
  onParamsChange: (patch: InvitationParamPatch) => void;
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
            onClick={() => onParamsChange({ page: page - 1 })}
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
            onClick={() => onParamsChange({ page: page + 1 })}
            className="inline-flex h-8 items-center rounded-md border border-[var(--border-default)] bg-white px-3 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
