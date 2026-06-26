import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { PageHeader } from "@/components/common/page-header";
import { CompanySecurityAuditView } from "@/features/company/company-security-audit-view";

export default function CompanySecurityAuditPage() {
  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "회사 관리" }, { label: "보안 감사 로그" }]} />
      <PageHeader
        title="보안 감사 로그"
        description="회사 사용자 상태 변경 및 접근 차단 관련 보안 이벤트를 확인합니다. 기본 보관 기간은 90일이며, 운영 설정에 따라 달라질 수 있습니다. (CO 전용)"
      />
      {/* c9-7: useSearchParams 사용 클라이언트 뷰를 Suspense 로 감싼다. */}
      <Suspense fallback={<div className="text-sm text-[var(--text-secondary)]">불러오는 중…</div>}>
        <CompanySecurityAuditView />
      </Suspense>
    </AppShell>
  );
}
