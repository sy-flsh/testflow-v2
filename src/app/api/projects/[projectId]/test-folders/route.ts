import { apiError, apiSuccess } from "@/lib/api/response";
import {
  readJsonBody,
  readOptionalTrimmedString,
  readTrimmedString,
} from "@/lib/api/request";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireProjectAccess,
} from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import {
  createUniqueFolderSlug,
  findFolderByIdOrSlug,
  mapFoldersToDto,
} from "@/lib/testcases/testcase-api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const { project } = await requireProjectAccess(projectId, "read");

    const folders = await prisma.testFolder.findMany({
      where: {
        projectId: project.id,
        deletedAt: null,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    return apiSuccess(mapFoldersToDto(folders));
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("테스트 폴더 목록을 불러오지 못했습니다.", 500, "TEST_FOLDER_LIST_FAILED");
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const { project } = await requireProjectAccess(projectId, "create");

    const body = await readJsonBody(request);
    const name = readTrimmedString(body.name ?? body.label);

    if (!name) {
      return apiError("폴더 이름을 입력하세요.", 400, "TEST_FOLDER_NAME_REQUIRED");
    }

    const parentKey = readOptionalTrimmedString(body.parentId);
    const parentFolder = parentKey
      ? await findFolderByIdOrSlug(project.id, parentKey)
      : null;

    if (parentKey && !parentFolder) {
      return apiError("상위 폴더를 찾을 수 없습니다.", 404, "TEST_FOLDER_PARENT_NOT_FOUND");
    }

    const slug = await createUniqueFolderSlug(
      project.id,
      readTrimmedString(body.slug) || name,
    );

    const maxSortOrder = await prisma.testFolder.aggregate({
      where: { projectId: project.id },
      _max: { sortOrder: true },
    });

    const folder = await prisma.testFolder.create({
      data: {
        projectId: project.id,
        parentId: parentFolder?.id,
        slug,
        name,
        sortOrder: (maxSortOrder._max.sortOrder ?? 0) + 10,
      },
    });

    const folders = await prisma.testFolder.findMany({
      where: { projectId: project.id, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    return apiSuccess(mapFoldersToDto(folders).find((item) => item.databaseId === folder.id), {
      status: 201,
    });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("테스트 폴더를 생성하지 못했습니다.", 500, "TEST_FOLDER_CREATE_FAILED");
  }
}
