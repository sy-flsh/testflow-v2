import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { PageHeader } from "@/components/common/page-header";
import { AdminAccountsView } from "@/features/admin/admin-accounts-view";
import { AdminReauthGate } from "@/features/admin/admin-reauth-gate";

export default function AdminAccountsPage() {
  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "관리자" }, { label: "계정 관리" }]} />
      <PageHeader
        title="계정 관리"
        description="탈퇴 처리된 계정을 조회·복구하고, 활성 계정을 강제 정지할 수 있습니다. 강제 정지/복구는 기존 권한 정보를 보존하며, 강제 정지된 사용자는 즉시 로그인 세션이 종료됩니다."
      />
      <Suspense fallback={<div className="text-sm text-[var(--text-secondary)]">불러오는 중…</div>}>
        <AdminReauthGate>
          <AdminAccountsView />
        </AdminReauthGate>
      </Suspense>
    </AppShell>
  );
}
