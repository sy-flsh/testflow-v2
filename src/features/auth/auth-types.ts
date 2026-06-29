export type AuthMeResponse = {
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  role: "Admin" | "Member" | "Viewer";
  permissions: {
    canRead: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canAccessDangerZone: boolean;
  };
  workspaces?: Array<{
    id: string;
    name: string;
    slug: string;
    role: "Admin" | "Member" | "Viewer";
  }>;
  // c5-1: UserRole 기반 scope별 Role (additive, optional). 아직 UI에서 사용하지 않는다.
  rolesByScope?: {
    company: Array<{ scopeId: string; role: SpecRole }>;
    workspace: Array<{ scopeId: string; role: SpecRole }>;
    project: Array<{ scopeId: string; role: SpecRole }>;
  };
  // c10-2: 전역 운영(MasterAdmin) 여부 (additive). 관리자 nav 노출 판단용. 미포함이면 false 로 간주.
  isMasterAdmin?: boolean;
};

export type SpecRole = "MASTER" | "CO" | "WO" | "PO" | "MEMBER" | "VIEWER";

/**
 * c9-4: 인증 요청 실패 시 HTTP status 와 error code 를 보존하는 에러.
 * (기존엔 message 만 가진 일반 Error 라 USER_INACTIVE 같은 code 를 클라이언트가 구분할 수 없었다.)
 */
export class AuthRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "AuthRequestError";
  }
}

export async function requestAuthData<T>(url: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers,
  });
  const payload = (await response.json()) as {
    data?: T;
    error?: { message?: string; code?: string };
  };

  if (!response.ok || payload.data === undefined) {
    throw new AuthRequestError(
      payload.error?.message || "요청을 처리하지 못했습니다.",
      response.status,
      payload.error?.code ?? "",
    );
  }

  return payload.data;
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
}

/** 인증 에러의 code (예: "USER_INACTIVE" / "AUTH_UNAUTHORIZED"). 없으면 빈 문자열. */
export function getErrorCode(error: unknown): string {
  return error instanceof AuthRequestError ? error.code : "";
}
