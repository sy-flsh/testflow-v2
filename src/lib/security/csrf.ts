import { apiError } from "@/lib/api/response";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const APP_ORIGIN_ENV_KEYS = ["APP_URL", "NEXT_PUBLIC_APP_URL"] as const;
const DEV_LOCAL_PORTS = ["3000", "3001", "3020"] as const;

export function isUnsafeMethod(method: string) {
  return UNSAFE_METHODS.has(method.toUpperCase());
}

export function assertSameOriginRequest(request: Request) {
  if (!isUnsafeMethod(request.method)) {
    return;
  }

  const sourceOrigin = getSourceOrigin(request);

  if (!sourceOrigin) {
    throw new CsrfError();
  }

  if (!getAllowedOrigins(request).has(sourceOrigin)) {
    throw new CsrfError();
  }
}

export function enforceCsrfProtection(request: Request) {
  try {
    assertSameOriginRequest(request);
    return null;
  } catch (error) {
    if (error instanceof CsrfError) {
      return csrfErrorResponse();
    }

    throw error;
  }
}

export function csrfErrorResponse() {
  return apiError("요청 출처를 확인할 수 없습니다.", 403, "CSRF_FORBIDDEN");
}

export function getAllowedOrigins(request: Request) {
  const allowedOrigins = new Set<string>();
  const requestUrl = new URL(request.url);

  addOrigin(allowedOrigins, requestUrl.origin);

  for (const key of APP_ORIGIN_ENV_KEYS) {
    const origin = process.env[key];

    if (origin) {
      addOrigin(allowedOrigins, origin);
    }
  }

  if (process.env.NODE_ENV !== "production") {
    addDevelopmentOrigins(allowedOrigins, requestUrl);
  }

  return allowedOrigins;
}

class CsrfError extends Error {
  constructor() {
    super("CSRF origin check failed.");
    this.name = "CsrfError";
  }
}

function getSourceOrigin(request: Request) {
  const origin = request.headers.get("origin");

  if (origin) {
    return normalizeOrigin(origin);
  }

  const referer = request.headers.get("referer");

  return referer ? normalizeOrigin(referer) : null;
}

function addDevelopmentOrigins(allowedOrigins: Set<string>, requestUrl: URL) {
  if (!isLocalHostname(requestUrl.hostname)) {
    return;
  }

  const ports = new Set([requestUrl.port, ...DEV_LOCAL_PORTS].filter(Boolean));
  const hostnames = ["localhost", "127.0.0.1"];

  for (const protocol of ["http:", "https:"]) {
    for (const hostname of hostnames) {
      for (const port of ports) {
        addOrigin(allowedOrigins, `${protocol}//${hostname}:${port}`);
      }
    }
  }
}

function addOrigin(origins: Set<string>, value: string) {
  const origin = normalizeOrigin(value);

  if (origin) {
    origins.add(origin);
  }
}

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}
