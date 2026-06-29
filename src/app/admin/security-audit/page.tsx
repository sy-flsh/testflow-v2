import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { PageHeader } from "@/components/common/page-header";
import { AdminSecurityAuditView } from "@/features/admin/admin-security-audit-view";

export default function AdminSecurityAuditPage() {
  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "관리자" }, { label: "전역 보안 감사 로그" }]} />
      <PageHeader
        title="전역 보안 감사 로그"
        description="회사 보안 이벤트와 계정 탈퇴·복구 이력을 전역 범위에서 조회합니다. Global 이벤트는 특정 Company에 연결되지 않은 계정 라이프사이클 이벤트입니다."
      />
      <Suspense fallback={<div className="text-sm text-[var(--text-secondary)]">불러오는 중…</div>}>
        <AdminSecurityAuditView />
      </Suspense>
    </AppShell>
  );
}
