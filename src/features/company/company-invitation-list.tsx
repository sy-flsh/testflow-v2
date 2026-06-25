"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, ShieldAlert } from "lucide-react";
import type { InvitationStatus } from "@prisma/client";
import { EmptyState } from "@/components/common/empty-state";
import type { CompanyInvitationDto } from "@/lib/company/types";
import { cn } from "@/lib/utils";
import { inviteErrorMessage, rolesToSummaryTokens } from "./role-matrix-utils";

type LoadState =
  | { kind: "loading" }
  | { kind: "forbidden" }
  | { kind: "error"; message: string }
  | { kind: "ready"; invitations: CompanyInvitationDto[] };

const STATUS_LABELS: Record<InvitationStatus, string> = {
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

export function CompanyInvitationList({ refreshKey }: { refreshKey: number }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });

    try {
      const response = await fetch("/api/company/invitations", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as
        | { data?: { invitations: CompanyInvitationDto[] }; error?: { message?: string } }
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

      setState({ kind: "ready", invitations: payload.data.invitations });
    } catch {
      setState({ kind: "error", message: "초대 목록을 불러오지 못했습니다." });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

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

      // 성공: 해당 행 상태만 REVOKED 로 즉시 갱신.
      setState((prev) =>
        prev.kind === "ready"
          ? {
              kind: "ready",
              invitations: prev.invitations.map((invitation) =>
                invitation.id === id ? { ...invitation, status: "REVOKED" } : invitation,
              ),
            }
          : prev,
      );
      setConfirmingId(null);
    } catch {
      setRowError({ id, message: "초대 취소에 실패했습니다. 네트워크 상태를 확인해 주세요." });
    } finally {
      setRevokingId(null);
    }
  }

  if (state.kind === "loading") {
    return (
      <div className="rounded-lg border border-[var(--border-default)] bg-white px-6 py-12 text-center text-sm text-[var(--text-secondary)]">
        초대 목록을 불러오는 중입니다.
      </div>
    );
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

  if (state.kind === "error") {
    return <EmptyState icon={ShieldAlert} title="불러오기 실패" description={state.message} />;
  }

  if (state.invitations.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title="초대가 없습니다"
        description="상단 [사용자 초대] 버튼으로 새 초대를 생성하세요."
      />
    );
  }

  return (
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
                <td className="px-4 py-3 text-[var(--text-tertiary)]">{formatDate(invitation.createdAt)}</td>
                <td className="px-4 py-3 text-[var(--text-tertiary)]">{formatDate(invitation.expiresAt)}</td>
                <td className="px-4 py-3 text-right">
                  {invitation.status === "PENDING" ? (
                    confirmingId === invitation.id ? (
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
                      <button
                        type="button"
                        onClick={() => {
                          setRowError(null);
                          setConfirmingId(invitation.id);
                        }}
                        className="inline-flex h-8 items-center rounded-md border border-[var(--border-default)] px-3 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                      >
                        초대 취소
                      </button>
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
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
