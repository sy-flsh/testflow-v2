import { apiError, apiSuccess } from "@/lib/api/response";
import { getUserWorkspaces, mapAuthPayload, resolveActiveMembership } from "@/lib/auth/me";
import { getRolesByScope, resolveWorkspaceAuthRole } from "@/lib/auth/roles";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return apiError("로그인이 필요합니다.", 401, "AUTH_UNAUTHORIZED");
    }

    const membership = await resolveActiveMembership(session.userId, session.selectedWorkspaceId);

    if (!membership) {
      return apiError("활성 워크스페이스 멤버십을 찾을 수 없습니다.", 401, "AUTH_UNAUTHORIZED");
    }

    if (session.selectedWorkspaceId !== membership.workspaceId) {
      await prisma.session.update({
        where: { id: session.id },
        data: { selectedWorkspaceId: membership.workspaceId },
      });
    }

    const workspaces = await getUserWorkspaces(session.userId);
    const rolesByScope = await getRolesByScope(session.userId);
    // c5-2: 기존 role/permissions 계산도 UserRole(WORKSPACE) 우선으로 전환.
    // 값 자체는 Admin/Member/Viewer 그대로 유지(계약 불변), 산출 근거만 UserRole 우선.
    const workspaceAuthRole = await resolveWorkspaceAuthRole(
      session.userId,
      membership.workspaceId,
      membership.role,
    );

    return apiSuccess(
      mapAuthPayload({
        user: session.user,
        workspace: membership.workspace,
        role: membership.role,
        authRole: workspaceAuthRole,
        workspaces,
        rolesByScope,
      }),
    );
  } catch (error) {
    console.error(error);
    return apiError("현재 사용자 정보를 불러오지 못했습니다.", 500, "AUTH_ME_FAILED");
  }
}
