"use client";

import { useMemo, useRef, useState } from "react";
import { CheckCircle2, Copy } from "lucide-react";
import { DrawerShell } from "@/components/common/drawer-shell";
import type { CompanyInvitationDto } from "@/lib/company/types";
import { rolesToSummaryTokens } from "./role-matrix-utils";

export type InviteSuccessData = { invitation: CompanyInvitationDto; inviteUrl: string };

/**
 * c8-3/c8-4 공용: 초대 생성/재발송 성공 시 새 inviteUrl 을 1회 표시 + 복사하는 패널.
 * raw inviteUrl 은 부모 state 에만 잠시 보관하며 storage/전역 state 에 저장하지 않는다.
 */
export function InviteSuccess({ data }: { data: InviteSuccessData }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const absoluteUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return data.inviteUrl;
    }
    return `${window.location.origin}${data.inviteUrl}`;
  }, [data.inviteUrl]);

  const tokens = rolesToSummaryTokens(data.invitation.roles);

  async function copy() {
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
    } catch {
      // Clipboard API 실패 시 사용자가 직접 복사할 수 있도록 input 선택.
      inputRef.current?.select();
    }
  }

  return (
    <div className="space-y-5 px-6 py-5">
      <div className="flex items-center gap-2 text-sm text-emerald-600">
        <CheckCircle2 className="h-5 w-5" /> 초대 링크가 생성되었습니다.
      </div>

      <dl className="grid grid-cols-[88px_1fr] gap-y-2 text-sm">
        <dt className="text-[var(--text-tertiary)]">이메일</dt>
        <dd className="text-[var(--text-secondary)]">{data.invitation.email}</dd>
        <dt className="text-[var(--text-tertiary)]">권한</dt>
        <dd className="flex flex-wrap gap-1">
          {tokens.map((t, i) => (
            <span
              key={`${t}-${i}`}
              className="inline-flex h-6 items-center rounded-full bg-[var(--bg-muted)] px-2.5 text-xs font-medium text-[var(--text-secondary)] ring-1 ring-inset ring-[var(--border-default)]"
            >
              {t}
            </span>
          ))}
        </dd>
        <dt className="text-[var(--text-tertiary)]">만료</dt>
        <dd className="text-[var(--text-secondary)]">
          {new Date(data.invitation.expiresAt).toLocaleString("ko-KR")}
        </dd>
      </dl>

      <div className="space-y-2">
        <p className="text-sm font-medium text-[var(--text-primary)]">초대 링크</p>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            readOnly
            value={absoluteUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="h-9 flex-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 text-xs text-[var(--text-secondary)] outline-none"
          />
          <button
            type="button"
            onClick={copy}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-white px-3 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? "복사됨" : "링크 복사"}
          </button>
        </div>
        <p className="text-xs text-[var(--danger-text)]">
          이 링크는 지금만 다시 확인할 수 있습니다. 닫기 전에 복사해 두세요.
        </p>
      </div>
    </div>
  );
}

/** DrawerShell 로 감싼 성공 패널 + [닫기] 버튼 (재발송 성공 표시에 사용). */
export function InviteSuccessDrawer({
  title,
  data,
  onClose,
}: {
  title: string;
  data: InviteSuccessData;
  onClose: () => void;
}) {
  return (
    <DrawerShell title={title} description={data.invitation.email} onClose={onClose}>
      <InviteSuccess data={data} />
      <div className="px-6 pb-6">
        <button
          type="button"
          onClick={onClose}
          className="h-9 w-full rounded-md bg-[var(--brand-primary)] text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)]"
        >
          닫기
        </button>
      </div>
    </DrawerShell>
  );
}
