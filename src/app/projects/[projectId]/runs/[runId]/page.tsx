import { AppShell } from "@/components/layout/app-shell";
import { ProjectHeader } from "@/components/layout/project-header";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { PageHeader } from "@/components/common/page-header";
import { TestRunRunner } from "@/features/test-runs/test-run-runner";
import { getProjectName } from "@/lib/project-context";

export default async function TestRunDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; runId: string }>;
}) {
  const { projectId, runId } = await params;
  const projectName = getProjectName(projectId);

  return (
    <AppShell>
      <Breadcrumbs
        items={[
          { label: "프로젝트", href: "/projects" },
          { label: projectName },
          { label: "테스트실행", href: `/projects/${projectId}/runs` },
          { label: "실행 상세" },
        ]}
      />
      <ProjectHeader projectId={projectId} activeTab="runs" />
      <PageHeader
        title="테스트 실행 상세"
        description="테스터가 TC를 하나씩 확인하며 결과를 기록하는 실행 화면입니다."
      />
      <TestRunRunner runId={runId} />
    </AppShell>
  );
}
