"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, Users } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import {
  COMPANY_USER_SIZES,
  COMPANY_USER_STATUS_FILTERS,
} from "@/lib/company/company-user-filters";
import type {
  CompanyUserDto,
  CompanyUserSort,
  CompanyUserStatusFilter,
  InvitationPagination,
} from "@/lib/company/types";
import { cn } from "@/lib/utils";
import { CompanyUserDrawer } from "./company-user-drawer";

export type CompanyUserParams = {
  q: string;
  status: CompanyUserStatusFilter;
  page: number;
  size: number;
  sort: CompanyUserSort;
};

export type CompanyUserParamPatch = Record<string, string | number | null>;

type LoadState =
  | { kind: "loading" }
  | { kind: "forbidden" }
  | { kind: "error"; message: string }
  | { kind: "ready"; users: CompanyUserDto[]; pagination: InvitationPagination };

const STATUS_FILTER_LABELS: Record<CompanyUserStatusFilter, string> = {
  ALL: "전체",
  ACTIVE: "활성",
  INACTIVE: "비활성",
};

const SORT_OPTIONS: Array<{ value: CompanyUserSort; label: string }> = [
  { value: "nameAsc", label: "이름 오름차순" },
  { value: "nameDesc", label: "이름 내림차순" },
  { value: "newest", label: "최근 등록순" },
];

export function CompanyUserList({
  params,
  onParamsChange,
}: {
  params: CompanyUserParams;
  onParamsChange: (patch: CompanyUserParamPatch, opts?: { replace?: boolean }) => void;
}) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [qDraft, setQDraft] = useState(params.q);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { q, status, page, size, sort } = params;

  useEffect(() => {
    setQDraft(q);
  }, [q]);

  const load = useCallback(async () => {
    setState({ kind: "loading" });

    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (status !== "ALL") sp.set("status", status);
    if (sort !== "nameAsc") sp.set("sort", sort);
    if (size !== 20) sp.set("size", String(size));
    if (page !== 1) sp.set("page", String(page));
    const query = sp.toString();

    try {
      const response = await fetch(`/api/company/users${query ? `?${query}` : ""}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            data?: { users: CompanyUserDto[]; pagination: InvitationPagination };
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
          message: payload?.error?.message ?? "회원 목록을 불러오지 못했습니다.",
        });
        return;
      }

      setState({ kind: "ready", users: payload.data.users, pagination: payload.data.pagination });

      // 서버가 page 를 clamp 했으면 URL 보정(history 오염 방지 위해 replace).
      if (payload.data.pagination.page !== page) {
        onParamsChange({ page: payload.data.pagination.page }, { replace: true });
      }
    } catch {
      setState({ kind: "error", message: "회원 목록을 불러오지 못했습니다." });
    }
  }, [q, status, sort, size, page, onParamsChange]);

  useEffect(() => {
    void load();
  }, [load]);

  function applySearch() {
    onParamsChange({ q: qDraft.trim() || null, page: null });
  }

  // 저장 성공: Role 요약만 바뀌므로 현재 행만 갱신(필터 영향 없음 → 재조회 불필요).
  function handleSaved(userId: string, tokens: string[]) {
    setState((prev) =>
      prev.kind === "ready"
        ? {
            kind: "ready",
            pagination: prev.pagination,
            users: prev.users.map((user) =>
              user.userId === userId ? { ...user, roles: tokens } : user,
            ),
          }
        : prev,
    );
  }

  // 활성/비활성 변경: 상태 필터 결과가 달라질 수 있으므로 현재 조건으로 재조회한다.
  function handleStatusChanged() {
    void load();
  }

  if (state.kind === "forbidden") {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="CO 권한이 필요합니다"
        description="회사 회원 관리는 Company 소유자(CO)만 사용할 수 있습니다."
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
              placeholder="이름 또는 이메일 검색"
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
            {COMPANY_USER_SIZES.map((option) => (
              <option key={option} value={option}>
                {option}개씩
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-1">
          {COMPANY_USER_STATUS_FILTERS.map((value) => (
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
            회원 목록을 불러오는 중입니다.
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

        {state.kind === "ready" && state.users.length === 0 && (
          <EmptyState
            icon={Users}
            title={q || status !== "ALL" ? "조건에 맞는 회원이 없습니다" : "회원이 없습니다"}
            description={
              q || status !== "ALL"
                ? "검색어나 상태 필터를 변경해 보세요."
                : "이 회사에 표시할 사용자가 없습니다."
            }
          />
        )}

        {state.kind === "ready" && state.users.length > 0 && (
          <>
            <div className="overflow-hidden rounded-lg border border-[var(--border-default)] bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] text-left text-xs font-medium text-[var(--text-tertiary)]">
                    <th className="px-4 py-3">이름</th>
                    <th className="px-4 py-3">이메일</th>
                    <th className="px-4 py-3">권한 요약</th>
                    <th className="px-4 py-3">상태</th>
                    <th className="px-4 py-3 text-right">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {state.users.map((user) => (
                    <tr
                      key={user.userId}
                      className="border-b border-[var(--border-default)] last:border-0 hover:bg-[var(--bg-subtle)]"
                    >
                      <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{user.name}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{user.email}</td>
                      <td className="px-4 py-3">
                        {user.roles.length === 0 ? (
                          <span className="text-xs text-[var(--text-tertiary)]">역할 없음</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {user.roles.map((token) => (
                              <RoleBadge key={token} token={token} />
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ring-inset",
                            user.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                              : "bg-[var(--bg-muted)] text-[var(--text-tertiary)] ring-[var(--border-default)]",
                          )}
                        >
                          {user.status === "ACTIVE" ? "활성" : "비활성"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedUserId(user.userId)}
                          className="inline-flex h-8 items-center rounded-md border border-[var(--border-default)] px-3 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                        >
                          상세/권한 관리
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination pagination={state.pagination} onParamsChange={onParamsChange} />
          </>
        )}
      </div>

      {selectedUserId && (
        <CompanyUserDrawer
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onSaved={handleSaved}
          onStatusChanged={handleStatusChanged}
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
  onParamsChange: (patch: CompanyUserParamPatch) => void;
}) {
  const { page, totalPages, total, hasPrevious, hasNext } = pagination;

  return (
    <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
      <span>총 {total}명</span>
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

function RoleBadge({ token }: { token: string }) {
  // CO / WO(W) / PO(P) = 소유자급 강조, 그 외(M/V)는 muted
  const isOwner = token === "CO" || token === "WO(W)" || token === "PO(P)";

  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ring-inset",
        isOwner
          ? "bg-blue-50 text-blue-700 ring-blue-200"
          : "bg-[var(--bg-muted)] text-[var(--text-secondary)] ring-[var(--border-default)]",
      )}
    >
      {token}
    </span>
  );
}
