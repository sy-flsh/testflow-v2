"use client";

import { useEffect, useState } from "react";
import {
  getErrorMessage,
  requestAuthData,
  type AuthMeResponse,
} from "@/features/auth/auth-types";

export function useCurrentAuth() {
  const [auth, setAuth] = useState<AuthMeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadAuth() {
      setIsLoading(true);
      setError("");

      try {
        const currentAuth =
          await requestAuthData<AuthMeResponse>("/api/auth/me");

        if (!ignore) {
          setAuth(currentAuth);
        }
      } catch (loadError) {
        if (!ignore) {
          setAuth(null);
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadAuth();

    return () => {
      ignore = true;
    };
  }, []);

  return {
    auth,
    permissions: auth?.permissions ?? null,
    role: auth?.role ?? null,
    isLoading,
    error,
  };
}

export function getPermissionMessage(
  isLoading: boolean,
  fallback = "현재 역할에서는 사용할 수 없습니다.",
) {
  return isLoading ? "권한을 확인하는 중입니다." : fallback;
}
