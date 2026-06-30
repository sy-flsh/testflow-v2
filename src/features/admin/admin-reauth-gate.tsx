"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { AdminReauthContext } from "@/features/admin/admin-reauth-context";

type Phase = "checking" | "forbidden" | "gate" | "elevated";

/**
 * c10-5: MasterAdmin step-up 재인증 gate.
 *
 * - 진입 시 GET /api/admin/reauth/status 로 현재 Session elevation 확인.
 * - elevated=true 일 때만 children(admin view)을 렌더한다 → gate 전엔 admin data 를 fetch 하지 않음.
 * - children 이 ADMIN_REAUTH_REQUIRED(403)를 받으면 onReauthRequired()로 gate 로 전환(목록 즉시 숨김).
 * - non-MasterAdmin(403 AUTH_FORBIDDEN)은 forbidden UI. soft-deleted MasterAdmin 은 AppShell 의
 *   AccountDeleted 가 우선(이 컴포넌트까지 도달하지 않음). 권한 최종 판단은 서버 guard.
 */
export function AdminReauthGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    setPhase("checking");
    setError(null);
    try {
      const response = await fetch("/api/admin/reauth/status", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as
        | { data?: { elevated?: boolean; expiresAt?: string | null }; error?: { code?: string } }
        | null;

      if (response.status === 403) {
        setPhase("forbidden");
        return;
      }
      if (response.ok && payload?.data?.elevated) {
        setExpiresAt(payload.data.expiresAt ?? null);
        setPhase("elevated");
        return;
      }
      // 401(미인증)·정상 미인증 → gate(미들웨어/AppShell 이 로그인 흐름을 별도 처리).
      setPhase("gate");
    } catch {
      setPhase("gate");
    }
  }, []);

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  async function submit() {
    if (!password || submitting) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/reauth", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { data?: { ok?: boolean; expiresAt?: string }; error?: { message?: string } }
        | null;
      if (!response.ok || !payload?.data?.ok) {
        setError(payload?.error?.message ?? "관리자 인증에 실패했습니다.");
        return;
      }
      setExpiresAt(payload.data.expiresAt ?? null);
      setPassword("");
      setPhase("elevated");
    } catch {
      setError("관리자 인증을 처리하지 못했습니다. 네트워크 상태를 확인해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  // protected API 가 ADMIN_REAUTH_REQUIRED 를 반환했을 때 view 가 호출 → 즉시 gate 로(목록 숨김).
  const onReauthRequired = useCallback(() => {
    setPhase("gate");
  }, []);

  if (phase === "checking") {
    return (
      <div className="rounded-lg border border-[var(--border-default)] bg-white px-6 py-12 text-center text-sm text-[var(--text-secondary)]">
        관리자 인증 상태를 확인하는 중입니다.
      </div>
    );
  }

  if (phase === "forbidden") {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="관리자 권한이 필요합니다"
        description="이 화면은 MasterAdmin만 사용할 수 있습니다."
      />
    );
  }

  if (phase === "gate") {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-[var(--border-default)] bg-white p-8 shadow-sm">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-200">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">관리자 인증 필요</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          민감한 관리자 작업을 계속하려면 비밀번호를 다시 확인해 주세요.
        </p>
        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <input
            type="password"
            autoComplete="current-password"
            aria-label="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            className="h-10 w-full rounded-md border border-[var(--border-default)] px-3 text-sm outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-primary)]"
          />
          {error && <p className="text-sm text-[var(--danger-text)]">{error}</p>}
          <button
            type="submit"
            disabled={!password || submitting}
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-[var(--brand-primary)] text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "확인 중…" : "관리자 인증"}
          </button>
        </form>
        <p className="mt-3 text-xs text-[var(--text-tertiary)]">
          인증은 현재 브라우저 세션에만 적용되며 15분 뒤 다시 필요합니다.
        </p>
      </div>
    );
  }

  return (
    <AdminReauthContext.Provider value={{ onReauthRequired }}>
      {/* elevated: 만료 표시는 UX 보조이며 실제 권한 판단은 서버 guard 가 한다. */}
      {expiresAt && (
        <p className="mb-3 text-xs text-[var(--text-tertiary)]">
          관리자 인증 유효 시각: {new Date(expiresAt).toLocaleTimeString("ko-KR")} (만료 시 다시 인증)
        </p>
      )}
      {children}
    </AdminReauthContext.Provider>
  );
}
