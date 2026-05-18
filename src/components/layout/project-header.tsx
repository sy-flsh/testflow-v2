import { ProjectTabs } from "@/components/layout/project-tabs";
import { getProjectDescription, getProjectName } from "@/lib/project-context";

export function ProjectHeader({
  projectId,
  activeTab,
}: {
  projectId: string;
  activeTab: "testcases" | "runs" | "bugs" | "reports";
}) {
  const projectName = getProjectName(projectId);
  const projectDescription = getProjectDescription(projectId);

  return (
    <section className="mb-6 border-b border-[var(--border-default)] pb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand-primary)]" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {projectName}
            </h2>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            {projectDescription}
          </p>
        </div>
        <span className="w-fit rounded-md border border-[var(--border-default)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
          {projectId}
        </span>
      </div>
      <ProjectTabs projectId={projectId} activeTab={activeTab} />
    </section>
  );
}
