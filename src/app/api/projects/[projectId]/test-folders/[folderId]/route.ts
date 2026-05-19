import { apiError, apiSuccess } from "@/lib/api/response";
import {
  readJsonBody,
  readOptionalTrimmedString,
  readTrimmedString,
} from "@/lib/api/request";
import { prisma } from "@/lib/db/prisma";
import {
  findFolderByIdOrSlug,
  findProjectForTestCaseApi,
  mapFoldersToDto,
} from "@/lib/testcases/testcase-api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ projectId: string; folderId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { projectId, folderId } = await context.params;
    const project = await findProjectForTestCaseApi(projectId);

    if (!project) {
      return apiError("프로젝트를 찾을 수 없습니다.", 404, "PROJECT_NOT_FOUND");
    }

    const folder = await findFolderByIdOrSlug(project.id, folderId);

    if (!folder) {
      return apiError("테스트 폴더를 찾을 수 없습니다.", 404, "TEST_FOLDER_NOT_FOUND");
    }

    const body = await readJsonBody(request);
    const data: { name?: string; parentId?: string | null } = {};
    const name = readTrimmedString(body.name ?? body.label);
    const parentKey = readOptionalTrimmedString(body.parentId);

    if (body.name !== undefined || body.label !== undefined) {
      if (!name) {
        return apiError("폴더 이름을 입력하세요.", 400, "TEST_FOLDER_NAME_REQUIRED");
      }

      data.name = name;
    }

    if (body.parentId !== undefined) {
      if (!parentKey) {
        data.parentId = null;
      } else {
        const parentFolder = await findFolderByIdOrSlug(project.id, parentKey);

        if (!parentFolder) {
          return apiError("상위 폴더를 찾을 수 없습니다.", 404, "TEST_FOLDER_PARENT_NOT_FOUND");
        }

        if (parentFolder.id === folder.id) {
          return apiError("자기 자신을 상위 폴더로 지정할 수 없습니다.", 400, "TEST_FOLDER_PARENT_INVALID");
        }

        data.parentId = parentFolder.id;
      }
    }

    await prisma.testFolder.update({
      where: { id: folder.id },
      data,
    });

    const folders = await prisma.testFolder.findMany({
      where: { projectId: project.id, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    return apiSuccess(mapFoldersToDto(folders).find((item) => item.databaseId === folder.id));
  } catch (error) {
    console.error(error);
    return apiError("테스트 폴더를 수정하지 못했습니다.", 500, "TEST_FOLDER_UPDATE_FAILED");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { projectId, folderId } = await context.params;
    const project = await findProjectForTestCaseApi(projectId);

    if (!project) {
      return apiError("프로젝트를 찾을 수 없습니다.", 404, "PROJECT_NOT_FOUND");
    }

    const folder = await findFolderByIdOrSlug(project.id, folderId);

    if (!folder) {
      return apiError("테스트 폴더를 찾을 수 없습니다.", 404, "TEST_FOLDER_NOT_FOUND");
    }

    const [childCount, testCaseCount] = await Promise.all([
      prisma.testFolder.count({
        where: { projectId: project.id, parentId: folder.id, deletedAt: null },
      }),
      prisma.testCase.count({
        where: { projectId: project.id, folderId: folder.id, deletedAt: null },
      }),
    ]);

    if (childCount > 0 || testCaseCount > 0) {
      return apiError("하위 폴더 또는 테스트케이스가 있는 폴더는 삭제할 수 없습니다.", 409, "TEST_FOLDER_NOT_EMPTY");
    }

    await prisma.testFolder.update({
      where: { id: folder.id },
      data: { deletedAt: new Date() },
    });

    return apiSuccess({ id: folder.slug });
  } catch (error) {
    console.error(error);
    return apiError("테스트 폴더를 삭제하지 못했습니다.", 500, "TEST_FOLDER_DELETE_FAILED");
  }
}
