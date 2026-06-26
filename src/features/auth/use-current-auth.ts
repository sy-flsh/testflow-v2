"use client";

import { useContext, useEffect, useState } from "react";
import { AuthContext } from "@/features/auth/auth-provider";
import {
  getErrorCode,
  getErrorMessage,
  requestAuthData,
  type AuthMeResponse,
} from "@/features/auth/auth-types";

export function useCurrentAuth() {
  const context = useContext(AuthContext);
  const hasContext = context !== null;
  const [fallbackAuth, setFallbackAuth] = useState<AuthMeResponse | null>(null);
  const [fallbackLoading, setFallbackLoading] = useState(true);
  const [fallbackError, setFallbackError] = useState("");
  const [fallbackErrorCode, setFallbackErrorCode] = useState("");

  useEffect(() => {
    if (hasContext) {
      setFallbackLoading(false);
      return;
    }

    let ignore = false;

    async function loadAuth() {
      setFallbackLoading(true);
      setFallbackError("");
      setFallbackErrorCode("");

      try {
        const currentAuth =
          await requestAuthData<AuthMeResponse>("/api/auth/me");

        if (!ignore) {
          setFallbackAuth(currentAuth);
        }
      } catch (loadError) {
        if (!ignore) {
          setFallbackAuth(null);
          setFallbackError(getErrorMessage(loadError));
          setFallbackErrorCode(getErrorCode(loadError));
        }
      } finally {
        if (!ignore) {
          setFallbackLoading(false);
        }
      }
    }

    void loadAuth();

    return () => {
      ignore = true;
    };
  }, [hasContext]);

  if (context) {
    return context;
  }

  return {
    auth: fallbackAuth,
    user: fallbackAuth?.user ?? null,
    workspace: fallbackAuth?.workspace ?? null,
    permissions: fallbackAuth?.permissions ?? null,
    role: fallbackAuth?.role ?? null,
    isLoading: fallbackLoading,
    isInitialLoading: fallbackLoading,
    isRefreshing: false,
    error: fallbackError,
    errorCode: fallbackErrorCode,
    refetch: async () => {
      try {
        const currentAuth =
          await requestAuthData<AuthMeResponse>("/api/auth/me");
        setFallbackAuth(currentAuth);
        setFallbackError("");
        setFallbackErrorCode("");
        return currentAuth;
      } catch (loadError) {
        setFallbackAuth(null);
        setFallbackError(getErrorMessage(loadError));
        setFallbackErrorCode(getErrorCode(loadError));
        return null;
      }
    },
    logout: async () => {
      try {
        await requestAuthData<{ ok: boolean }>("/api/auth/logout", {
          method: "POST",
        });
      } finally {
        setFallbackAuth(null);
        setFallbackErrorCode("");
      }
    },
  };
}

export function getPermissionMessage(
  isLoading: boolean,
  fallback = "현재 역할에서는 사용할 수 없습니다.",
) {
  return isLoading ? "권한을 확인하는 중입니다." : fallback;
}
