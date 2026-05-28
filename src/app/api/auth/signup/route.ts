import { apiError, apiSuccess } from "@/lib/api/response";
import { readJsonBody, readTrimmedString } from "@/lib/api/request";
import { prisma } from "@/lib/db/prisma";
import { mapAuthPayload } from "@/lib/auth/me";
import { createSession } from "@/lib/auth/session";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { enforceCsrfProtection } from "@/lib/security/csrf";
import {
  checkRateLimit,
  getClientIp,
  rateLimitErrorResponse,
} from "@/lib/security/rate-limit";
import { toWorkspaceSlug } from "@/lib/workspaces/workspace-api";

export const runtime = "nodejs";

const SIGNUP_WINDOW_MS = 10 * 60 * 1000;
const SIGNUP_IP_LIMIT = 5;

export async function POST(request: Request) {
  try {
    const csrfError = enforceCsrfProtection(request);

    if (csrfError) {
      return csrfError;
    }

    const ipLimit = await checkRateLimit({
      scope: "auth:signup:ip",
      key: getClientIp(request),
      limit: SIGNUP_IP_LIMIT,
      windowMs: SIGNUP_WINDOW_MS,
    });

    if (!ipLimit.allowed) {
      return rateLimitErrorResponse(ipLimit);
    }

    const body = await readJsonBody(request);
    const name = readTrimmedString(body.name);
    const email = normalizeEmail(body.email);
    const password = readTrimmedString(body.password);
    const workspaceName = readTrimmedString(body.workspaceName) || `${name || "새"} 워크스페이스`;

    if (!name) {
      return apiError("이름을 입력하세요.", 400, "AUTH_NAME_REQUIRED");
    }

    if (!email) {
      return apiError("이메일을 입력하세요.", 400, "AUTH_EMAIL_REQUIRED");
    }

    const passwordError = validatePassword(password);

    if (passwordError) {
      return apiError(passwordError, 400, "AUTH_PASSWORD_INVALID");
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return apiError("이미 가입된 이메일입니다.", 409, "AUTH_EMAIL_EXISTS");
    }

    const passwordHash = await hashPassword(password);
    const workspaceSlug = await createUniqueWorkspaceSlug(workspaceName);
    const { user, workspace, member } = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
        },
      });
      const createdWorkspace = await tx.workspace.create({
        data: {
          name: workspaceName,
          slug: workspaceSlug,
          timezone: "Asia/Seoul",
        },
      });
      const createdMember = await tx.workspaceMember.create({
        data: {
          workspaceId: createdWorkspace.id,
          userId: createdUser.id,
          role: "ADMIN",
          status: "ACTIVE",
        },
      });

      return {
        user: createdUser,
        workspace: createdWorkspace,
        member: createdMember,
      };
    });

    await createSession(user.id, workspace.id);

    return apiSuccess(mapAuthPayload({ user, workspace, role: member.role }), { status: 201 });
  } catch (error) {
    console.error(error);
    return apiError("회원가입을 처리하지 못했습니다.", 500, "AUTH_SIGNUP_FAILED");
  }
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

async function createUniqueWorkspaceSlug(name: string) {
  const baseSlug = toWorkspaceSlug(name) || "workspace";
  let slug = baseSlug;
  let suffix = 2;

  while (await prisma.workspace.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
}
