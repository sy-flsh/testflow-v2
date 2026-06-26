"use client";

import { AccessRestricted } from "@/components/layout/access-restricted";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopHeader } from "@/components/layout/top-header";
import { useCurrentAuth } from "@/features/auth/use-current-auth";

/**
 * c9-4: AuthProvider 안에서 /api/auth/me 결과에 따라 앱 셸을 렌더한다.
 * - errorCode === "USER_INACTIVE": 로그인으로 redirect 하지 않고 전용 접근 제한 화면(네비게이션 없음).
 * - 그 외(정상/일반 401/403): 기존 셸(헤더+사이드바+children) 유지.
 * - 인증 로딩 중에는 민감한 page 콘텐츠 대신 로딩 표시(비활성 사용자의 콘텐츠 깜빡임 방지).
 */
export function AppShellBody({ children }: { children: React.ReactNode }) {
  // c9-5: isInitialLoading 일 때만 로딩 표시. background revalidation(isRefreshing) 에서는
  // 현재 화면(정상 셸 또는 AccessRestricted)을 그대로 유지해 깜빡임을 막는다.
  const { errorCode, isInitialLoading } = useCurrentAuth();

  if (errorCode === "USER_INACTIVE") {
    return <AccessRestricted />;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-subtle)]">
      <TopHeader />
      <AppSidebar />
      <main className="tf-main">
        <div className="tf-main-inner mx-auto max-w-7xl">
          {isInitialLoading ? (
            <div className="px-6 py-12 text-center text-sm text-[var(--text-secondary)]">
              불러오는 중…
            </div>
          ) : (
            children
          )}
        </div>
      </main>
    </div>
  );
}
