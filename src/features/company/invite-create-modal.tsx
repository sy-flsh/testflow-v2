"use client";

import { useEffect, useRef, useState } from "react";
import type { Role } from "@prisma/client";
import { DrawerShell } from "@/components/common/drawer-shell";
import type {
  CompanyInvitationDto,
  CompanyScopeTreeDto,
} from "@/lib/company/types";
import { cn } from "@/lib/utils";
import { InviteSuccess } from "./invite-success";
import {
  PROJECT_ROLE_OPTIONS,
  WORKSPACE_ROLE_OPTIONS,
  inviteErrorMessage,
  mapToRoles,
  scopeKey,
} from "./role-matrix-utils";

type TreeState =
  | { kind: "loading" }
  | { kind: "forbidden" }
  | { kind: "error"; message: string }
  | { kind: "ready"; tree: CompanyScopeTreeDto };

type SuccessData = { invitation: CompanyInvitationDto; inviteUrl: string };

export function InviteCreateModal({
  onClose,
}: {
  /** created=true 면 부모가 초대 목록을 새로고침한다. */
  onClose: (created: boolean) => void;
}) {
  const [tree, setTree] = useState<TreeState>({ kind: "loading" });
  const [email, setEmail] = useState("");
  const [draft, setDraft] = useState<Map<string, Role>>(new Map());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessData | null>(null);

  // created 여부(성공 후 닫을 때 부모 새로고침 트리거).
  const createdRef = useRef(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/company/scopes", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as
          | { data?: CompanyScopeTreeDto; error?: { message?: string } }
          | null;

        if (!active) {
          return;
        }

        if (response.status === 403) {
          setTree({ kind: "forbidden" });
          return;
        }

        if (!response.ok || !payload?.data) {
          setTree({
            kind: "error",
            message: payload?.error?.message ?? "Company scope 를 불러오지 못했습니다.",
          });
          return;
        }

        setTree({ kind: "ready", tree: payload.data });
      } catch {
        if (active) {
          setTree({ kind: "error", message: "Company scope 를 불러오지 못했습니다." });
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  function setScopeRole(
    scopeType: "COMPANY" | "WORKSPACE" | "PROJECT",
    scopeId: string,
    role: Role | "NONE",
  ) {
    setCreateError(null);
    setDraft((prev) => {
      const next = new Map(prev);
      const key = scopeKey(scopeType, scopeId);

      if (role === "NONE") {
        next.delete(key);
      } else {
        next.set(key, role);
      }

      return next;
    });
  }

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = emailValid && draft.size > 0 && !creating;

  async function handleCreate() {
    if (!canSubmit) {
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const response = await fetch("/api/company/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), roles: mapToRoles(draft) }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { data?: SuccessData; error?: { message?: string; code?: string } }
        | null;

      if (!response.ok || !payload?.data) {
        // 실패: 작성 중인 email/draft 유지.
        setCreateError(inviteErrorMessage(payload?.error?.code, payload?.error?.message));
        return;
      }

      createdRef.current = true;
      setSuccess(payload.data);
    } catch {
      setCreateError("초대 생성에 실패했습니다. 네트워크 상태를 확인해 주세요.");
    } finally {
      setCreating(false);
    }
  }

  function handleClose() {
    // raw inviteUrl 을 state 에서 제거하고 닫는다.
    setSuccess(null);
    onClose(createdRef.current);
  }

  if (success) {
    return (
      <DrawerShell title="초대 생성 완료" description={success.invitation.email} onClose={handleClose}>
        <InviteSuccess data={success} />
        <div className="px-6 pb-6">
          <button
            type="button"
            onClick={handleClose}
            className="h-9 w-full rounded-md bg-[var(--brand-primary)] text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)]"
          >
            닫기
          </button>
        </div>
      </DrawerShell>
    );
  }

  return (
    <DrawerShell
      title="사용자 초대"
      description="이메일과 부여할 권한을 선택해 초대 링크를 생성합니다."
      onClose={handleClose}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="h-9 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canSubmit}
            className="h-9 rounded-md bg-[var(--brand-primary)] px-4 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? "생성 중…" : "초대 생성"}
          </button>
        </div>
      }
    >
      <div className="space-y-6 px-6 py-5">
        <section>
          <label className="block text-sm font-medium text-[var(--text-primary)]">
            초대 이메일
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setCreateError(null);
              }}
              placeholder="invitee@example.com"
              className="mt-2 h-10 w-full rounded-md border border-[var(--border-default)] px-3 outline-none focus:border-[var(--brand-primary)]"
            />
          </label>
          <p className="mt-1.5 text-xs text-[var(--text-tertiary)]">
            공백은 자동 제거되며 소문자로 정규화됩니다.
          </p>
        </section>

        {createError && (
          <div className="rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger-text)]">
            {createError}
          </div>
        )}

        {tree.kind === "loading" && (
          <p className="text-sm text-[var(--text-secondary)]">권한 대상을 불러오는 중입니다…</p>
        )}
        {tree.kind === "forbidden" && (
          <p className="text-sm text-[var(--text-secondary)]">CO 권한이 필요합니다.</p>
        )}
        {tree.kind === "error" && (
          <p className="text-sm text-[var(--danger-text)]">{tree.message}</p>
        )}

        {tree.kind === "ready" && (
          <RoleMatrix tree={tree.tree} draft={draft} onChange={setScopeRole} />
        )}
      </div>
    </DrawerShell>
  );
}

