import { BarChart3 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectHeader } from "@/components/layout/project-header";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";

export default function ReportsPage() {
  return (
    <AppShell>
      <Breadcrumbs
        items={[
          { label: "프로젝트", href: "/projects" },
          { label: "결제 시스템 v2" },
          { label: "보고서" },
        ]}
      />
      <ProjectHeader activeTab="reports" />
      <PageHeader
        title="보고서"
        description="KPI, 기본 차트, Top Failed TC가 들어갈 화면입니다."
      />
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        {[
          ["총 실행", "0"],
          ["Pass 비율", "0%"],
          ["발견 결함", "0"],
          ["평균 실행 시간", "-"],
        ].map(([label, value]) => (
          <section key={label} className="tf-card p-5">
            <p className="text-sm text-[var(--text-secondary)]">{label}</p>
            <p className="mt-3 text-2xl font-semibold">{value}</p>
          </section>
        ))}
      </div>
      <EmptyState
        icon={BarChart3}
        title="보고서 구현 예정"
        description="TestRunResult와 Defect가 저장되면 KPI, 차트, Top Failed TC를 표시합니다."
      />
    </AppShell>
  );
}
