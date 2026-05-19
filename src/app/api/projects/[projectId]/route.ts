import { apiError, apiSuccess } from "@/lib/api/response";
import {
  ensureDefaultWorkspace,
  findProjectByIdOrSlug,
  isProjectSlugAvailable,
  mapProjectToDto,
  parseProjectStatus,
  toDbProjectStatus,
  toProjectSlug,
} from "@/lib/projects/project-api";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

type ProjectRouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function GET(_request: Request, context: ProjectRouteContext) {
  try {
    const { projectId } = await context.params;
    const workspace = await ensureDefaultWorkspace();
    const project = await findProjectByIdOrSlug(workspace.id, projectId);

    if (!project) {
      return apiError("프로젝트를 찾을 수 없습니다.", 404, "PROJECT_NOT_FOUND");
    }

    return apiSuccess(mapProjectToDto(project));
  } catch (error) {
    console.error(error);
    return apiError("프로젝트를 불러오지 못했습니다.", 500, "PROJECT_READ_FAILED");
  }
}

export async function PATCH(request: Request, context: ProjectRouteContext) {
  try {
    const { projectId } = await context.params;
    const workspace = await ensureDefaultWorkspace();
    const project = await findProjectByIdOrSlug(workspace.id, projectId);

    if (!project) {
      return apiError("프로젝트를 찾을 수 없습니다.", 404, "PROJECT_NOT_FOUND");
    }

    const body = await readJsonBody(request);
    const data: {
      name?: string;
      slug?: string;
      description?: string;
      color?: string;
      status?: ReturnType<typeof toDbProjectStatus>;
    } = {};

    const name = readTrimmedString(body.name);
    const description = readOptionalTrimmedString(body.description);
    const color = readOptionalTrimmedString(body.color);
    const requestedSlug = readOptionalTrimmedString(body.slug);
    const status = parseProjectStatus(body.status);

    if (body.name !== undefined) {
      if (!name) {
        return apiError("프로젝트 이름을 입력하세요.", 400, "PROJECT_NAME_REQUIRED");
      }

      data.name = name;
    }

    if (description !== undefined) {
      data.description = description;
    }

    if (color !== undefined) {
      data.color = color || "#2563EB";
    }

    if (body.status !== undefined) {
      if (!status) {
        return apiError("지원하지 않는 프로젝트 상태입니다.", 400, "PROJECT_STATUS_INVALID");
      }

      data.status = toDbProjectStatus(status);
    }

    if (requestedSlug !== undefined) {
      const slug = toProjectSlug(requestedSlug);
      const available = await isProjectSlugAvailable(workspace.id, slug, project.id);

      if (!available) {
        return apiError("이미 사용 중인 프로젝트 URL입니다.", 409, "PROJECT_SLUG_CONFLICT");
      }

      data.slug = slug;
    }

    const updatedProject = await prisma.project.update({
      where: { id: project.id },
      data,
    });

    return apiSuccess(mapProjectToDto(updatedProject));
  } catch (error) {
    console.error(error);
    return apiError("프로젝트를 수정하지 못했습니다.", 500, "PROJECT_UPDATE_FAILED");
  }
}

export async function DELETE(_request: Request, context: ProjectRouteContext) {
  try {
    const { projectId } = await context.params;
    const workspace = await ensureDefaultWorkspace();
    const project = await findProjectByIdOrSlug(workspace.id, projectId);

    if (!project) {
      return apiError("프로젝트를 찾을 수 없습니다.", 404, "PROJECT_NOT_FOUND");
    }

    await prisma.project.delete({
      where: { id: project.id },
    });

    return apiSuccess({ id: project.slug });
  } catch (error) {
    console.error(error);
    return apiError("프로젝트를 삭제하지 못했습니다.", 500, "PROJECT_DELETE_FAILED");
  }
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function readTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
}
