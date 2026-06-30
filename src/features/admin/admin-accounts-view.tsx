"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AdminActiveAccountsView } from "@/features/admin/admin-active-accounts-view";
import { AdminDeletedAccountsView } from "@/features/admin/admin-deleted-accounts-view";
import { cn } from "@/lib/utils";

/**
 * c10-6: `/admin/accounts` 탭(탈퇴 계정 / 활성 계정). AdminReauthGate 안에서 렌더된다.
 * - URL key `adminAccountTab`(active 만 기록, 기본 deleted 는 생략). 각 탭 filter 는 별도 prefix(adminDeleted / adminActive).
 */
export function AdminAccountsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("adminAccountTab") === "active" ? "active" : "deleted";

  function setTab(next: "deleted" | "active") {
    if (next === tab) return;
    const params = new URLSearchParams(searchParams.toString());
    if (next === "deleted") params.delete("adminAccountTab");
    else params.set("adminAccountTab", "active");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-[var(--border-subtle)]">
        <TabButton active={tab === "deleted"} onClick={() => setTab("deleted")}>
          탈퇴 계정
        </TabButton>
        <TabButton active={tab === "active"} onClick={() => setTab("active")}>
          활성 계정
        </TabButton>
      </div>

      {tab === "deleted" ? <AdminDeletedAccountsView /> : <AdminActiveAccountsView />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-[var(--brand-primary)] text-[var(--brand-primary)]"
          : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
      )}
    >
      {children}
    </button>
  );
}
