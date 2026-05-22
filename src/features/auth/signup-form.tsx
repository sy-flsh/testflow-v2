"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  getErrorMessage,
  requestAuthData,
  type AuthMeResponse,
} from "@/features/auth/auth-types";

type SignupResponse = Omit<AuthMeResponse, "workspaces">;

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function checkSession() {
      try {
        await requestAuthData<AuthMeResponse>("/api/auth/me");

        if (!ignore) {
          router.replace("/dashboard");
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
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await requestAuthData<SignupResponse>("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          password,
          workspaceName,
        }),
      });
      router.replace("/dashboard");
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
        <h2 className="text-2xl font-semibold">회원가입</h2>
        <Link
          href="/login"
          className="text-sm font-medium text-[var(--brand-primary)]"
        >
          로그인
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
          이름
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 h-10 w-full rounded-md border border-[var(--border-default)] px-3 outline-none focus:border-[var(--brand-primary)]"
            placeholder="홍길동"
            autoComplete="name"
            required
          />
        </label>
        <label className="block text-sm font-medium">
          이메일
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 h-10 w-full rounded-md border border-[var(--border-default)] px-3 outline-none focus:border-[var(--brand-primary)]"
            placeholder="qa@example.com"
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
            className="mt-2 h-10 w-full rounded-md border border-[var(--border-default)] px-3 outline-none focus:border-[var(--brand-primary)]"
            placeholder="8자 이상"
            autoComplete="new-password"
            required
          />
        </label>
        <label className="block text-sm font-medium">
          워크스페이스 이름
          <input
            value={workspaceName}
            onChange={(event) => setWorkspaceName(event.target.value)}
            className="mt-2 h-10 w-full rounded-md border border-[var(--border-default)] px-3 outline-none focus:border-[var(--brand-primary)]"
            placeholder="입력하지 않으면 이름 기반으로 생성"
            autoComplete="organization"
          />
        </label>
        <button
          type="submit"
          disabled={isSubmitting || isCheckingSession}
          className="h-10 w-full rounded-md bg-[var(--brand-primary)] text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {isSubmitting ? "가입 처리 중..." : "가입하기"}
        </button>
      </form>
    </div>
  );
}
