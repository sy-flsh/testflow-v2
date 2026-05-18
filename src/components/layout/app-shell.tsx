import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopHeader } from "@/components/layout/top-header";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg-subtle)]">
      <TopHeader />
      <AppSidebar />
      <main className="tf-main">
        <div className="tf-main-inner mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
