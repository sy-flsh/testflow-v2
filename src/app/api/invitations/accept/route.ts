import { Prisma } from "@prisma/client";
import type { Role, ScopeType } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { readJsonBody, readTrimmedString } from "@/lib/api/request";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { isAssignableRole, isRoleAllowedForScope } from "@/lib/auth/roles";
import { getCurrentSession, createSession } from "@/lib/auth/session";
import {
  hashInvitationToken,
  memberRoleForWorkspaceRole,
} from "@/lib/company/invitations";
import { prisma } from "@/lib/db/prisma";
import { enforceCsrfProtection } from "@/lib/security/csrf";
import {
  checkRateLimit,
  getClientIp,
  rateLimitErrorResponse,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const ACCEPT_WINDOW_MS = 10 * 60 * 1000;
const ACCEPT_IP_LIMIT = 10;

type RoleSnapshot = { scopeType: ScopeType; scopeId: string; role: Role };
type RoleConflict = {
  scopeType: ScopeType;
  scopeId: string;
  existingRole: Role;
  invitedRole: Role;
};

/**
 * c8-2: 초대 수락(신규 사용자 가입 또는 기존 로그인 사용자 참여).
 * POST /api/invitations/accept  body: { token, name?, password? }
 *
 * 보안: CSRF 보호 + IP rate limit. raw token 은 body 로만 받고 응답/로그에 노출하지 않는다.
 * 상태 전이/충돌 검사/UserRole 승격/ACCEPTED 처리는 단일 Serializable 트랜잭션에서 일괄 처리한다
 * (수락-수락 race, 동시 role-sync 와의 충돌로 인한 이중 승격/이중 수락 방지).
 */
export async function POST(request: Request) {
  try {
    const csrfError = enforceCsrfProtection(request);

    if (csrfError) {
      return csrfError;
    }

    const ipLimit = await checkRateLimit({
      scope: "auth:invite-accept:ip",
      key: getClientIp(request),
      limit: ACCEPT_IP_LIMIT,
      windowMs: ACCEPT_WINDOW_MS,
    });

    if (!ipLimit.allowed) {
      return rateLimitErrorResponse(ipLimit);
    }

    const body = await readJsonBody(request);
    const token = readTrimmedString(body.token);
    const name = readTrimmedString(body.name);
    const password = readTrimmedString(body.password);

    if (!token) {
      return apiError("초대 토큰이 필요합니다.", 400, "INVITE_TOKEN_REQUIRED");
    }

    const tokenHash = hashInvitationToken(token);
    const session = await getCurrentSession();

    // --- 경로 결정(트랜잭션 밖에서 bcrypt 등 비용 큰 작업 선처리) ---
    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash },
      select: { id: true, email: true, status: true, expiresAt: true },
    });

    if (!invitation) {
      return apiError("초대를 찾을 수 없습니다.", 404, "INVITE_NOT_FOUND");
    }

    const statusError = invitationStatusError(invitation.status, invitation.expiresAt);

    if (statusError) {
      if (statusError === "INVITE_EXPIRED" && invitation.status === "PENDING") {
        await prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: "EXPIRED" },
        });
      }

      return apiError(statusMessage(statusError), 400, statusError);
    }

    let isNewUser = false;
    let preHashedPassword: string | null = null;

    if (session) {
      // 기존 로그인 사용자: email 일치할 때만 수락. name/password 불요.
      if (session.user.email !== invitation.email) {
        return apiError(
          "초대받은 이메일과 로그인한 계정이 다릅니다.",
          403,
          "INVITE_EMAIL_MISMATCH",
        );
      }
    } else {
      const existing = await prisma.user.findUnique({
        where: { email: invitation.email },
        select: { id: true },
      });

      if (existing) {
        // 기존 사용자지만 비로그인 → 초대 이메일로 로그인 후 수락해야 함.
        return apiError(
          "이미 가입된 이메일입니다. 초대받은 이메일로 로그인한 뒤 수락해 주세요.",
          401,
          "INVITE_LOGIN_REQUIRED",
        );
      }

      // 신규 사용자: name/password 필수.
      if (!name) {
        return apiError("이름을 입력하세요.", 400, "AUTH_NAME_REQUIRED");
      }

      const passwordError = validatePassword(password);

      if (passwordError) {
        return apiError(passwordError, 400, "AUTH_PASSWORD_INVALID");
      }

      isNewUser = true;
      preHashedPassword = await hashPassword(password);
    }

    // --- 권한 승격(단일 Serializable 트랜잭션) ---
    let result: {
      targetUserId: string;
      companyId: string;
      selectedWorkspaceId: string | null;
      hasCompanyRole: boolean;
    };

    try {
      result = await prisma.$transaction(
        async (tx) => {
          const current = await tx.invitation.findUnique({
            where: { id: invitation.id },
            include: { roles: { select: { scopeType: true, scopeId: true, role: true } } },
          });

          if (!current) {
            throw new InviteAcceptError("초대를 찾을 수 없습니다.", 404, "INVITE_NOT_FOUND");
          }

          const liveStatusError = invitationStatusError(current.status, current.expiresAt);

          if (liveStatusError) {
            throw new InviteAcceptError(statusMessage(liveStatusError), 400, liveStatusError);
          }

          // scope 재검증: companyId 소속 + role/scope 정합성(MASTER 금지)
          const workspaces = await tx.workspace.findMany({
            where: { companyId: current.companyId },
            select: { id: true },
          });
          const workspaceIdSet = new Set(workspaces.map((workspace) => workspace.id));
          const projects = await tx.project.findMany({
            where: { workspace: { companyId: current.companyId } },
            select: { id: true, workspaceId: true },
          });
          const projectIdSet = new Set(projects.map((project) => project.id));
          // c8-2-hotfix: PROJECT scopeId → 상위 workspaceId (활성 멤버십 보장용).
          const projectWorkspace = new Map(
            projects.map((project) => [project.id, project.workspaceId]),
          );

          const roles: RoleSnapshot[] = current.roles;

          for (const item of roles) {
            if (!isAssignableRole(item.role) || !isRoleAllowedForScope(item.role, item.scopeType)) {
              throw new InviteAcceptError(
                "허용되지 않은 Role/Scope 조합입니다.",
                400,
                "USER_INVALID_ROLE_SCOPE",
              );
            }

            const inCompany =
              item.scopeType === "COMPANY"
                ? item.scopeId === current.companyId
                : item.scopeType === "WORKSPACE"
                  ? workspaceIdSet.has(item.scopeId)
                  : projectIdSet.has(item.scopeId);

            if (!inCompany) {
              throw new InviteAcceptError(
                "현재 Company 소속이 아닌 scope 입니다.",
                400,
                "USER_SCOPE_NOT_IN_COMPANY",
              );
            }
          }

          // 대상 사용자 결정(신규는 생성)
          let targetUserId: string;

          if (isNewUser && preHashedPassword) {
            const createdUser = await tx.user.create({
              data: {
                email: current.email,
                name,
                passwordHash: preHashedPassword,
                emailVerifiedAt: new Date(),
              },
              select: { id: true },
            });
            targetUserId = createdUser.id;
          } else if (session) {
            targetUserId = session.userId;
          } else {
            // 방어적: 위에서 걸러졌어야 함.
            throw new InviteAcceptError("초대 수락에 실패했습니다.", 400, "INVITE_ACCEPT_FAILED");
          }

          // 충돌 선검증: 같은 scope 에 다른 Role 이 있으면 전체 중단.
          const existingRoles = await tx.userRole.findMany({
            where: {
              userId: targetUserId,
              OR: roles.map((item) => ({ scopeType: item.scopeType, scopeId: item.scopeId })),
            },
            select: { scopeType: true, scopeId: true, role: true },
          });
          const existingByScope = new Map(
            existingRoles.map((item) => [`${item.scopeType}:${item.scopeId}`, item.role]),
          );

          const conflicts: RoleConflict[] = [];
          const toCreate: RoleSnapshot[] = [];

          for (const item of roles) {
            const currentRole = existingByScope.get(`${item.scopeType}:${item.scopeId}`);

            if (currentRole === undefined) {
              toCreate.push(item);
            } else if (currentRole !== item.role) {
              conflicts.push({
                scopeType: item.scopeType,
                scopeId: item.scopeId,
                existingRole: currentRole,
                invitedRole: item.role,
              });
            }
            // currentRole === item.role → 기존 Role 유지(멱등)
          }

          if (conflicts.length > 0) {
            throw new InviteAcceptError(
              "기존 권한과 충돌하는 초대 Role 이 있어 수락을 중단했습니다.",
              409,
              "INVITE_ROLE_CONFLICT",
              { conflicts },
            );
          }

          if (toCreate.length > 0) {
            await tx.userRole.createMany({
              data: toCreate.map((item) => ({
                userId: targetUserId,
                scopeType: item.scopeType,
                scopeId: item.scopeId,
                role: item.role,
              })),
            });
          }

          // c8-2-hotfix: WORKSPACE/PROJECT scope 모두에 대해 상위 Workspace 의
          // WorkspaceMember(ACTIVE) 를 보장한다(없을 때만 생성, 기존 멤버십 role/status 미변경).
          //  - WORKSPACE scope: 매핑된 role(WO→ADMIN/MEMBER→MEMBER/VIEWER→VIEWER) 로 생성.
          //  - PROJECT scope: 상위 workspace 에 멤버십이 없으면 최소 멤버십(MEMBER) 생성.
          //    (실제 프로젝트 권한 정본은 UserRole(PROJECT scope) — 이 멤버십은 접근/활성 Workspace 해석용)
          // 같은 workspace 에 여러 role 이 걸려도 Map 으로 dedupe 하여 1건만 upsert 한다.
          // WORKSPACE 매핑 role 이 PROJECT 기본 MEMBER 보다 우선한다.
          const membershipRoleByWorkspace = new Map<string, "ADMIN" | "MEMBER" | "VIEWER">();

          for (const item of roles) {
            if (item.scopeType === "WORKSPACE") {
              membershipRoleByWorkspace.set(item.scopeId, memberRoleForWorkspaceRole(item.role));
            }
          }

          for (const item of roles) {
            if (item.scopeType !== "PROJECT") {
              continue;
            }

            const parentWorkspaceId = projectWorkspace.get(item.scopeId);

            if (parentWorkspaceId && !membershipRoleByWorkspace.has(parentWorkspaceId)) {
              membershipRoleByWorkspace.set(parentWorkspaceId, "MEMBER");
            }
          }

          for (const [parentWorkspaceId, memberRole] of membershipRoleByWorkspace) {
            await tx.workspaceMember.upsert({
              where: {
                workspaceId_userId: { workspaceId: parentWorkspaceId, userId: targetUserId },
              },
              update: {},
              create: {
                workspaceId: parentWorkspaceId,
                userId: targetUserId,
                role: memberRole,
                status: "ACTIVE",
              },
            });
          }

          // PENDING → ACCEPTED (race guard: PENDING 일 때만 적용)
          const accepted = await tx.invitation.updateMany({
            where: { id: current.id, status: "PENDING" },
            data: { status: "ACCEPTED", acceptedAt: new Date() },
          });

          if (accepted.count === 0) {
            throw new InviteAcceptError("이미 수락된 초대입니다.", 400, "INVITE_ALREADY_ACCEPTED");
          }

          // 활성 Workspace 선택: WORKSPACE scope 우선, 없으면 PROJECT 상위 workspace.
          const selectedWorkspaceId =
            roles.find((item) => item.scopeType === "WORKSPACE")?.scopeId ??
            membershipRoleByWorkspace.keys().next().value ??
            null;

          return {
            targetUserId,
            companyId: current.companyId,
            selectedWorkspaceId,
            hasCompanyRole: roles.some((item) => item.scopeType === "COMPANY"),
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof InviteAcceptError) {
        return error.toResponse();
      }

      throw error;
    }

    // 신규 사용자만 새 세션 생성(기존 사용자는 현재 세션 유지).
    if (isNewUser) {
      await createSession(result.targetUserId, result.selectedWorkspaceId);
    }

    const redirectTo = result.selectedWorkspaceId
      ? "/dashboard"
      : result.hasCompanyRole
        ? "/company/users"
        : "/dashboard";

    return apiSuccess(
      {
        accepted: true,
        isNewUser,
        companyId: result.companyId,
        redirectTo,
      },
      { status: isNewUser ? 201 : 200 },
    );
  } catch (error) {
    console.error(error);
    return apiError("초대 수락에 실패했습니다.", 500, "INVITE_ACCEPT_FAILED");
  }
}

