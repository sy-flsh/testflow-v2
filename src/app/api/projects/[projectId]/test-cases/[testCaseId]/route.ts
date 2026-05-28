import { apiError, apiSuccess } from "@/lib/api/response";
import {
  readJsonBody,
  readOptionalTrimmedString,
  readStringArray,
  readTrimmedString,
} from "@/lib/api/request";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireProjectAccess,
} from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { enforceCsrfProtection } from "@/lib/security/csrf";
import {
  findFolderByIdOrSlug,
  findTestCaseByIdOrCode,
  mapTestCaseToDto,
  parsePriority,
  parseTestCaseStatus,
  replaceTestSteps,
  testCaseInclude,
  toDbPriority,
  toDbTestCaseStatus,
} from "@/lib/testcases/testcase-api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ projectId: string; testCaseId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { projectId, testCaseId } = await context.params;
    const { project } = await requireProjectAccess(projectId, "read");

    const testCase = await findTestCaseByIdOrCode(project.id, testCaseId);

    if (!testCase) {
      return apiError("테스트케이스를 찾을 수 없습니다.", 404, "TEST_CASE_NOT_FOUND");
    }

    return apiSuccess(mapTestCaseToDto(testCase));
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("테스트케이스를 불러오지 못했습니다.", 500, "TEST_CASE_READ_FAILED");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const csrfError = enforceCsrfProtection(request);

    if (csrfError) {
      return csrfError;
    }

    const { projectId, testCaseId } = await context.params;
    const { project } = await requireProjectAccess(projectId, "update");

    const testCase = await findTestCaseByIdOrCode(project.id, testCaseId);

    if (!testCase) {
      return apiError("테스트케이스를 찾을 수 없습니다.", 404, "TEST_CASE_NOT_FOUND");
    }

    const body = await readJsonBody(request);
    const data: {
      title?: string;
      folderId?: string;
      priority?: ReturnType<typeof toDbPriority>;
      status?: ReturnType<typeof toDbTestCaseStatus>;
      tags?: string[];
      authorName?: string;
      description?: string;
      preconditions?: string;
      expectedResult?: string;
      deletedAt?: Date | null;
    } = {};

    const title = readTrimmedString(body.title);

    if (body.title !== undefined) {
      if (!title) {
        return apiError("테스트케이스 제목을 입력하세요.", 400, "TEST_CASE_TITLE_REQUIRED");
      }

      data.title = title;
    }

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

    if (body.tags !== undefined) {
      data.tags = readStringArray(body.tags);
    }

    const author = readOptionalTrimmedString(body.author);
    const description = readOptionalTrimmedString(body.description);
    const preconditions = readOptionalTrimmedString(body.preconditions);
    const expectedResult = readOptionalTrimmedString(body.expectedResult);

    if (author !== undefined) {
      data.authorName = author || "김QA";
    }

    if (description !== undefined) {
      data.description = description;
    }

    if (preconditions !== undefined) {
      data.preconditions = preconditions;
    }

    if (expectedResult !== undefined) {
      data.expectedResult = expectedResult;
    }

    await prisma.testCase.update({
      where: { id: testCase.id },
      data,
    });

    if (body.steps !== undefined) {
      await replaceTestSteps(testCase.id, readStringArray(body.steps));
    }

    const updatedTestCase = await prisma.testCase.findUniqueOrThrow({
      where: { id: testCase.id },
      include: testCaseInclude,
    });

    return apiSuccess(mapTestCaseToDto(updatedTestCase));
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("테스트케이스를 수정하지 못했습니다.", 500, "TEST_CASE_UPDATE_FAILED");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const csrfError = enforceCsrfProtection(request);

    if (csrfError) {
      return csrfError;
    }

    const { projectId, testCaseId } = await context.params;
    const { project } = await requireProjectAccess(projectId, "delete");

    const testCase = await findTestCaseByIdOrCode(project.id, testCaseId);

    if (!testCase) {
      return apiError("테스트케이스를 찾을 수 없습니다.", 404, "TEST_CASE_NOT_FOUND");
    }

    await prisma.testCase.update({
      where: { id: testCase.id },
      data: { deletedAt: new Date() },
    });

    return apiSuccess({ id: testCase.code });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("테스트케이스를 삭제하지 못했습니다.", 500, "TEST_CASE_DELETE_FAILED");
  }
}
