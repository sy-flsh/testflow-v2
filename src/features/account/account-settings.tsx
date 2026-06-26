"use client";

import { useState } from "react";
import { UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { DialogShell } from "@/components/common/dialog-shell";
import { useCurrentAuth } from "@/features/auth/use-current-auth";

const CONFIRMATION_PHRASE = "탈퇴합니다";

/**
 * c10-1: 본인 계정 전역 탈퇴(soft delete) self-service UI.
 * - POST /api/account/withdraw (confirmation: "탈퇴합니다").
 * - 성공 시 client auth 상태 정리 후 /login 으로 이동(세션은 서버에서 이미 삭제됨).
 * - soft delete 안내: 물리 삭제가 아니라 접근 차단 + 기록 보존.
 */
export function AccountSettings() {
  const router = useRouter();
  const { auth, logout } = useCurrentAuth();

  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSubmit = confirmation.trim() === CONFIRMATION_PHRASE && !submitting;

  function openModal() {
    setConfirmation("");
    setError(null);
    setDone(false);
    setOpen(true);
  }

  function closeModal() {
    if (submitting) return;
    setOpen(false);
  }

  async function handleWithdraw() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/account/withdraw", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: confirmation.trim() }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { data?: { ok?: boolean }; error?: { message?: string } }
        | null;

      if (!response.ok || !payload?.data?.ok) {
        setError(payload?.error?.message ?? "계정 탈퇴를 처리하지 못했습니다.");
        return;
      }

      // 성공: 짧게 안내 후 client auth 정리 + 로그인 이동.
      setDone(true);
      await logout();
      router.replace("/login");
      router.refresh();
    } catch {
      setError("계정 탈퇴를 처리하지 못했습니다. 네트워크 상태를 확인해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-[var(--border-default)] bg-white">
        <div className="border-b border-[var(--border-subtle)] px-5 py-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">계정 정보</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            로그인 계정 정보입니다.
          </p>
        </div>
        <dl className="grid grid-cols-[120px_1fr] gap-y-2 px-5 py-4 text-sm">
          <dt className="text-[var(--text-tertiary)]">이름</dt>
          <dd className="text-[var(--text-primary)]">{auth?.user.name ?? "—"}</dd>
          <dt className="text-[var(--text-tertiary)]">이메일</dt>
          <dd className="text-[var(--text-secondary)]">{auth?.user.email ?? "—"}</dd>
        </dl>
      </section>

      <section className="rounded-lg border border-red-200 bg-white">
        <div className="border-b border-[var(--border-subtle)] px-5 py-4">
          <h2 className="text-base font-semibold text-red-700">계정 탈퇴</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">되돌리기 어려운 계정 작업입니다.</p>
        </div>
        <div className="px-5 py-4">
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
            탈퇴하면 모든 회사와 워크스페이스에 대한 접근 권한이 즉시 중지됩니다.
            <br />
            기존 업무 기록과 보안 감사 이력은 운영 및 보안 목적으로 보존될 수 있습니다.
          </div>
          <button
            type="button"
            onClick={openModal}
            className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700"
          >
            <UserX className="h-4 w-4" />
            계정 탈퇴
          </button>
        </div>
      </section>

      {open && (
        <DialogShell
          title="계정 탈퇴"
          description="이 작업은 되돌리기 어렵습니다. 신중히 진행해 주세요."
          onClose={closeModal}
          maxWidth="max-w-lg"
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="h-10 rounded-md border border-[var(--border-subtle)] px-4 text-sm font-medium hover:bg-[var(--surface-muted)] disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleWithdraw}
                disabled={!canSubmit}
                className="h-10 rounded-md bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-200"
              >
                {submitting ? "처리 중…" : "계정 탈퇴"}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
              탈퇴 후에는 로그인할 수 없으며, 동일 이메일로 재가입할 수 없습니다. 계정 복구는 관리자를
              통해서만 가능합니다.
            </div>
            <label className="block text-sm">
              <span className="text-[var(--text-secondary)]">
                계속하려면 <strong>{CONFIRMATION_PHRASE}</strong>를 정확히 입력해 주세요.
              </span>
              <input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder={CONFIRMATION_PHRASE}
                aria-label="탈퇴 확인 문구"
                className="mt-2 h-10 w-full rounded-md border border-[var(--border-default)] px-3 text-sm outline-none placeholder:text-[var(--text-tertiary)] focus:border-red-500"
              />
            </label>
            {error && <p className="text-sm text-[var(--danger-text)]">{error}</p>}
            {done && <p className="text-sm text-emerald-600">탈퇴 처리되었습니다. 로그인 화면으로 이동합니다.</p>}
          </div>
        </DialogShell>
      )}
    </div>
  );
}
