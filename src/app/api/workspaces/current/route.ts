import { apiError, apiSuccess } from "@/lib/api/response";
import { readJsonBody, readOptionalTrimmedString } from "@/lib/api/request";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireCurrentWorkspace,
  requirePermission,
} from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import {
  mapWorkspaceToDto,
  toWorkspaceSlug,
} from "@/lib/workspaces/workspace-api";

export const runtime = "nodejs";

export async function GET() {
  try {
    const auth = await requireCurrentWorkspace();
    requirePermission(auth, "read");

    return apiSuccess(mapWorkspaceToDto(auth.workspace));
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("워크스페이스 정보를 불러오지 못했습니다.", 500, "WORKSPACE_READ_FAILED");
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireCurrentWorkspace();
    requirePermission(auth, "update");

    const body = await readJsonBody(request);
    const name = readOptionalTrimmedString(body.name);
    const slugInput = readOptionalTrimmedString(body.slug);
    const timezone = readOptionalTrimmedString(body.timezone);
    const logoUrl = readOptionalTrimmedString(body.logoUrl);
    const data: {
      name?: string;
      slug?: string;
      timezone?: string;
      logoUrl?: string | null;
    } = {};

    if (name !== undefined) {
      if (!name) {
        return apiError("워크스페이스 이름을 입력하세요.", 400, "WORKSPACE_NAME_REQUIRED");
      }

      data.name = name;
    }

    if (slugInput !== undefined) {
      const slug = toWorkspaceSlug(slugInput);

      if (!slug) {
        return apiError("워크스페이스 URL slug를 입력하세요.", 400, "WORKSPACE_SLUG_REQUIRED");
      }

      const slugOwner = await prisma.workspace.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (slugOwner && slugOwner.id !== auth.workspace.id) {
        return apiError("이미 사용 중인 워크스페이스 URL입니다.", 409, "WORKSPACE_SLUG_CONFLICT");
      }

      data.slug = slug;
    }

    if (timezone !== undefined) {
      data.timezone = timezone || "Asia/Seoul";
    }

    if (logoUrl !== undefined) {
      data.logoUrl = logoUrl || null;
    }

    const updatedWorkspace = await prisma.workspace.update({
      where: { id: auth.workspace.id },
      data,
    });

    return apiSuccess(mapWorkspaceToDto(updatedWorkspace));
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("워크스페이스 정보를 저장하지 못했습니다.", 500, "WORKSPACE_UPDATE_FAILED");
  }
}
