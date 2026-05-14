import { BarChart3 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";

export default function DashboardPage() {
  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "대시보드" }]} />
      <PageHeader
        title="대시보드"
        description="워크스페이스 전체 테스트 활동 요약을 확인합니다."
      />
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        {[
          ["전체 프로젝트", "0"],
          ["진행 중 테스트", "0"],
          ["이번 주 실행", "0"],
          ["발견된 결함", "0"],
        ].map(([label, value]) => (
          <section key={label} className="tf-card p-5">
            <p className="text-sm text-[var(--text-secondary)]">{label}</p>
            <p className="mt-3 text-2xl font-semibold">{value}</p>
          </section>
        ))}
      </div>
      <section className="tf-card mb-6 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">최근 7일 테스트 실행 결과</h2>
          <StatusBadge status="pending" label="준비 중" />
        </div>
        <EmptyState
          icon={BarChart3}
          title="아직 표시할 실행 결과가 없습니다"
          description="Test Run과 Result 저장 기능이 연결되면 이 영역에 Pass, Fail, Block, Skip 추이가 표시됩니다."
        />
      </section>
    </AppShell>
  );
}
