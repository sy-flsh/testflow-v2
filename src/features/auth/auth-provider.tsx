"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  getErrorCode,
  getErrorMessage,
  requestAuthData,
  type AuthMeResponse,
} from "@/features/auth/auth-types";

export type AuthContextValue = {
  auth: AuthMeResponse | null;
  user: AuthMeResponse["user"] | null;
  workspace: AuthMeResponse["workspace"] | null;
  role: AuthMeResponse["role"] | null;
  permissions: AuthMeResponse["permissions"] | null;
  // c9-5: isLoading 은 "최초 로드" 만 의미한다(background revalidation 에서는 false → 화면 깜빡임 방지).
  isLoading: boolean;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  error: string;
  // c9-4: /api/auth/me 실패 시 error code (예: "USER_INACTIVE"). 정상/없으면 빈 문자열.
  errorCode: string;
  refetch: () => Promise<AuthMeResponse | null>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

// c9-5: 재검증 정책 — 60초 주기(숨김 탭에서는 polling 하지 않음), 포커스/가시성 복귀 시 즉시.
const POLL_INTERVAL_MS = 60_000;
const BACKGROUND_COOLDOWN_MS = 3_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthMeResponse | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");

  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const loggingOutRef = useRef(false);
  const lastBackgroundAtRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // 단일 in-flight 가드로 interval/focus/visibility 가 겹쳐도 요청은 1개만 수행.
  const runFetch = useCallback(async (options?: { initial?: boolean }) => {
    if (inFlightRef.current || loggingOutRef.current) {
      return null;
    }

    inFlightRef.current = true;

    if (options?.initial) {
      setIsInitialLoading(true);
    } else {
      setIsRefreshing(true);
      lastBackgroundAtRef.current = Date.now();
    }

    try {
      const currentAuth = await requestAuthData<AuthMeResponse>("/api/auth/me");
      if (mountedRef.current && !loggingOutRef.current) {
        // 성공 시점에만 갱신(미리 비우지 않음 → USER_INACTIVE 유지/전환이 깜빡이지 않음).
        setAuth(currentAuth);
        setError("");
        setErrorCode("");
      }
      return currentAuth;
    } catch (loadError) {
      if (mountedRef.current && !loggingOutRef.current) {
        setAuth(null);
        setError(getErrorMessage(loadError));
        setErrorCode(getErrorCode(loadError));
      }
      return null;
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) {
        setIsInitialLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  // 공개 refetch: 이미 로드된 이후의 수동 재조회는 background 로 처리(전체 로딩 깜빡임 없음).
  const refetch = useCallback(() => runFetch({ initial: false }), [runFetch]);

  const logout = useCallback(async () => {
    loggingOutRef.current = true;
    try {
      await requestAuthData<{ ok: boolean }>("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      setAuth(null);
      setError("");
      setErrorCode("");
    }
  }, []);

  // 최초 1회 로드.
  useEffect(() => {
    void runFetch({ initial: true });
  }, [runFetch]);

  // c9-5: 주기 + 포커스 + 가시성 복귀 재검증.
  useEffect(() => {
    const backgroundRefetch = (options?: { force?: boolean }) => {
      if (loggingOutRef.current) {
        return;
      }
      if (!options?.force && Date.now() - lastBackgroundAtRef.current < BACKGROUND_COOLDOWN_MS) {
        return; // 짧은 시간 중복 트리거(focus+visibility) 억제. in-flight 가드와 병행.
      }
      void runFetch({ initial: false });
    };

    const onFocus = () => backgroundRefetch();
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        backgroundRefetch();
      }
    };

    const interval = window.setInterval(() => {
      // 숨김 탭에서는 polling 하지 않음(가시성 복귀 시 위 핸들러가 즉시 재검증).
      if (!document.hidden) {
        backgroundRefetch({ force: true });
      }
    }, POLL_INTERVAL_MS);

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [runFetch]);

  const value = useMemo<AuthContextValue>(
    () => ({
      auth,
      user: auth?.user ?? null,
      workspace: auth?.workspace ?? null,
      role: auth?.role ?? null,
      permissions: auth?.permissions ?? null,
      isLoading: isInitialLoading,
      isInitialLoading,
      isRefreshing,
      error,
      errorCode,
      refetch,
      logout,
    }),
    [auth, error, errorCode, isInitialLoading, isRefreshing, logout, refetch],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
