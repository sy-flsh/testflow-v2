"use client";

import { useState } from "react";
import { UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCurrentAuth } from "@/features/auth/use-current-auth";

/**
 * c10-1: 전역 계정 탈퇴(USER_ACCOUNT_DELETED) 사용자용 전용 화면.
 * - USER_INACTIVE(c9-4 AccessRestricted, Company 단위 비활성)와 구분된다.
 * - 정상 탈퇴 시 세션이 모두 삭제되므로 보통은 도달하지 않지만, stale tab/경쟁 상황에서
 *   /api/auth/me 가 USER_ACCOUNT_DELETED 를 반환하면 민감 셸 대신 이 화면을 노출한다.
 * - app navigation/sidebar/children 을 노출하지 않는 full-page 안내 + 로그인 이동.
 */
export function AccountDeleted() {
  const router = useRouter();
  const { logout } = useCurrentAuth();
  const [leaving, setLeaving] = useState(false);

  async function goToLogin() {
    setLeaving(true);
    try {
      // 세션은 이미 삭제되었을 수 있으나, 클라이언트 상태/쿠키 정리를 위해 best-effort logout.
      await logout();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg-subtle)] px-6 py-12">
      <div className="w-full max-w-md rounded-lg border border-[var(--border-default)] bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 ring-1 ring-inset ring-red-200">
          <UserX className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">탈퇴 처리된 계정입니다</h1>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          이 계정은 탈퇴 처리되어 더 이상 서비스를 이용할 수 없습니다.
          <br />
          계정 복구가 필요한 경우 관리자에게 문의해 주세요.
        </p>
        <button
          type="button"
          onClick={goToLogin}
          disabled={leaving}
          className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-md bg-[var(--brand-primary)] text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {leaving ? "이동 중…" : "로그인 화면으로"}
        </button>
      </div>
    </main>
  );
}
