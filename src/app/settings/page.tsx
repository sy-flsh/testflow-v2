import { Settings } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";

export default function SettingsPage() {
  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "워크스페이스 설정" }]} />
      <PageHeader
        title="워크스페이스 설정"
        description="일반 정보, 멤버, 역할 및 권한, 위험구역 화면을 준비합니다."
      />
      <EmptyState
        icon={Settings}
        title="설정 화면 구현 예정"
        description="v0.1에서는 일반 정보와 멤버/역할 보기 중심으로 구현합니다."
      />
    </AppShell>
  );
}
