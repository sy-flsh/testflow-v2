import { apiError, apiSuccess } from "@/lib/api/response";
import { getUserWorkspaces, mapAuthPayload, resolveActiveMembership } from "@/lib/auth/me";
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

    return apiSuccess(
      mapAuthPayload({
        user: session.user,
        workspace: membership.workspace,
        role: membership.role,
        workspaces,
      }),
    );
  } catch (error) {
    console.error(error);
    return apiError("현재 사용자 정보를 불러오지 못했습니다.", 500, "AUTH_ME_FAILED");
  }
}
