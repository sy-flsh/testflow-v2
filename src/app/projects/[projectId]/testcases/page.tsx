import { AppShell } from "@/components/layout/app-shell";
import { ProjectHeader } from "@/components/layout/project-header";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { PageHeader } from "@/components/common/page-header";
import { TestCaseManager } from "@/features/testcases/testcase-manager";
import { getProjectName } from "@/lib/project-context";

export default async function TestCasesPage({
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
          { label: "테스트케이스" },
        ]}
      />
      <ProjectHeader projectId={projectId} activeTab="testcases" />
      <PageHeader
        title="테스트케이스"
        description="Folder Tree, TC Table, CSV Import, TC Drawer가 들어갈 화면입니다."
      />
      <TestCaseManager />
    </AppShell>
  );
}
