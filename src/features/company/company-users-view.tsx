"use client";

import { useCallback, useState } from "react";
import { UserPlus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  normalizeInvitationPage,
  normalizeInvitationSize,
  normalizeInvitationSort,
  normalizeInvitationStatus,
} from "@/lib/company/invitation-filters";
import { cn } from "@/lib/utils";
import {
  CompanyInvitationList,
  type InvitationParamPatch,
  type InvitationParams,
} from "./company-invitation-list";
import { CompanyUserList } from "./company-user-list";
import { InviteCreateModal } from "./invite-create-modal";

type Tab = "users" | "invitations";

// URL 기본값(생략 시) — 이 값으로 설정하면 URL 에서 제거해 깔끔하게 유지한다.
const PARAM_DEFAULTS: Record<string, string | number> = {
  status: "ALL",
  sort: "newest",
  size: 20,
  page: 1,
};

/**
 * c8-5: /company/users 의 URL 상태 정본 오케스트레이터.
 * tab/q/status/page/size/sort/modal 을 URL query 로 관리(뒤로/앞으로/새로고침 복원).
 */
export function CompanyUsersView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 생성/취소/재발송 후 동일 조건이라도 목록을 강제 재조회하기 위한 nonce.
  const [refreshNonce, setRefreshNonce] = useState(0);

  const tab: Tab = searchParams.get("tab") === "invitations" ? "invitations" : "users";
  const modalOpen = searchParams.get("modal") === "invite";

  const params: InvitationParams = {
    q: (searchParams.get("q") ?? "").trim(),
    status: normalizeInvitationStatus(searchParams.get("status")),
    page: normalizeInvitationPage(searchParams.get("page")),
    size: normalizeInvitationSize(searchParams.get("size")),
    sort: normalizeInvitationSort(searchParams.get("sort")),
  };

  const updateUrl = useCallback(
    (patch: InvitationParamPatch, opts?: { replace?: boolean }) => {
      const next = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(patch)) {
        // 기본값/빈 값은 URL 에서 제거.
        const isDefault =
          value === null ||
          value === undefined ||
          value === "" ||
          PARAM_DEFAULTS[key] === value;

        if (isDefault) {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }

      const query = next.toString();
      const href = query ? `${pathname}?${query}` : pathname;

      if (opts?.replace) {
        router.replace(href, { scroll: false });
      } else {
        router.push(href, { scroll: false });
      }
    },
    [searchParams, pathname, router],
  );

  function handleModalClose(created: boolean) {
    if (created) {
      // 성공 후 닫기: 초대 관리 탭 + page=1, modal 제거. q/status/sort/size 는 유지.
      updateUrl({ modal: null, tab: "invitations", page: null });
      setRefreshNonce((n) => n + 1);
    } else {
      updateUrl({ modal: null });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between border-b border-[var(--border-subtle)]">
        <div className="flex gap-1">
          <TabButton active={tab === "users"} onClick={() => updateUrl({ tab: null })}>
            사용자
          </TabButton>
          <TabButton
            active={tab === "invitations"}
            onClick={() => updateUrl({ tab: "invitations" })}
          >
            초대 관리
          </TabButton>
        </div>
        <button
          type="button"
          onClick={() => updateUrl({ modal: "invite" })}
          className="mb-2 inline-flex h-9 items-center gap-2 rounded-md bg-[var(--brand-primary)] px-3 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)]"
        >
          <UserPlus className="h-4 w-4" />
          사용자 초대
        </button>
      </div>

      {tab === "users" ? (
        <CompanyUserList />
      ) : (
        <CompanyInvitationList
          params={params}
          refreshNonce={refreshNonce}
          onParamsChange={updateUrl}
        />
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
