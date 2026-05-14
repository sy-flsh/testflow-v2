import { Bug } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectHeader } from "@/components/layout/project-header";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";

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
        description="Jira 스타일 결함 테이블과 Defect Drawer가 들어갈 화면입니다."
        actions={
          <button className="h-9 rounded-md bg-[var(--brand-primary)] px-3 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)]">
            새 결함 등록
          </button>
        }
      />
      <section className="tf-card mb-6 grid gap-3 p-4 md:grid-cols-4">
        <StatusBadge status="open" label="Open 0" />
        <StatusBadge status="in_progress" label="In Progress 0" />
        <StatusBadge status="resolved" label="Resolved 0" />
        <StatusBadge status="closed" label="Closed 0" />
      </section>
      <EmptyState
        icon={Bug}
        title="결함 관리 구현 예정"
        description="failed/blocked Result에서 생성된 Defect 연결과 상태 관리는 후속 작업에서 구현합니다."
      />
    </AppShell>
  );
}
