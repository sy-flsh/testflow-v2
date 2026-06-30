import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { PageHeader } from "@/components/common/page-header";
import { AdminDeletedAccountsView } from "@/features/admin/admin-deleted-accounts-view";
import { AdminReauthGate } from "@/features/admin/admin-reauth-gate";

export default function AdminAccountsPage() {
  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "관리자" }, { label: "탈퇴 계정 관리" }]} />
      <PageHeader
        title="탈퇴 계정 관리"
        description="탈퇴 처리된 계정을 조회하고 필요한 경우 복구할 수 있습니다. 복구해도 기존 로그인 세션은 자동으로 생성되지 않으며, 사용자는 다시 로그인해야 합니다."
      />
      <Suspense fallback={<div className="text-sm text-[var(--text-secondary)]">불러오는 중…</div>}>
        <AdminReauthGate>
          <AdminDeletedAccountsView />
        </AdminReauthGate>
      </Suspense>
    </AppShell>
  );
}
