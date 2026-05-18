import { AppShell } from "@/components/layout/app-shell";
import { ProjectHeader } from "@/components/layout/project-header";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { PageHeader } from "@/components/common/page-header";
import { TestCaseManager } from "@/features/testcases/testcase-manager";

export default function TestCasesPage() {
  return (
    <AppShell>
      <Breadcrumbs
        items={[
          { label: "프로젝트", href: "/projects" },
          { label: "결제 시스템 v2" },
          { label: "테스트케이스" },
        ]}
      />
      <ProjectHeader activeTab="testcases" />
      <PageHeader
        title="테스트케이스"
        description="Folder Tree, TC Table, CSV Import, TC Drawer가 들어갈 화면입니다."
      />
      <TestCaseManager />
    </AppShell>
  );
}
