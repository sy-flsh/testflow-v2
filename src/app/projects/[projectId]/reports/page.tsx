import { AppShell } from "@/components/layout/app-shell";
import { ProjectHeader } from "@/components/layout/project-header";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { PageHeader } from "@/components/common/page-header";
import { ReportDashboard } from "@/features/reports/report-dashboard";
import { getProjectName } from "@/lib/project-context";

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const projectName = getProjectName(projectId);

  return (
    <AppShell>
      <Breadcrumbs
        items={[
          { label: "프로젝트", href: "/projects" },
          { label: projectName },
          { label: "보고서" },
        ]}
      />
      <ProjectHeader projectId={projectId} activeTab="reports" />
      <PageHeader
        title="보고서"
        description="테스트 실행 결과, 결함 추이, 실패가 잦은 테스트케이스를 한 화면에서 확인합니다."
      />
      <ReportDashboard />
    </AppShell>
  );
}
