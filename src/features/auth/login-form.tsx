"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  getErrorMessage,
  requestAuthData,
  type AuthMeResponse,
} from "@/features/auth/auth-types";

type LoginResponse = Omit<AuthMeResponse, "workspaces">;

type LoginFormProps = {
  nextPath?: string;
};

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const safeNextPath = getSafeNextPath(nextPath);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function checkSession() {
      try {
        await requestAuthData<AuthMeResponse>("/api/auth/me");

        if (!ignore) {
          router.replace(safeNextPath);
        }
      } catch {
        if (!ignore) {
          setIsCheckingSession(false);
        }
      }
    }

    void checkSession();

    return () => {
      ignore = true;
    };
  }, [router, safeNextPath]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await requestAuthData<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
        }),
      });
      router.replace(safeNextPath);
      router.refresh();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 flex items-center justify-between">
        <h2 className="text-2xl font-semibold">로그인</h2>
        <Link
          href="/signup"
          className="text-sm font-medium text-[var(--brand-primary)]"
        >
          회원가입
        </Link>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {(isCheckingSession || errorMessage) && (
          <div
            className={
              errorMessage
                ? "rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                : "rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700"
            }
          >
            {errorMessage || "세션을 확인하는 중입니다."}
          </div>
        )}
        <label className="block text-sm font-medium">
          이메일
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 h-10 w-full rounded-md border border-[var(--border-default)] px-3 outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-primary)]"
            placeholder="qa.lead@testflow.local"
            autoComplete="email"
            required
          />
        </label>
        <label className="block text-sm font-medium">
          비밀번호
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 h-10 w-full rounded-md border border-[var(--border-default)] px-3 outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-primary)]"
            placeholder="password123!"
            autoComplete="current-password"
            required
          />
        </label>
        <button
          type="submit"
          disabled={isSubmitting || isCheckingSession}
          className="h-10 w-full rounded-md bg-[var(--brand-primary)] text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {isSubmitting ? "로그인 중..." : "로그인"}
        </button>
      </form>
    </div>
  );
}

function getSafeNextPath(next?: string) {
  if (!next) {
    return "/dashboard";
  }

  if (!next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }

  return next;
}
