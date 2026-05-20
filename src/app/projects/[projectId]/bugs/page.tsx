import { AppShell } from "@/components/layout/app-shell";
import { ProjectHeader } from "@/components/layout/project-header";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { PageHeader } from "@/components/common/page-header";
import { DefectManager } from "@/features/defects/defect-manager";
import { getProjectName } from "@/lib/project-context";

export default async function BugsPage({
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
          { label: "결함" },
        ]}
      />
      <ProjectHeader projectId={projectId} activeTab="bugs" />
      <PageHeader
        title="결함"
        description="결함을 등록하고 상태, 심각도, 우선순위, 연관 테스트케이스를 관리합니다."
      />
      <DefectManager projectId={projectId} />
    </AppShell>
  );
}
