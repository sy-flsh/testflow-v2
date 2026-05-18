import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { PageHeader } from "@/components/common/page-header";
import { WorkspaceSettings } from "@/features/settings/workspace-settings";

export default function SettingsPage() {
  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "워크스페이스 설정" }]} />
      <PageHeader
        title="워크스페이스 설정"
        description="워크스페이스 기본 정보, 멤버, 역할 정책, 위험 작업을 관리합니다."
      />
      <WorkspaceSettings />
    </AppShell>
  );
}
