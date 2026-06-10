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
};

export type SpecRole = "MASTER" | "CO" | "WO" | "PO" | "MEMBER" | "VIEWER";

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
    error?: { message?: string };
  };

  if (!response.ok || payload.data === undefined) {
    throw new Error(payload.error?.message || "요청을 처리하지 못했습니다.");
  }

  return payload.data;
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
}
