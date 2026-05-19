import { apiError, apiSuccess } from "@/lib/api/response";
import { readJsonBody, readStringArray, readTrimmedString } from "@/lib/api/request";
import { prisma } from "@/lib/db/prisma";
import {
  findFolderByIdOrSlug,
  findProjectForTestCaseApi,
  mapTestCaseToDto,
  parsePriority,
  parseTestCaseStatus,
  testCaseInclude,
  toDbPriority,
  toDbTestCaseStatus,
} from "@/lib/testcases/testcase-api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const project = await findProjectForTestCaseApi(projectId);

    if (!project) {
      return apiError("프로젝트를 찾을 수 없습니다.", 404, "PROJECT_NOT_FOUND");
    }

    const body = await readJsonBody(request);
    const ids = readStringArray(body.ids);

    if (ids.length === 0) {
      return apiError("변경할 테스트케이스를 선택하세요.", 400, "TEST_CASE_BULK_IDS_REQUIRED");
    }

    const data: {
      folderId?: string;
      priority?: ReturnType<typeof toDbPriority>;
      status?: ReturnType<typeof toDbTestCaseStatus>;
    } = {};

    if (body.folderId !== undefined) {
      const folder = await findFolderByIdOrSlug(project.id, readTrimmedString(body.folderId));

      if (!folder) {
        return apiError("테스트케이스 폴더를 찾을 수 없습니다.", 404, "TEST_CASE_FOLDER_NOT_FOUND");
      }

      data.folderId = folder.id;
    }

    if (body.priority !== undefined) {
      const priority = parsePriority(body.priority);

      if (!priority) {
        return apiError("지원하지 않는 우선순위입니다.", 400, "TEST_CASE_PRIORITY_INVALID");
      }

      data.priority = toDbPriority(priority);
    }

    if (body.status !== undefined) {
      const status = parseTestCaseStatus(body.status);

      if (!status) {
        return apiError("지원하지 않는 테스트케이스 상태입니다.", 400, "TEST_CASE_STATUS_INVALID");
      }

      data.status = toDbTestCaseStatus(status);
    }

    const tags = body.tags !== undefined ? readStringArray(body.tags) : null;
    const tagsAction = body.tagsAction === "append" ? "append" : "replace";
    const testCases = await prisma.testCase.findMany({
      where: {
        projectId: project.id,
        deletedAt: null,
        OR: [{ id: { in: ids } }, { code: { in: ids } }],
      },
    });

    const updatedTestCases = await prisma.$transaction(
      testCases.map((testCase) =>
        prisma.testCase.update({
          where: { id: testCase.id },
          data: {
            ...data,
            ...(tags
              ? {
                  tags:
                    tagsAction === "append"
                      ? Array.from(new Set([...testCase.tags, ...tags]))
                      : tags,
                }
              : {}),
          },
          include: testCaseInclude,
        }),
      ),
    );

    return apiSuccess(updatedTestCases.map(mapTestCaseToDto));
  } catch (error) {
    console.error(error);
    return apiError("테스트케이스 일괄 변경에 실패했습니다.", 500, "TEST_CASE_BULK_UPDATE_FAILED");
  }
}
