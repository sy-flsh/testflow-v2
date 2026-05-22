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
};

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
