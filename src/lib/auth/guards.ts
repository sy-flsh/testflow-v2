import type {
  MemberRole,
  Project,
  User,
  Workspace,
  WorkspaceMember,
} from "@prisma/client";
import { apiError } from "@/lib/api/response";
import {
  buildPermissions,
  resolveActiveMembership,
  toAuthRole,
  type AuthRole,
} from "@/lib/auth/me";
import {
  getCompaniesWhereUserIsCO,
  resolveProjectAuthRole,
  resolveWorkspaceAuthRole,
} from "@/lib/auth/roles";
import { getCurrentSession } from "@/lib/auth/session";
import {
  getInactiveCompanyIdsAmong,
  isCompanyUserActive,
} from "@/lib/company/company-user-state";
import { prisma } from "@/lib/db/prisma";
import { recordSecurityAuditEvent } from "@/lib/security/audit-log";

export type PermissionAction = "read" | "create" | "update" | "delete" | "danger";

export type CurrentWorkspaceAuth = {
  user: User;
  workspace: Workspace;
  membership: WorkspaceMember & { workspace: Workspace };
  role: AuthRole;
  permissions: ReturnType<typeof buildPermissions>;
};

export type CurrentProjectAuth = CurrentWorkspaceAuth & {
  project: Project;
};

export class AuthGuardError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "AuthGuardError";
  }
}

export function isAuthGuardError(error: unknown): error is AuthGuardError {
  return error instanceof AuthGuardError;
}

export function authGuardErrorResponse(error: AuthGuardError) {
  return apiError(error.message, error.status, error.code);
}

export async function requireCurrentUser() {
  const session = await getCurrentSession();

  if (!session) {
    throw new AuthGuardError("로그인이 필요합니다.", 401, "AUTH_UNAUTHORIZED");
  }

  return session.user;
}

export type CompanyOwnerAuth = {
  user: User;
  companyId: string;
};

/**
 * c6-1: 현재 로그인 사용자가 CO(Company Owner)인지 확인하고, 그 Company id 를 반환한다.
 * UserRole COMPANY/CO 기준(WorkspaceMember.role 과 무관). CO 가 아니면 403.
 * 다중 Company CO disambiguation 은 c6-2 — 현재는 단일 demo Company 가정으로 첫 Company 사용.
 */
export async function requireCompanyOwner(): Promise<CompanyOwnerAuth> {
  const session = await getCurrentSession();

  if (!session) {
    throw new AuthGuardError("로그인이 필요합니다.", 401, "AUTH_UNAUTHORIZED");
  }

  const companyIds = await getCompaniesWhereUserIsCO(session.userId);

  if (companyIds.length === 0) {
    throw new AuthGuardError("Company 소유자(CO) 권한이 필요합니다.", 403, "AUTH_FORBIDDEN");
  }

  // c9-1: INACTIVE 인 Company 의 CO 는 인정하지 않는다. ACTIVE 인 첫 Company 를 사용.
  const inactiveCompanyIds = await getInactiveCompanyIdsAmong(session.userId, companyIds);
  const activeCompanyId = companyIds.find((id) => !inactiveCompanyIds.has(id));

  if (!activeCompanyId) {
    recordSecurityAuditEvent({
      eventType: "INACTIVE_COMPANY_ACCESS_DENIED",
      targetUserId: session.userId,
      companyId: companyIds[0],
      guardName: "requireCompanyOwner",
    });
    throw new AuthGuardError(
      "이 Company에서 비활성화된 사용자입니다.",
      403,
      "USER_INACTIVE",
    );
  }

  return { user: session.user, companyId: activeCompanyId };
}

export async function requireCurrentWorkspace(): Promise<CurrentWorkspaceAuth> {
  const session = await getCurrentSession();

  if (!session) {
    throw new AuthGuardError("로그인이 필요합니다.", 401, "AUTH_UNAUTHORIZED");
  }

  const membership = await resolveActiveMembership(
    session.userId,
    session.selectedWorkspaceId,
  );

  if (!membership) {
    throw new AuthGuardError(
      "활성 워크스페이스 멤버십을 찾을 수 없습니다.",
      403,
      "WORKSPACE_REQUIRED",
    );
  }

  // c9-1: 선택/활성 워크스페이스의 상위 Company 에서 비활성화된 사용자면 차단.
  if (
    membership.workspace.companyId &&
    !(await isCompanyUserActive(membership.workspace.companyId, session.userId))
  ) {
    recordSecurityAuditEvent({
      eventType: "INACTIVE_COMPANY_ACCESS_DENIED",
      targetUserId: session.userId,
      companyId: membership.workspace.companyId,
      guardName: "requireCurrentWorkspace",
    });
    throw new AuthGuardError("이 Company에서 비활성화된 사용자입니다.", 403, "USER_INACTIVE");
  }

  if (session.selectedWorkspaceId !== membership.workspaceId) {
    await prisma.session.update({
      where: { id: session.id },
      data: { selectedWorkspaceId: membership.workspaceId },
    });
  }

  // c5-2: Workspace 권한을 UserRole(WORKSPACE) 우선으로 산출. UserRole 이 없으면
  // 전환 기간 한정 fallback 으로 membership.role(WorkspaceMember.role)을 사용한다.
  const role = await resolveWorkspaceAuthRole(
    session.userId,
    membership.workspaceId,
    membership.role,
  );

  return {
    user: session.user,
    workspace: membership.workspace,
    membership,
    role,
    permissions: buildPermissions(role),
  };
}

export async function requireProjectAccess(
  projectId: string,
  action: PermissionAction = "read",
): Promise<CurrentProjectAuth> {
  const auth = await requireCurrentWorkspace();
  const project = await prisma.project.findFirst({
    where: {
      workspaceId: auth.workspace.id,
      OR: [{ id: projectId }, { slug: projectId }],
    },
  });

  if (!project) {
    throw new AuthGuardError(
      "프로젝트를 찾을 수 없습니다.",
      404,
      "PROJECT_NOT_FOUND",
    );
  }

  // c5-2: PROJECT scope UserRole 이 있으면 우선 사용하고, 없으면 상위 Workspace 권한으로
  // fallback 한다. 현재 PROJECT UserRole 데이터가 없으므로 기존 동작과 동일하다(workspace-level).
  const projectRole = await resolveProjectAuthRole(
    auth.user.id,
    project.id,
    auth.role,
  );
  const projectPermissions = buildPermissions(projectRole);

  requirePermission({ role: projectRole, permissions: projectPermissions }, action);

  return {
    ...auth,
    role: projectRole,
    permissions: projectPermissions,
    project,
  };
}

export function requirePermission(
  auth: Pick<CurrentWorkspaceAuth, "role" | "permissions"> | AuthRole | MemberRole,
  action: PermissionAction,
) {
  const permissions =
    typeof auth === "string"
      ? buildPermissions(normalizeRole(auth))
      : auth.permissions;

  const allowed =
    action === "read"
      ? permissions.canRead
      : action === "create"
        ? permissions.canCreate
        : action === "update"
          ? permissions.canUpdate
          : action === "delete"
            ? permissions.canDelete
            : permissions.canAccessDangerZone;

  if (!allowed) {
    throw new AuthGuardError("권한이 없습니다.", 403, "AUTH_FORBIDDEN");
  }
}

function normalizeRole(role: AuthRole | MemberRole): AuthRole {
  if (role === "ADMIN" || role === "MEMBER" || role === "VIEWER") {
    return toAuthRole(role);
  }

  return role;
}
