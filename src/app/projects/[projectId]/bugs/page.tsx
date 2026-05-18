import { AppShell } from "@/components/layout/app-shell";
import { ProjectHeader } from "@/components/layout/project-header";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { PageHeader } from "@/components/common/page-header";
import { DefectManager } from "@/features/defects/defect-manager";

export default function BugsPage() {
  return (
    <AppShell>
      <Breadcrumbs
        items={[
          { label: "프로젝트", href: "/projects" },
          { label: "결제 시스템 v2" },
          { label: "결함" },
        ]}
      />
      <ProjectHeader activeTab="bugs" />
      <PageHeader
        title="결함"
        description="결함을 등록하고 상태, 심각도, 우선순위, 연관 테스트케이스를 관리합니다."
      />
      <DefectManager />
    </AppShell>
  );
}
