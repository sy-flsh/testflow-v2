import { AppShellBody } from "@/components/layout/app-shell-body";
import { AuthProvider } from "@/features/auth/auth-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppShellBody>{children}</AppShellBody>
    </AuthProvider>
  );
}
