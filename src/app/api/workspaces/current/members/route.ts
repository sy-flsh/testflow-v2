import { apiError, apiSuccess } from "@/lib/api/response";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireCurrentWorkspace,
  requirePermission,
} from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { mapWorkspaceMemberToDto } from "@/lib/workspaces/workspace-api";

export const runtime = "nodejs";

export async function GET() {
  try {
    const auth = await requireCurrentWorkspace();
    requirePermission(auth, "read");

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: auth.workspace.id },
      include: { user: true },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });

    return apiSuccess(members.map(mapWorkspaceMemberToDto));
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("워크스페이스 멤버를 불러오지 못했습니다.", 500, "WORKSPACE_MEMBERS_READ_FAILED");
  }
}
