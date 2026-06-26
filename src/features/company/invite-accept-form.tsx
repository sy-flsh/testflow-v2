"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Role, ScopeType } from "@prisma/client";
import { summaryToken } from "./role-matrix-utils";

type RoleSnapshot = { scopeType: ScopeType; scopeId: string; role: Role };

type ValidateData = {
  invitationId: string;
  email: string;
  companyName: string;
  expiresAt: string;
  roles: RoleSnapshot[];
  existingUser: boolean;
};

type ValidateState =
  | { kind: "loading" }
  | { kind: "no-token" }
  | { kind: "error"; message: string }
  | { kind: "ok"; data: ValidateData };

export function InviteAcceptForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [state, setState] = useState<ValidateState>({ kind: "loading" });
  const [loggedInEmail, setLoggedInEmail] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      if (!token) {
        setState({ kind: "no-token" });
        return;
      }

      // 현재 로그인 사용자 email(있으면) 확인 — 기존/신규 분기 판단용.
      try {
        const meResponse = await fetch("/api/auth/me", { cache: "no-store" });
        const mePayload = (await meResponse.json().catch(() => null)) as
          | { data?: { user?: { email?: string } } }
          | null;
        if (active) {
          setLoggedInEmail(meResponse.ok ? mePayload?.data?.user?.email ?? null : null);
        }
      } catch {
        if (active) {
          setLoggedInEmail(null);
        }
      }

      try {
        const response = await fetch("/api/invitations/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const payload = (await response.json().catch(() => null)) as
          | { data?: ValidateData; error?: { message?: string; code?: string } }
          | null;

        if (!active) {
          return;
        }

        if (!response.ok || !payload?.data) {
          setState({
            kind: "error",
            message: mapInviteError(payload?.error?.code, payload?.error?.message),
          });
          return;
        }

        setState({ kind: "ok", data: payload.data });
      } catch {
        if (active) {
          setState({ kind: "error", message: "초대 검증에 실패했습니다. 잠시 후 다시 시도해 주세요." });
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [token]);

  const tokens = useMemo(
    () => (state.kind === "ok" ? state.data.roles.map((r) => summaryToken(r.scopeType, r.role)) : []),
    [state],
  );

  async function submitAccept(extra: { name?: string; password?: string }) {
    setSubmitting(true);
    setFormError("");

    try {
      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...extra }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { data?: { redirectTo?: string }; error?: { message?: string; code?: string } }
        | null;

      if (!response.ok || !payload?.data) {
        setFormError(mapInviteError(payload?.error?.code, payload?.error?.message));
        return;
      }

      router.push(payload.data.redirectTo ?? "/dashboard");
    } catch {
      setFormError("초대 수락에 실패했습니다. 네트워크 상태를 확인해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleNewUserSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (password.length < 8) {
      setFormError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }

    if (password !== passwordConfirm) {
      setFormError("비밀번호가 일치하지 않습니다.");
      return;
    }

    void submitAccept({ name, password });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg-subtle)] px-6 py-12">
      <div className="w-full max-w-md rounded-lg border border-[var(--border-default)] bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2 text-lg font-semibold text-[var(--text-primary)]">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--brand-primary)] text-sm text-white">
            TF
          </span>
          TestFlow 초대
        </div>

        {state.kind === "loading" && (
          <p className="text-sm text-[var(--text-secondary)]">초대를 확인하는 중입니다…</p>
        )}

        {state.kind === "no-token" && (
          <Notice>초대 토큰이 없습니다. 초대 메일의 링크로 다시 접속해 주세요.</Notice>
        )}

        {state.kind === "error" && <Notice>{state.message}</Notice>}

        {state.kind === "ok" && (
          <div className="space-y-5">
            <section className="space-y-2">
              <h1 className="text-xl font-semibold text-[var(--text-primary)]">
                {state.data.companyName}에 초대되었습니다
              </h1>
              <dl className="grid grid-cols-[88px_1fr] gap-y-1.5 text-sm">
                <dt className="text-[var(--text-tertiary)]">이메일</dt>
                <dd className="text-[var(--text-secondary)]">{state.data.email}</dd>
                <dt className="text-[var(--text-tertiary)]">부여 권한</dt>
                <dd className="flex flex-wrap gap-1">
                  {tokens.length === 0 ? (
                    <span className="text-[var(--text-tertiary)]">없음</span>
                  ) : (
                    tokens.map((t, i) => (
                      <span
                        key={`${t}-${i}`}
                        className="inline-flex h-6 items-center rounded-full bg-[var(--bg-muted)] px-2.5 text-xs font-medium text-[var(--text-secondary)] ring-1 ring-inset ring-[var(--border-default)]"
                      >
                        {t}
                      </span>
                    ))
                  )}
                </dd>
                <dt className="text-[var(--text-tertiary)]">만료</dt>
                <dd className="text-[var(--text-secondary)]">
                  {new Date(state.data.expiresAt).toLocaleString("ko-KR")}
                </dd>
              </dl>
            </section>

            {formError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            {/* 신규 사용자: 이름/비밀번호로 가입 + 수락 */}
            {!state.data.existingUser && (
              <form className="space-y-4" onSubmit={handleNewUserSubmit}>
                <Field label="이름">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className={inputClass}
                    placeholder="이름"
                  />
                </Field>
                <Field label="비밀번호 (8자 이상)">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className={inputClass}
                    placeholder="비밀번호"
                  />
                </Field>
                <Field label="비밀번호 확인">
                  <input
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    required
                    className={inputClass}
                    placeholder="비밀번호 확인"
                  />
                </Field>
                <button type="submit" disabled={submitting} className={primaryButtonClass}>
                  {submitting ? "처리 중…" : "초대 수락 및 가입"}
                </button>
              </form>
            )}

            {/* 기존 사용자 */}
            {state.data.existingUser && (
              <ExistingUserActions
                inviteEmail={state.data.email}
                loggedInEmail={loggedInEmail}
                token={token}
                submitting={submitting}
                onAccept={() => submitAccept({})}
              />
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function ExistingUserActions({
  inviteEmail,
  loggedInEmail,
  token,
  submitting,
  onAccept,
}: {
  inviteEmail: string;
  loggedInEmail: string | null;
  token: string;
  submitting: boolean;
  onAccept: () => void;
}) {
  if (!loggedInEmail) {
    const next = `/invite/accept?token=${encodeURIComponent(token)}`;

    return (
      <div className="space-y-3">
        <Notice>이미 가입된 이메일입니다. 초대받은 이메일({inviteEmail})로 로그인한 뒤 수락해 주세요.</Notice>
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="block w-full rounded-md bg-[var(--brand-primary)] px-3 py-2.5 text-center text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)]"
        >
          로그인하러 가기
        </Link>
      </div>
    );
  }

  if (loggedInEmail !== inviteEmail) {
    return (
      <Notice>
        다른 계정({loggedInEmail})으로 로그인되어 있습니다. 초대받은 이메일({inviteEmail})로 로그인한 뒤
        수락해 주세요.
      </Notice>
    );
  }

  return (
    <button type="button" disabled={submitting} onClick={onAccept} className={primaryButtonClass}>
      {submitting ? "처리 중…" : "초대 수락"}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-[var(--text-primary)]">
      {label}
      {children}
    </label>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-4 py-3 text-sm text-[var(--text-secondary)]">
      {children}
    </div>
  );
}

const inputClass =
  "mt-2 h-10 w-full rounded-md border border-[var(--border-default)] px-3 outline-none focus:border-[var(--brand-primary)]";
const primaryButtonClass =
  "h-10 w-full rounded-md bg-[var(--brand-primary)] text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:bg-blue-300";

const INVITE_ERROR_MESSAGES: Record<string, string> = {
  INVITE_NOT_FOUND: "유효하지 않은 초대 링크입니다.",
  INVITE_TOKEN_REQUIRED: "초대 토큰이 없습니다.",
  INVITE_EXPIRED: "만료된 초대입니다. 초대한 관리자에게 재발송을 요청하세요.",
  INVITE_REVOKED: "취소된 초대입니다.",
  INVITE_ALREADY_ACCEPTED: "이미 수락된 초대입니다. 로그인해 주세요.",
  INVITE_EMAIL_MISMATCH: "초대받은 이메일과 로그인한 계정이 다릅니다.",
  INVITE_LOGIN_REQUIRED: "이미 가입된 이메일입니다. 초대받은 이메일로 로그인한 뒤 수락해 주세요.",
  INVITE_ROLE_CONFLICT: "기존 권한과 충돌하는 초대가 있어 수락할 수 없습니다. 관리자에게 문의해 주세요.",
  USER_INACTIVE: "이 Company에서 비활성화된 사용자입니다. 회사 관리자에게 활성화를 요청해 주세요.",
  USER_INVALID_ROLE_SCOPE: "초대 권한 구성이 올바르지 않습니다. 관리자에게 문의해 주세요.",
  USER_SCOPE_NOT_IN_COMPANY: "초대 대상 Workspace/Project 가 더 이상 유효하지 않습니다.",
};

function mapInviteError(code: string | undefined, serverMessage?: string): string {
  if (code && INVITE_ERROR_MESSAGES[code]) {
    return INVITE_ERROR_MESSAGES[code];
  }

  return serverMessage ?? "초대 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.";
}
