import { apiError, apiSuccess } from "@/lib/api/response";
import { readJsonBody, readOptionalTrimmedString } from "@/lib/api/request";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireProjectAccess,
} from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import {
  findRunByIdOrSlug,
  findRunResultByIdOrCode,
  mapResultToDto,
  parseResultStatus,
  toDbResultStatus,
} from "@/lib/test-runs/test-run-api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ projectId: string; runId: string; resultId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { projectId, runId, resultId } = await context.params;
    const { project } = await requireProjectAccess(projectId, "update");

    const run = await findRunByIdOrSlug(project.id, runId);

    if (!run) {
      return apiError("테스트 실행을 찾을 수 없습니다.", 404, "TEST_RUN_NOT_FOUND");
    }

    const result = await findRunResultByIdOrCode(run.id, resultId);

    if (!result) {
      return apiError("테스트 실행 결과를 찾을 수 없습니다.", 404, "TEST_RUN_RESULT_NOT_FOUND");
    }

    const body = await readJsonBody(request);
    const data: {
      status?: ReturnType<typeof toDbResultStatus>;
      actualResult?: string;
    } = {};

    if (body.status !== undefined) {
      const status = parseResultStatus(body.status);

      if (!status) {
        return apiError("지원하지 않는 실행 결과 상태입니다.", 400, "RESULT_STATUS_INVALID");
      }

      data.status = toDbResultStatus(status);
    }

    const actualResult = readOptionalTrimmedString(body.actualResult);

    if (actualResult !== undefined) {
      data.actualResult = actualResult;
    }

    const updatedResult = await prisma.$transaction(async (tx) => {
      if (run.status === "PLANNED") {
        await tx.testRun.update({
          where: { id: run.id },
          data: { status: "IN_PROGRESS" },
        });
      }

      return tx.testRunResult.update({
        where: { id: result.id },
        data,
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
      });
    });

    return apiSuccess(mapResultToDto(updatedResult));
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("테스트 실행 결과를 저장하지 못했습니다.", 500, "RESULT_UPDATE_FAILED");
  }
}
