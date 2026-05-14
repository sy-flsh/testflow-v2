import { Play } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectHeader } from "@/components/layout/project-header";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";

export default function TestRunDetailPage() {
  return (
    <AppShell>
      <Breadcrumbs
        items={[
          { label: "프로젝트", href: "/projects" },
          { label: "결제 시스템 v2" },
          { label: "테스트실행", href: "/projects/demo-project/runs" },
          { label: "실행 상세" },
        ]}
      />
      <ProjectHeader activeTab="runs" />
      <PageHeader
        title="테스트 실행 상세"
        description="Runner 화면 또는 Drawer 기반 실행 패널이 들어갈 화면입니다."
        actions={<StatusBadge status="pending" label="미실행" />}
      />
      <EmptyState
        icon={Play}
        title="Runner 화면 구현 예정"
        description="Pass, Fail, Block, Skip 상태 저장과 다음 TC 이동 UX를 후속 작업에서 연결합니다."
      />
    </AppShell>
  );
}
