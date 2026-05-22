import { apiError, apiSuccess } from "@/lib/api/response";
import { ensureDefaultWorkspace } from "@/lib/projects/project-api";
import { prisma } from "@/lib/db/prisma";
import { mapWorkspaceMemberToDto } from "@/lib/workspaces/workspace-api";

export const runtime = "nodejs";

export async function GET() {
  try {
    const workspace = await ensureDefaultWorkspace();
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      include: { user: true },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });

    return apiSuccess(members.map(mapWorkspaceMemberToDto));
  } catch (error) {
    console.error(error);
    return apiError("워크스페이스 멤버를 불러오지 못했습니다.", 500, "WORKSPACE_MEMBERS_READ_FAILED");
  }
}
