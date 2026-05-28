import { apiError, apiSuccess } from "@/lib/api/response";
import { readJsonBody, readOptionalTrimmedString, readTrimmedString } from "@/lib/api/request";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireProjectAccess,
} from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { enforceCsrfProtection } from "@/lib/security/csrf";
import {
  findRunByIdOrSlug,
  mapRunToDto,
  parseDateInput,
  parseRunStatus,
  testRunInclude,
  toDbRunStatus,
} from "@/lib/test-runs/test-run-api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ projectId: string; runId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { projectId, runId } = await context.params;
    const { project } = await requireProjectAccess(projectId, "read");

    const run = await findRunByIdOrSlug(project.id, runId);

    if (!run) {
      return apiError("테스트 실행을 찾을 수 없습니다.", 404, "TEST_RUN_NOT_FOUND");
    }

    return apiSuccess(mapRunToDto(run));
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("테스트 실행을 불러오지 못했습니다.", 500, "TEST_RUN_READ_FAILED");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const csrfError = enforceCsrfProtection(request);

    if (csrfError) {
      return csrfError;
    }

    const { projectId, runId } = await context.params;
    const { project } = await requireProjectAccess(projectId, "update");

    const run = await findRunByIdOrSlug(project.id, runId);

    if (!run) {
      return apiError("테스트 실행을 찾을 수 없습니다.", 404, "TEST_RUN_NOT_FOUND");
    }

    const body = await readJsonBody(request);
    const data: {
      title?: string;
      description?: string;
      assigneeName?: string;
      environment?: string;
      startDate?: Date;
      dueDate?: Date;
      status?: ReturnType<typeof toDbRunStatus>;
    } = {};

    const title = readTrimmedString(body.title);

    if (body.title !== undefined) {
      if (!title) {
        return apiError("테스트 플랜 이름을 입력하세요.", 400, "TEST_RUN_TITLE_REQUIRED");
      }

      data.title = title;
    }

    const description = readOptionalTrimmedString(body.description);
    const assignee = readOptionalTrimmedString(body.assignee);
    const environment = readOptionalTrimmedString(body.environment);

    if (description !== undefined) {
      data.description = description;
    }

    if (assignee !== undefined) {
      data.assigneeName = assignee || "김QA";
    }

    if (environment !== undefined) {
      data.environment = environment || "QA Server";
    }

    if (body.startDate !== undefined) {
      data.startDate = parseDateInput(body.startDate, run.startDate);
    }

    if (body.dueDate !== undefined) {
      data.dueDate = parseDateInput(body.dueDate, run.dueDate);
    }

    if (body.status !== undefined) {
      const status = parseRunStatus(body.status);

      if (!status) {
        return apiError("지원하지 않는 테스트 실행 상태입니다.", 400, "TEST_RUN_STATUS_INVALID");
      }

      data.status = toDbRunStatus(status);
    }

    const updatedRun = await prisma.testRun.update({
      where: { id: run.id },
      data,
      include: testRunInclude,
    });

    return apiSuccess(mapRunToDto(updatedRun));
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("테스트 실행을 수정하지 못했습니다.", 500, "TEST_RUN_UPDATE_FAILED");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const csrfError = enforceCsrfProtection(request);

    if (csrfError) {
      return csrfError;
    }

    const { projectId, runId } = await context.params;
    const { project } = await requireProjectAccess(projectId, "delete");

    const run = await findRunByIdOrSlug(project.id, runId);

    if (!run) {
      return apiError("테스트 실행을 찾을 수 없습니다.", 404, "TEST_RUN_NOT_FOUND");
    }

    await prisma.testRun.update({
      where: { id: run.id },
      data: { deletedAt: new Date() },
    });

    return apiSuccess({ id: run.slug });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("테스트 실행을 삭제하지 못했습니다.", 500, "TEST_RUN_DELETE_FAILED");
  }
}
