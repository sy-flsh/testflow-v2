import { ProjectTabs } from "@/components/layout/project-tabs";

export function ProjectHeader({
  projectId = "demo-project",
  activeTab,
}: {
  projectId?: string;
  activeTab: "testcases" | "runs" | "bugs" | "reports";
}) {
  return (
    <section className="mb-6 border-b border-[var(--border-default)] pb-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand-primary)]" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              결제 시스템 v2
            </h2>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            테스트케이스, 실행 결과, 결함을 연결할 데모 프로젝트입니다.
          </p>
        </div>
        <span className="rounded-md border border-[var(--border-default)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
          {projectId}
        </span>
      </div>
      <ProjectTabs projectId={projectId} activeTab={activeTab} />
    </section>
  );
}
