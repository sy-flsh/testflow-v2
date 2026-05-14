import { FolderKanban } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";

export default function ProjectsPage() {
  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "프로젝트" }]} />
      <PageHeader
        title="프로젝트"
        description="워크스페이스 내 프로젝트 목록과 생성 흐름이 들어갈 화면입니다."
        actions={
          <button className="h-9 rounded-md bg-[var(--brand-primary)] px-3 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)]">
            새 프로젝트
          </button>
        }
      />
      <EmptyState
        icon={FolderKanban}
        title="프로젝트 기능 구현 예정"
        description="프로젝트 목록, 검색, 생성 모달은 후속 작업에서 실제 데이터와 연결합니다."
      />
    </AppShell>
  );
}
