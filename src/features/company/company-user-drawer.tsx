"use client";

import { useEffect, useMemo, useState } from "react";
import type { Role } from "@prisma/client";
import { CheckCircle2 } from "lucide-react";
import { DrawerShell } from "@/components/common/drawer-shell";
import type { CompanyUserDetailDto, CompanyUserRoleEntry } from "@/lib/company/types";
import { cn } from "@/lib/utils";
import {
  PROJECT_ROLE_OPTIONS,
  WORKSPACE_ROLE_OPTIONS,
  mapToRoles,
  rolesEqual,
  rolesToMap,
  rolesToSummaryTokens,
  scopeKey,
  syncErrorMessage,
} from "./role-matrix-utils";

type DetailState =
  | { kind: "loading" }
  | { kind: "forbidden" }
  | { kind: "notfound" }
  | { kind: "error"; message: string }
  | { kind: "ready"; detail: CompanyUserDetailDto };

type DrawerTab = "profile" | "roles";

export function CompanyUserDrawer({
  userId,
  onClose,
  onSaved,
}: {
  userId: string;
  onClose: () => void;
  /** 저장 성공 시 목록 행의 Role 요약을 갱신하기 위한 콜백. */
  onSaved: (userId: string, tokens: string[]) => void;
}) {
  const [state, setState] = useState<DetailState>({ kind: "loading" });
  const [tab, setTab] = useState<DrawerTab>("profile");

  // Role Matrix dirty state: original = 서버 기준값, draft = 편집중 값.
  const [original, setOriginal] = useState<Map<string, Role>>(new Map());
  const [draft, setDraft] = useState<Map<string, Role>>(new Map());

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    setTab("profile");
    setSaveError(null);
    setSaveOk(false);

    async function load() {
      try {
        const response = await fetch(`/api/company/users/${userId}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | { data?: CompanyUserDetailDto; error?: { message?: string } }
          | null;

        if (!active) {
          return;
        }

        if (response.status === 403) {
          setState({ kind: "forbidden" });
          return;
        }

        if (response.status === 404) {
          setState({ kind: "notfound" });
          return;
        }

        if (!response.ok || !payload?.data) {
          setState({
            kind: "error",
            message: payload?.error?.message ?? "회원 상세를 불러오지 못했습니다.",
          });
          return;
        }

        const map = rolesToMap(payload.data.roles);
        setOriginal(map);
        setDraft(new Map(map));
        setState({ kind: "ready", detail: payload.data });
      } catch {
        if (active) {
          setState({ kind: "error", message: "회원 상세를 불러오지 못했습니다." });
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [userId]);

  const dirty = useMemo(() => !rolesEqual(original, draft), [original, draft]);

  function setScopeRole(
    scopeType: CompanyUserRoleEntry["scopeType"],
    scopeId: string,
    role: Role | "NONE",
  ) {
    setSaveOk(false);
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

  async function handleSave() {
    if (state.kind !== "ready") {
      return;
    }

    const allowedScopeIds = new Set<string>([state.detail.company.id]);
    for (const workspace of state.detail.workspaces) {
      allowedScopeIds.add(workspace.id);
      for (const project of workspace.projects) {
        allowedScopeIds.add(project.id);
      }
    }

    setSaving(true);
    setSaveError(null);
    setSaveOk(false);

    try {
      const response = await fetch(`/api/company/users/${userId}/roles/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: mapToRoles(draft) }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { data?: { roles: CompanyUserRoleEntry[] }; error?: { message?: string; code?: string } }
        | null;

      if (!response.ok || !payload?.data) {
        // 저장 실패: local state 유지, 서버 code/message 매핑 표시.
        setSaveError(syncErrorMessage(payload?.error?.code, payload?.error?.message));
        return;
      }

      // 성공: 현재 Company 범위 Role 만 추려 원본/draft 갱신 + 목록 요약 갱신.
      const companyRoles = payload.data.roles.filter((entry) =>
        allowedScopeIds.has(entry.scopeId),
      );
      const newMap = rolesToMap(companyRoles);
      setOriginal(newMap);
      setDraft(new Map(newMap));
      setSaveOk(true);
      onSaved(userId, rolesToSummaryTokens(companyRoles));
    } catch {
      setSaveError("권한 저장에 실패했습니다. 네트워크 상태를 확인해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  const title = state.kind === "ready" ? state.detail.name : "회원 상세";
  const description =
    state.kind === "ready" ? state.detail.email : "사용자 정보를 불러오는 중입니다.";

  return (
    <DrawerShell
      title={title}
      description={description}
      onClose={onClose}
      footer={
        state.kind === "ready" ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-h-[1.25rem] text-sm">
              {saveError ? (
                <span className="text-[var(--danger-text)]">{saveError}</span>
              ) : saveOk ? (
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" /> 권한을 저장했습니다.
                </span>
              ) : dirty ? (
                <span className="text-[var(--text-tertiary)]">저장하지 않은 변경이 있습니다.</span>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-9 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!dirty || saving}
                className="h-9 rounded-md bg-[var(--brand-primary)] px-4 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "저장 중…" : "저장"}
              </button>
            </div>
          </div>
        ) : undefined
      }
    >
      {state.kind === "loading" && (
        <div className="px-6 py-12 text-center text-sm text-[var(--text-secondary)]">
          회원 상세를 불러오는 중입니다.
        </div>
      )}

      {state.kind === "forbidden" && (
        <div className="px-6 py-12 text-center text-sm text-[var(--text-secondary)]">
          CO 권한이 필요합니다. 회원 권한 관리는 Company 소유자(CO)만 사용할 수 있습니다.
        </div>
      )}

      {state.kind === "notfound" && (
        <div className="px-6 py-12 text-center text-sm text-[var(--text-secondary)]">
          이 회사에서 해당 사용자를 찾을 수 없습니다.
        </div>
      )}

      {state.kind === "error" && (
        <div className="px-6 py-12 text-center text-sm text-[var(--danger-text)]">
          {state.message}
        </div>
      )}

      {state.kind === "ready" && (
        <div className="flex flex-col">
          <div className="flex gap-1 border-b border-[var(--border-subtle)] px-6 pt-3">
            <TabButton active={tab === "profile"} onClick={() => setTab("profile")}>
              프로필
            </TabButton>
            <TabButton active={tab === "roles"} onClick={() => setTab("roles")}>
              권한 관리
            </TabButton>
          </div>

          {tab === "profile" ? (
            <ProfileTab detail={state.detail} draft={draft} />
          ) : (
            <RolesTab detail={state.detail} draft={draft} onChange={setScopeRole} />
          )}
        </div>
      )}
    </DrawerShell>
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

function ProfileTab({
  detail,
  draft,
}: {
  detail: CompanyUserDetailDto;
  draft: Map<string, Role>;
}) {
  const tokens = useMemo(() => {
    const entries: CompanyUserRoleEntry[] = [];
    for (const [key, role] of draft) {
      const [scopeType, scopeId] = key.split(/:(.+)/) as [
        CompanyUserRoleEntry["scopeType"],
        string,
      ];
      entries.push({ scopeType, scopeId, role });
    }
    return rolesToSummaryTokens(entries);
  }, [draft]);

  return (
    <div className="space-y-6 px-6 py-5">
      <section>
        <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">기본 정보</h3>
        <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
          <dt className="text-[var(--text-tertiary)]">이름</dt>
          <dd className="text-[var(--text-primary)]">{detail.name}</dd>
          <dt className="text-[var(--text-tertiary)]">이메일</dt>
          <dd className="text-[var(--text-secondary)]">{detail.email}</dd>
          <dt className="text-[var(--text-tertiary)]">상태</dt>
          <dd>
            <span
              className={cn(
                "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ring-inset",
                detail.status === "ACTIVE"
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : "bg-amber-50 text-amber-700 ring-amber-200",
              )}
            >
              {detail.status === "ACTIVE" ? "활성" : "대기"}
            </span>
          </dd>
          <dt className="text-[var(--text-tertiary)]">회사</dt>
          <dd className="text-[var(--text-secondary)]">{detail.company.name}</dd>
        </dl>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Role 요약</h3>
        {tokens.length === 0 ? (
          <p className="text-xs text-[var(--text-tertiary)]">부여된 권한이 없습니다.</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {tokens.map((token, index) => (
              <span
                key={`${token}-${index}`}
                className="inline-flex h-6 items-center rounded-full bg-[var(--bg-muted)] px-2.5 text-xs font-medium text-[var(--text-secondary)] ring-1 ring-inset ring-[var(--border-default)]"
              >
                {token}
              </span>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-[var(--text-tertiary)]">
          권한 변경은 “권한 관리” 탭에서 합니다. (이름은 본인만 수정 가능)
        </p>
      </section>
    </div>
  );
}

function RolesTab({
  detail,
  draft,
  onChange,
}: {
  detail: CompanyUserDetailDto;
  draft: Map<string, Role>;
  onChange: (
    scopeType: CompanyUserRoleEntry["scopeType"],
    scopeId: string,
    role: Role | "NONE",
  ) => void;
}) {
  const companyRole = draft.get(scopeKey("COMPANY", detail.company.id)) ?? null;

  return (
    <div className="space-y-6 px-6 py-5">
      {/* Company Role */}
      <section>
        <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Company 권한</h3>
        <div className="flex items-center justify-between rounded-md border border-[var(--border-default)] px-4 py-3">
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">{detail.company.name}</p>
            <p className="text-xs text-[var(--text-tertiary)]">
              현재: {companyRole === "CO" ? "CO (회사 전체 관리)" : "권한 없음"}
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={companyRole === "CO"}
              onChange={(event) =>
                onChange("COMPANY", detail.company.id, event.target.checked ? "CO" : "NONE")
              }
              className="h-4 w-4 accent-[var(--brand-primary)]"
            />
            <span className="font-medium text-[var(--text-secondary)]">CO 부여</span>
          </label>
        </div>
        <p className="mt-1.5 text-xs text-[var(--text-tertiary)]">
          마지막 CO 또는 본인 CO 회수는 저장 시 서버가 차단합니다.
        </p>
      </section>

      {/* Workspace / Project Role Matrix */}
      <section>
        <h3 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">
          Workspace · Project 권한
        </h3>
        <p className="mb-3 text-xs text-[var(--text-tertiary)]">
          Workspace와 Project 권한은 함께 가질 수 있으며, Project 권한은 Workspace 권한보다 우선
          적용됩니다.
        </p>

        {detail.workspaces.length === 0 ? (
          <p className="rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-tertiary)]">
            이 회사에 Workspace가 없습니다.
          </p>
        ) : (
          <div className="space-y-4">
            {detail.workspaces.map((workspace) => {
              const wsRole = draft.get(scopeKey("WORKSPACE", workspace.id)) ?? "NONE";

              return (
                <div
                  key={workspace.id}
                  className="rounded-md border border-[var(--border-default)]"
                >
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
                      <p className="px-4 py-3 text-xs text-[var(--text-tertiary)]">
                        Project가 없습니다.
                      </p>
                    ) : (
                      workspace.projects.map((project) => {
                        const projRole =
                          draft.get(scopeKey("PROJECT", project.id)) ?? "NONE";

                        return (
                          <div
                            key={project.id}
                            className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 pl-6"
                          >
                            <span className="text-sm text-[var(--text-secondary)]">
                              {project.name}
                            </span>
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