function RoleMatrix({
  tree,
  draft,
  onChange,
}: {
  tree: CompanyScopeTreeDto;
  draft: Map<string, Role>;
  onChange: (
    scopeType: "COMPANY" | "WORKSPACE" | "PROJECT",
    scopeId: string,
    role: Role | "NONE",
  ) => void;
}) {
  const companyRole = draft.get(scopeKey("COMPANY", tree.company.id)) ?? null;

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Company 권한</h3>
        <div className="flex items-center justify-between rounded-md border border-[var(--border-default)] px-4 py-3">
          <span className="text-sm font-medium text-[var(--text-primary)]">{tree.company.name}</span>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={companyRole === "CO"}
              onChange={(e) => onChange("COMPANY", tree.company.id, e.target.checked ? "CO" : "NONE")}
              className="h-4 w-4 accent-[var(--brand-primary)]"
            />
            <span className="font-medium text-[var(--text-secondary)]">CO 부여</span>
          </label>
        </div>
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">
          Workspace · Project 권한
        </h3>
        <p className="mb-3 text-xs text-[var(--text-tertiary)]">
          선택하지 않은 행은 초대에서 제외됩니다. Project 권한은 Workspace 권한보다 우선 적용됩니다.
        </p>

        {tree.workspaces.length === 0 ? (
          <p className="rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-tertiary)]">
            이 회사에 Workspace가 없습니다.
          </p>
        ) : (
          <div className="space-y-4">
            {tree.workspaces.map((workspace) => {
              const wsRole = draft.get(scopeKey("WORKSPACE", workspace.id)) ?? "NONE";

              return (
                <div key={workspace.id} className="rounded-md border border-[var(--border-default)]">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-3">
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {workspace.name}
                    </span>
                    <RoleSegment
                      ariaLabel={`${workspace.name} Workspace 권한`}
                      value={wsRole}
                      options={WORKSPACE_ROLE_OPTIONS}
                      onChange={(role) => onChange("WORKSPACE", workspace.id, role)}
                    />
                  </div>

                  <div className="divide-y divide-[var(--border-subtle)]">
                    {workspace.projects.length === 0 ? (
                      <p className="px-4 py-3 text-xs text-[var(--text-tertiary)]">Project가 없습니다.</p>
                    ) : (
                      workspace.projects.map((project) => {
                        const projRole = draft.get(scopeKey("PROJECT", project.id)) ?? "NONE";

                        return (
                          <div
                            key={project.id}
                            className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 pl-6"
                          >
                            <span className="text-sm text-[var(--text-secondary)]">{project.name}</span>
                            <RoleSegment
                              ariaLabel={`${project.name} Project 권한`}
                              value={projRole}
                              options={PROJECT_ROLE_OPTIONS}
                              onChange={(role) => onChange("PROJECT", project.id, role)}
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function RoleSegment({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: Role | "NONE";
  options: Array<{ value: Role | "NONE"; label: string }>;
  onChange: (role: Role | "NONE") => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex rounded-md border border-[var(--border-default)] bg-white p-0.5"
    >
      {options.map((option) => {
        const active = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-7 rounded px-2.5 text-xs font-medium transition-colors",
              active
                ? "bg-[var(--brand-primary)] text-white"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
