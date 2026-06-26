import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { PageHeader } from "@/components/common/page-header";
import { AccountSettings } from "@/features/account/account-settings";

export default function AccountSettingsPage() {
  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "계정 설정" }]} />
      <PageHeader
        title="계정 설정"
        description="로그인 계정 정보와 계정 탈퇴를 관리합니다."
      />
      <AccountSettings />
    </AppShell>
  );
}
