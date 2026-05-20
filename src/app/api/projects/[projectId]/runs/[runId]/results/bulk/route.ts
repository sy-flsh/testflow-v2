import { apiError, apiSuccess } from "@/lib/api/response";
import { readJsonBody, readStringArray } from "@/lib/api/request";
import { prisma } from "@/lib/db/prisma";
import {
  findProjectForRunApi,
  findRunByIdOrSlug,
  mapResultToDto,
  parseResultStatus,
  toDbResultStatus,
} from "@/lib/test-runs/test-run-api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ projectId: string; runId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { projectId, runId } = await context.params;
    const project = await findProjectForRunApi(projectId);

    if (!project) {
      return apiError("프로젝트를 찾을 수 없습니다.", 404, "PROJECT_NOT_FOUND");
    }

    const run = await findRunByIdOrSlug(project.id, runId);

    if (!run) {
      return apiError("테스트 실행을 찾을 수 없습니다.", 404, "TEST_RUN_NOT_FOUND");
    }

    const body = await readJsonBody(request);
    const ids = readStringArray(body.ids);
    const status = parseResultStatus(body.status);

    if (ids.length === 0) {
      return apiError("변경할 실행 결과를 선택하세요.", 400, "RESULT_BULK_IDS_REQUIRED");
    }

    if (!status) {
      return apiError("지원하지 않는 실행 결과 상태입니다.", 400, "RESULT_STATUS_INVALID");
    }

    const results = await prisma.testRunResult.findMany({
      where: {
        runId: run.id,
        OR: [{ id: { in: ids } }, { code: { in: ids } }],
      },
    });

    const updatedResults = await prisma.$transaction(
      results.map((result) =>
        prisma.testRunResult.update({
          where: { id: result.id },
          data: { status: toDbResultStatus(status) },
          include: {
            testCase: {
              include: {
                folder: true,
                steps: {
                  orderBy: { order: "asc" },
                },
              },
            },
          },
        }),
      ),
    );

    return apiSuccess(updatedResults.map(mapResultToDto));
  } catch (error) {
    console.error(error);
    return apiError("테스트 실행 결과 일괄 변경에 실패했습니다.", 500, "RESULT_BULK_UPDATE_FAILED");
  }
}
