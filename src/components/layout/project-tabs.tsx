import Link from "next/link";
import { cn } from "@/lib/utils";

const tabs = [
  { value: "testcases", label: "테스트케이스" },
  { value: "runs", label: "테스트실행" },
  { value: "bugs", label: "결함" },
  { value: "reports", label: "보고서" },
] as const;

export function ProjectTabs({
  projectId,
  activeTab,
}: {
  projectId: string;
  activeTab: (typeof tabs)[number]["value"];
}) {
  return (
    <nav className="tf-project-tabs mt-5 flex items-center gap-1 overflow-x-auto">
      {tabs.map((tab) => (
        <Link
          key={tab.value}
          href={`/projects/${projectId}/${tab.value}`}
          className={cn(
            "tf-project-tab rounded-md px-3 py-2 text-sm font-medium transition-colors",
            activeTab === tab.value
              ? "tf-project-tab-active bg-[var(--brand-primary)] text-white"
              : "text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
