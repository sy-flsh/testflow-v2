"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
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
  isLoading: boolean;
  error: string;
  refetch: () => Promise<AuthMeResponse | null>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthMeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const currentAuth =
        await requestAuthData<AuthMeResponse>("/api/auth/me");
      setAuth(currentAuth);
      return currentAuth;
    } catch (loadError) {
      setAuth(null);
      setError(getErrorMessage(loadError));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await requestAuthData<{ ok: boolean }>("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      setAuth(null);
      setError("");
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const value = useMemo<AuthContextValue>(
    () => ({
      auth,
      user: auth?.user ?? null,
      workspace: auth?.workspace ?? null,
      role: auth?.role ?? null,
      permissions: auth?.permissions ?? null,
      isLoading,
      error,
      refetch,
      logout,
    }),
    [auth, error, isLoading, logout, refetch],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
