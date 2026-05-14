import { Play } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectHeader } from "@/components/layout/project-header";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";

export default function TestRunsPage() {
  return (
    <AppShell>
      <Breadcrumbs
        items={[
          { label: "프로젝트", href: "/projects" },
          { label: "결제 시스템 v2" },
          { label: "테스트실행" },
        ]}
      />
      <ProjectHeader activeTab="runs" />
      <PageHeader
        title="테스트 실행"
        description="Test Run 목록과 실행 생성 흐름이 들어갈 화면입니다."
        actions={
          <button className="h-9 rounded-md bg-[var(--brand-primary)] px-3 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)]">
            새 테스트 실행
          </button>
        }
      />
      <section className="tf-card mb-6 p-4">
        <div className="flex items-center gap-2">
          <StatusBadge status="pending" label="예정" />
          <span className="text-sm text-[var(--text-secondary)]">
            Test Run 카드와 진행률이 들어갈 영역입니다.
          </span>
        </div>
      </section>
      <EmptyState
        icon={Play}
        title="테스트 실행 구현 예정"
        description="실행 대상 TC 선택, Result 자동 생성, Runner Drawer는 후속 작업에서 구현합니다."
      />
    </AppShell>
  );
}
