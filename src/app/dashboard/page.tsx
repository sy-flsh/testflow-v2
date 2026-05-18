import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { PageHeader } from "@/components/common/page-header";
import { DashboardSummary } from "@/features/dashboard/dashboard-summary";

export default function DashboardPage() {
  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "대시보드" }]} />
      <PageHeader
        title="대시보드"
        description="워크스페이스 전체 테스트 활동 요약을 확인합니다."
      />
      <DashboardSummary />
    </AppShell>
  );
}
