"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, Users } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import type { CompanyUserDto, CompanyUserListDto } from "@/lib/company/types";
import { cn } from "@/lib/utils";

type LoadState =
  | { kind: "loading" }
  | { kind: "forbidden" }
  | { kind: "error"; message: string }
  | { kind: "ready"; users: CompanyUserDto[] };

export function CompanyUserList() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/company/users", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as
          | { data?: CompanyUserListDto; error?: { message?: string } }
          | null;

        if (!active) {
          return;
        }

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

        setState({ kind: "ready", users: payload.data.users });
      } catch {
        if (active) {
          setState({ kind: "error", message: "회원 목록을 불러오지 못했습니다." });
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  if (state.kind === "loading") {
    return (
      <div className="rounded-lg border border-[var(--border-default)] bg-white px-6 py-12 text-center text-sm text-[var(--text-secondary)]">
        회원 목록을 불러오는 중입니다.
      </div>
    );
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

  if (state.kind === "error") {
    return (
      <EmptyState icon={ShieldAlert} title="불러오기 실패" description={state.message} />
    );
  }

  if (state.users.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="회원이 없습니다"
        description="이 회사에 표시할 사용자가 없습니다."
      />
    );
  }

  return (
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
                      : "bg-amber-50 text-amber-700 ring-amber-200",
                  )}
                >
                  {user.status === "ACTIVE" ? "활성" : "대기"}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                {/* c7-2 에서 상세 drawer / Role Matrix 편집으로 연결 예정 */}
                <button
                  type="button"
                  disabled
                  title="권한 관리(Role 매트릭스) 편집은 다음 단계(c7-2)에서 제공됩니다."
                  className="inline-flex h-8 cursor-not-allowed items-center rounded-md border border-[var(--border-default)] px-3 text-xs font-medium text-[var(--text-tertiary)] opacity-60"
                >
                  권한 관리
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
