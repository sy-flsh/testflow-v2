"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCurrentAuth } from "@/features/auth/use-current-auth";

/**
 * c9-4: 비활성 Company 때문에 접근 가능한 ACTIVE Workspace 가 없는 사용자에게
 * 보여주는 전용 접근 제한 화면. (로그인 화면으로 redirect 하지 않고 안내 + 로그아웃 제공)
 * - app navigation/sidebar 를 노출하지 않는 full-page 화면.
 * - Company 이름/권한 상세는 노출하지 않는다.
 */
export function AccessRestricted() {
  const router = useRouter();
  const { logout } = useCurrentAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      // logout 실패 여부와 무관하게 로그인 화면으로 이동(세션은 강제 삭제하지 않음).
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg-subtle)] px-6 py-12">
      <div className="w-full max-w-md rounded-lg border border-[var(--border-default)] bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-200">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">접근이 제한되었습니다</h1>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          현재 Company에서 비활성화되어 서비스를 이용할 수 없습니다.
          <br />
          회사 관리자에게 활성화를 요청해 주세요.
        </p>
        <p className="mt-2 text-xs text-[var(--text-tertiary)]">
          다른 Company에 접근 권한이 있는 경우 관리자에게 활성 상태를 확인해 주세요.
        </p>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-md bg-[var(--brand-primary)] text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loggingOut ? "로그아웃 중…" : "로그아웃"}
        </button>
      </div>
    </main>
  );
}
