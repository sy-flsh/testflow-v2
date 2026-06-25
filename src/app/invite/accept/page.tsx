import { Suspense } from "react";
import { InviteAcceptForm } from "@/features/company/invite-accept-form";

// c8-2: 초대 수락 화면(공개). useSearchParams 사용 클라이언트 폼을 Suspense 로 감싼다.
export default function InviteAcceptPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[var(--bg-subtle)] px-6 py-12">
          <p className="text-sm text-[var(--text-secondary)]">초대를 확인하는 중입니다…</p>
        </main>
      }
    >
      <InviteAcceptForm />
    </Suspense>
  );
}
