import type { Prisma, Role, ScopeType } from "@prisma/client";
import { apiError, apiSuccess } from "@/lib/api/response";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireCompanyOwner,
} from "@/lib/auth/guards";
import { isAssignableRole, isRoleAllowedForScope } from "@/lib/auth/roles";
import type {
  CompanyInvitationDto,
  InvitationRoleDto,
} from "@/lib/company/types";
import {
  buildInviteUrl,
  createInvitationToken,
  hashInvitationToken,
  invitationExpiresAt,
  normalizeEmail,
} from "@/lib/company/invitations";
import { prisma } from "@/lib/db/prisma";
import { enforceCsrfProtection } from "@/lib/security/csrf";

export const runtime = "nodejs";

const SCOPE_TYPES: ScopeType[] = ["COMPANY", "WORKSPACE", "PROJECT"];
const ROLES: Role[] = ["MASTER", "CO", "WO", "PO", "MEMBER", "VIEWER"];

type DesiredRole = { scopeType: ScopeType; scopeId: string; role: Role };

/**
 * c8-1: Company CO 초대 생성.
 * POST /api/company/invitations
 * body: { email, roles: [{ scopeType, scopeId, role }] }
 *
 * - requireCompanyOwner 로 CO 만 허용 + CSRF 보호.
 * - email 정규화/검증, roles 정합성(scope-role/중복/회사 소속) 검증.
 * - 동일 Company+email 기존 PENDING 초대는 REVOKED 처리 후 새 초대 생성(단일 트랜잭션).
 * - 이미 ACCEPTED 된 동일 email 초대가 있으면 409.
 * - raw token 은 저장하지 않고 hash 만 저장. inviteUrl 은 이 응답에서만 1회 반환.
 */
export async function POST(request: Request) {
  try {
    const csrfError = enforceCsrfProtection(request);

    if (csrfError) {
      return csrfError;
    }

    const { user: actor, companyId } = await requireCompanyOwner();

    const body = (await readJsonBody(request)) as {
      email?: unknown;
      roles?: unknown;
    };

    const email = normalizeEmail(body.email);

    if (!email) {
      return apiError("올바른 이메일 형식이 아닙니다.", 400, "INVITE_INVALID_EMAIL");
    }

    const rawRoles = Array.isArray(body.roles) ? body.roles : null;

    if (!rawRoles || rawRoles.length === 0) {
      return apiError("초대할 권한(roles)을 1개 이상 지정해야 합니다.", 400, "INVITE_ROLES_REQUIRED");
    }

    // 1) 형식 + scope-role 정합성(MASTER 금지 포함) + 중복 검증
    const desired: DesiredRole[] = [];
    const seenScopes = new Set<string>();

    for (const entry of rawRoles) {
      const record = (entry ?? {}) as Record<string, unknown>;
      const scopeType = record.scopeType as ScopeType;
      const scopeId = typeof record.scopeId === "string" ? record.scopeId.trim() : "";
      const role = record.role as Role;

      if (
        !SCOPE_TYPES.includes(scopeType) ||
        !scopeId ||
        !ROLES.includes(role) ||
        !isAssignableRole(role) ||
        !isRoleAllowedForScope(role, scopeType)
      ) {
        return apiError("허용되지 않은 Role/Scope 조합입니다.", 400, "USER_INVALID_ROLE_SCOPE");
      }

      const dedupeKey = `${scopeType}:${scopeId}`;

      if (seenScopes.has(dedupeKey)) {
        return apiError("동일 scope 에 중복된 Role 이 있습니다.", 400, "USER_DUPLICATE_SCOPE");
      }

      seenScopes.add(dedupeKey);
      desired.push({ scopeType, scopeId, role });
    }

    // 2) scope 소속 검증: 모든 scopeId 가 현재 Company 소속이어야 함
    const companyWorkspaces = await prisma.workspace.findMany({
      where: { companyId },
      select: { id: true },
    });
    const workspaceIdSet = new Set(companyWorkspaces.map((workspace) => workspace.id));

    const companyProjects = await prisma.project.findMany({
      where: { workspace: { companyId } },
      select: { id: true },
    });
    const projectIdSet = new Set(companyProjects.map((project) => project.id));

    for (const item of desired) {
      const inCompany =
        item.scopeType === "COMPANY"
          ? item.scopeId === companyId
          : item.scopeType === "WORKSPACE"
            ? workspaceIdSet.has(item.scopeId)
            : projectIdSet.has(item.scopeId);

      if (!inCompany) {
        return apiError("현재 Company 소속이 아닌 scope 입니다.", 400, "USER_SCOPE_NOT_IN_COMPANY");
      }
    }

    // 3) 이미 ACCEPTED 된 동일 email 초대가 있으면 재발급 금지
    const accepted = await prisma.invitation.findFirst({
      where: { companyId, email, status: "ACCEPTED" },
      select: { id: true },
    });

    if (accepted) {
      return apiError("이미 수락된 초대가 있는 이메일입니다.", 409, "INVITE_ALREADY_ACCEPTED");
    }

    const token = createInvitationToken();
    const tokenHash = hashInvitationToken(token);
    const expiresAt = invitationExpiresAt();

    // 4) 단일 트랜잭션: 기존 PENDING revoke → 새 Invitation + InvitationRole 생성.
    //    isolation 은 default(Read Committed) 사용 — "마지막 CO" 같은 cross-row 불변식이 없고,
    //    유일 제약은 랜덤 tokenHash 뿐이라 Serializable 이 필요하지 않다(불필요한 직렬화 비용 회피).
    const created = await prisma.$transaction(async (tx) => {
      await tx.invitation.updateMany({
        where: { companyId, email, status: "PENDING" },
        data: { status: "REVOKED", revokedAt: new Date() },
      });

      return tx.invitation.create({
        data: {
          companyId,
          email,
          tokenHash,
          invitedByUserId: actor.id,
          expiresAt,
          roles: {
            create: desired.map((item) => ({
              scopeType: item.scopeType,
              scopeId: item.scopeId,
              role: item.role,
            })),
          },
        },
        include: {
          roles: { select: { scopeType: true, scopeId: true, role: true } },
          invitedBy: { select: { name: true, email: true } },
        },
      });
    });

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    const dto = serializeInvitation(created, Boolean(existingUser));

    return apiSuccess({ invitation: dto, inviteUrl: buildInviteUrl(token) }, { status: 201 });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("초대 생성에 실패했습니다.", 500, "INVITE_CREATE_FAILED");
  }
}

