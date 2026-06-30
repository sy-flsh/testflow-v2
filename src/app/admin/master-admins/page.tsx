import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { PageHeader } from "@/components/common/page-header";
import { AdminMasterAdminsView } from "@/features/admin/admin-master-admins-view";
import { AdminReauthGate } from "@/features/admin/admin-reauth-gate";

export default function AdminMasterAdminsPage() {
  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "관리자" }, { label: "MasterAdmin 관리" }]} />
      <PageHeader
        title="MasterAdmin 관리"
        description="전역 운영 권한을 위임하거나 해제할 수 있습니다. 권한 변경에는 관리자 재인증이 필요합니다. 권한 해제 후 대상 사용자의 기존 관리자 재인증은 즉시 무효화됩니다."
      />
      <Suspense fallback={<div className="text-sm text-[var(--text-secondary)]">불러오는 중…</div>}>
        <AdminReauthGate>
          <AdminMasterAdminsView />
        </AdminReauthGate>
      </Suspense>
    </AppShell>
  );
}
