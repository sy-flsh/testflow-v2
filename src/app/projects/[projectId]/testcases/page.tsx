import { FileText } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectHeader } from "@/components/layout/project-header";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PriorityBadge } from "@/components/common/priority-badge";

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
        actions={
          <>
            <button className="h-9 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]">
              CSV 가져오기
            </button>
            <button className="h-9 rounded-md bg-[var(--brand-primary)] px-3 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)]">
              새 테스트케이스
            </button>
          </>
        }
      />
      <section className="tf-card mb-6 p-4">
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <PriorityBadge priority="high" label="High" />
          <span>우선순위 Badge와 테이블 스타일을 위한 placeholder입니다.</span>
        </div>
      </section>
      <EmptyState
        icon={FileText}
        title="테스트케이스 관리 구현 예정"
        description="Folder Tree, TC Table, Quick Edit, Bulk Edit, CSV Import는 다음 단계에서 실제 데이터와 연결합니다."
      />
    </AppShell>
  );
}
