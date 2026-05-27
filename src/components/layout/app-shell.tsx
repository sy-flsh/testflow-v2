import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopHeader } from "@/components/layout/top-header";
import { AuthProvider } from "@/features/auth/auth-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-[var(--bg-subtle)]">
        <TopHeader />
        <AppSidebar />
        <main className="tf-main">
          <div className="tf-main-inner mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </AuthProvider>
  );
}
