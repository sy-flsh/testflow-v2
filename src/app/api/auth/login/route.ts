import { apiError, apiSuccess } from "@/lib/api/response";
import { readJsonBody, readTrimmedString } from "@/lib/api/request";
import { mapAuthPayload, resolveActiveMembership } from "@/lib/auth/me";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { enforceCsrfProtection } from "@/lib/security/csrf";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const csrfError = enforceCsrfProtection(request);

    if (csrfError) {
      return csrfError;
    }

    const body = await readJsonBody(request);
    const email = normalizeEmail(body.email);
    const password = readTrimmedString(body.password);

    if (!email || !password) {
      return invalidCredentials();
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user?.passwordHash) {
      return invalidCredentials();
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);

    if (!isPasswordValid) {
      return invalidCredentials();
    }

    const membership = await resolveActiveMembership(user.id);

    if (!membership) {
      return apiError("활성 워크스페이스 멤버십을 찾을 수 없습니다.", 403, "AUTH_WORKSPACE_REQUIRED");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await createSession(user.id, membership.workspaceId);

    return apiSuccess(
      mapAuthPayload({
        user,
        workspace: membership.workspace,
        role: membership.role,
      }),
    );
  } catch (error) {
    console.error(error);
    return apiError("로그인을 처리하지 못했습니다.", 500, "AUTH_LOGIN_FAILED");
  }
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function invalidCredentials() {
  return apiError("이메일 또는 비밀번호가 올바르지 않습니다.", 401, "AUTH_INVALID_CREDENTIALS");
}
