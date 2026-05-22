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
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

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

  if (session.selectedWorkspaceId !== membership.workspaceId) {
    await prisma.session.update({
      where: { id: session.id },
      data: { selectedWorkspaceId: membership.workspaceId },
    });
  }

  const role = toAuthRole(membership.role);

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

  requirePermission(auth, action);

  return {
    ...auth,
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