/** PENDING 이고 미만료면 null, 아니면 에러 code. */
function invitationStatusError(
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED",
  expiresAt: Date,
): "INVITE_EXPIRED" | "INVITE_REVOKED" | "INVITE_ALREADY_ACCEPTED" | null {
  if (status === "PENDING") {
    return expiresAt.getTime() < Date.now() ? "INVITE_EXPIRED" : null;
  }

  if (status === "EXPIRED") {
    return "INVITE_EXPIRED";
  }

  if (status === "REVOKED") {
    return "INVITE_REVOKED";
  }

  return "INVITE_ALREADY_ACCEPTED";
}

function statusMessage(code: string): string {
  switch (code) {
    case "INVITE_EXPIRED":
      return "만료된 초대입니다.";
    case "INVITE_REVOKED":
      return "취소된 초대입니다.";
    case "INVITE_ALREADY_ACCEPTED":
      return "이미 수락된 초대입니다.";
    default:
      return "수락할 수 없는 초대입니다.";
  }
}

/** 트랜잭션 내부에서 던져 외부 catch 에서 응답으로 변환하는 에러(롤백 보장). */
class InviteAcceptError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "InviteAcceptError";
  }

  toResponse() {
    return NextResponse.json(
      {
        error: {
          message: this.message,
          code: this.code,
          ...(this.details ?? {}),
        },
      },
      { status: this.status },
    );
  }
}
