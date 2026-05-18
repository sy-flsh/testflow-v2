import { AppShell } from "@/components/layout/app-shell";
import { ProjectHeader } from "@/components/layout/project-header";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { PageHeader } from "@/components/common/page-header";
import { TestRunList } from "@/features/test-runs/test-run-list";
import { getProjectName } from "@/lib/project-context";

export default async function TestRunsPage({
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
          { label: "테스트실행" },
        ]}
      />
      <ProjectHeader projectId={projectId} activeTab="runs" />
      <PageHeader
        title="테스트 실행"
        description="테스트 플랜을 만들고 Pass / Fail / Block / Skip 결과를 기록합니다."
      />
      <TestRunList projectId={projectId} />
    </AppShell>
  );
}
