import type { Role, ScopeType } from "@prisma/client";
import { apiError, apiSuccess } from "@/lib/api/response";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireCompanyOwner,
} from "@/lib/auth/guards";
import { isAssignableRole, isRoleAllowedForScope } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import { enforceCsrfProtection } from "@/lib/security/csrf";

export const runtime = "nodejs";

const SCOPE_TYPES: ScopeType[] = ["COMPANY", "WORKSPACE", "PROJECT"];
const ROLES: Role[] = ["MASTER", "CO", "WO", "PO", "MEMBER", "VIEWER"];

type RouteContext = {
  params: Promise<{ userId: string }>;
};

type DesiredRole = {
  scopeType: ScopeType;
  scopeId: string;
  role: Role;
};

/**
 * c6-1: CO Role 매트릭스 sync API 기반.
 * POST /api/company/users/{userId}/roles/sync
 * body: { roles: [{ scopeType, scopeId, role }] }
 *
 * 호출자(CO)가 소속한 Company 범위 안에서, 대상 사용자의 UserRole 을 body 기준으로 동기화한다.
 * (body 에 없는 회사-범위 Role 은 제거, 있는 Role 은 upsert) — 단일 트랜잭션.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const csrfError = enforceCsrfProtection(request);

    if (csrfError) {
      return csrfError;
    }

    const { user: actor, companyId } = await requireCompanyOwner();
    const { userId: targetUserId } = await context.params;

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });

    if (!target) {
      return apiError("대상 사용자를 찾을 수 없습니다.", 404, "USER_NOT_FOUND");
    }

    const body = await readJsonBody(request);
    const rawRoles = Array.isArray(body.roles) ? body.roles : null;

    if (!rawRoles) {
      return apiError("roles 배열이 필요합니다.", 400, "USER_ROLES_REQUIRED");
    }

    // 1) 형식 + scope-role 정합성 + 중복(라디오) 검증
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
        return apiError(
          "허용되지 않은 Role/Scope 조합입니다.",
          400,
          "USER_INVALID_ROLE_SCOPE",
        );
      }

      const dedupeKey = `${scopeType}:${scopeId}`;

      if (seenScopes.has(dedupeKey)) {
        return apiError(
          "동일 scope 에 중복된 Role 이 있습니다.",
          400,
          "USER_DUPLICATE_SCOPE",
        );
      }

      seenScopes.add(dedupeKey);
      desired.push({ scopeType, scopeId, role });
    }

    // 2) scope 소속 검증: 모든 scopeId 가 현재 Company 소속이어야 함
    const companyWorkspaces = await prisma.workspace.findMany({
      where: { companyId },
      select: { id: true },
    });
    const workspaceIds = companyWorkspaces.map((workspace) => workspace.id);
    const workspaceIdSet = new Set(workspaceIds);

    const companyProjects = await prisma.project.findMany({
      where: { workspace: { companyId } },
      select: { id: true },
    });
    const projectIds = companyProjects.map((project) => project.id);
    const projectIdSet = new Set(projectIds);

    for (const item of desired) {
      const inCompany =
        item.scopeType === "COMPANY"
          ? item.scopeId === companyId
          : item.scopeType === "WORKSPACE"
            ? workspaceIdSet.has(item.scopeId)
            : projectIdSet.has(item.scopeId);

      if (!inCompany) {
        return apiError(
          "현재 Company 소속이 아닌 scope 입니다.",
          400,
          "USER_SCOPE_NOT_IN_COMPANY",
        );
      }
    }

    // 3) 보호 규칙: 마지막 CO / 본인 CO 회수 금지
    const desiredKeepsCompanyCo = desired.some(
      (item) =>
        item.scopeType === "COMPANY" && item.scopeId === companyId && item.role === "CO",
    );

    const targetCurrentCompanyRole = await prisma.userRole.findUnique({
      where: {
        userId_scopeType_scopeId: {
          userId: targetUserId,
          scopeType: "COMPANY",
          scopeId: companyId,
        },
      },
      select: { role: true },
    });
    const targetIsCoNow = targetCurrentCompanyRole?.role === "CO";

    if (targetIsCoNow && !desiredKeepsCompanyCo) {
      if (actor.id === targetUserId) {
        return apiError(
          "본인 CO 권한은 회수할 수 없습니다. (다른 CO가 회수해야 합니다)",
          400,
          "USER_SELF_CO_REVOKE_FORBIDDEN",
        );
      }

      const coCount = await prisma.userRole.count({
        where: { scopeType: "COMPANY", scopeId: companyId, role: "CO" },
      });

      if (coCount <= 1) {
        return apiError(
          "Company 의 마지막 CO 는 회수할 수 없습니다.",
          400,
          "USER_LAST_CO_FORBIDDEN",
        );
      }
    }

    // 4) 트랜잭션: 회사 범위 내 기존 Role 제거 후 desired 로 재구성
    await prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({
        where: {
          userId: targetUserId,
          OR: [
            { scopeType: "COMPANY", scopeId: companyId },
            { scopeType: "WORKSPACE", scopeId: { in: workspaceIds } },
            { scopeType: "PROJECT", scopeId: { in: projectIds } },
          ],
        },
      });

      if (desired.length > 0) {
        await tx.userRole.createMany({
          data: desired.map((item) => ({
            userId: targetUserId,
            scopeType: item.scopeType,
            scopeId: item.scopeId,
            role: item.role,
          })),
        });
      }
    });

    const roles = await prisma.userRole.findMany({
      where: { userId: targetUserId },
      select: { scopeType: true, scopeId: true, role: true },
      orderBy: [{ scopeType: "asc" }, { role: "asc" }],
    });

    return apiSuccess({ userId: targetUserId, companyId, roles });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("Role 동기화에 실패했습니다.", 500, "USER_ROLE_SYNC_FAILED");
  }
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}
