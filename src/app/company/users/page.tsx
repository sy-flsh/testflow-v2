import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { PageHeader } from "@/components/common/page-header";
import { CompanyUserList } from "@/features/company/company-user-list";

export default function CompanyUsersPage() {
  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "회사 관리" }, { label: "회원 관리" }]} />
      <PageHeader
        title="회원 관리"
        description="회사 사용자와 Scope별 권한(Role)을 확인합니다. (CO 전용)"
      />
      <CompanyUserList />
    </AppShell>
  );
}
