import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { PageHeader } from "@/components/common/page-header";
import { ProjectList } from "@/features/projects/project-list";

export default function ProjectsPage() {
  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "프로젝트" }]} />
      <PageHeader
        title="프로젝트"
        description="워크스페이스 내 모든 프로젝트를 관리하세요."
      />
      <ProjectList />
    </AppShell>
  );
}
