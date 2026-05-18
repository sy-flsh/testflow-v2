import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopHeader } from "@/components/layout/top-header";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg-subtle)]">
      <TopHeader />
      <AppSidebar />
      <main className="tf-main pl-60 pt-14">
        <div className="tf-main-inner mx-auto max-w-7xl px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