/**
 * c8-1: Company 초대 목록.
 * GET /api/company/invitations
 * - CO 만 접근. 현재 Company 초대만 최신순 반환.
 * - 만료된 PENDING 은 조회 전에 EXPIRED 로 updateMany(상태 정합성 유지 — 보고서 §6 참고).
 * - tokenHash/raw token/passwordHash 는 절대 반환하지 않는다.
 */
export async function GET() {
  try {
    const { companyId } = await requireCompanyOwner();

    // 만료 처리(update-on-read): 만료된 PENDING → EXPIRED.
    await prisma.invitation.updateMany({
      where: { companyId, status: "PENDING", expiresAt: { lt: new Date() } },
      data: { status: "EXPIRED" },
    });

    const invitations = await prisma.invitation.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      include: {
        roles: { select: { scopeType: true, scopeId: true, role: true } },
        invitedBy: { select: { name: true, email: true } },
      },
    });

    // existingUser 일괄 조회(초대 email 들에 대응하는 User).
    const emails = Array.from(new Set(invitations.map((invitation) => invitation.email)));
    const existingUsers = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { email: true },
    });
    const existingEmailSet = new Set(existingUsers.map((user) => user.email));

    const items: CompanyInvitationDto[] = invitations.map((invitation) =>
      serializeInvitation(invitation, existingEmailSet.has(invitation.email)),
    );

    return apiSuccess({ companyId, invitations: items });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("초대 목록을 불러오지 못했습니다.", 500, "INVITE_LIST_FAILED");
  }
}

type InvitationWithRelations = Prisma.InvitationGetPayload<{
  include: {
    roles: { select: { scopeType: true; scopeId: true; role: true } };
    invitedBy: { select: { name: true; email: true } };
  };
}>;

function serializeInvitation(
  invitation: InvitationWithRelations,
  existingUser: boolean,
): CompanyInvitationDto {
  const roles: InvitationRoleDto[] = invitation.roles.map((entry) => ({
    scopeType: entry.scopeType,
    scopeId: entry.scopeId,
    role: entry.role,
  }));

  return {
    id: invitation.id,
    email: invitation.email,
    status: invitation.status,
    invitedBy: invitation.invitedBy
      ? { name: invitation.invitedBy.name, email: invitation.invitedBy.email }
      : null,
    createdAt: invitation.createdAt.toISOString(),
    expiresAt: invitation.expiresAt.toISOString(),
    roles,
    existingUser,
  };
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}
