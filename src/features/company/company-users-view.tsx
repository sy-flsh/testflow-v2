"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { CompanyInvitationList } from "./company-invitation-list";
import { CompanyUserList } from "./company-user-list";
import { InviteCreateModal } from "./invite-create-modal";

type Tab = "users" | "invitations";

export function CompanyUsersView() {
  const [tab, setTab] = useState<Tab>("users");
  const [modalOpen, setModalOpen] = useState(false);
  const [invitationsRefreshKey, setInvitationsRefreshKey] = useState(0);

  function handleModalClose(created: boolean) {
    setModalOpen(false);

    if (created) {
      // 생성 성공 시 초대 목록 최신화(현재 탭 흐름은 유지).
      setInvitationsRefreshKey((key) => key + 1);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between border-b border-[var(--border-subtle)]">
        <div className="flex gap-1">
          <TabButton active={tab === "users"} onClick={() => setTab("users")}>
            사용자
          </TabButton>
          <TabButton active={tab === "invitations"} onClick={() => setTab("invitations")}>
            초대 관리
          </TabButton>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="mb-2 inline-flex h-9 items-center gap-2 rounded-md bg-[var(--brand-primary)] px-3 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)]"
        >
          <UserPlus className="h-4 w-4" />
          사용자 초대
        </button>
      </div>

      {tab === "users" ? (
        <CompanyUserList />
      ) : (
        <CompanyInvitationList refreshKey={invitationsRefreshKey} />
      )}

      {modalOpen && <InviteCreateModal onClose={handleModalClose} />}
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
