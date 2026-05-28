import { apiError, apiSuccess } from "@/lib/api/response";
import { readJsonBody, readStringArray, readTrimmedString } from "@/lib/api/request";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireProjectAccess,
} from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { enforceCsrfProtection } from "@/lib/security/csrf";
import {
  createUniqueRunSlug,
  mapRunToDto,
  parseDateInput,
  parseRunStatus,
  testRunInclude,
  toDbRunStatus,
} from "@/lib/test-runs/test-run-api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const { project } = await requireProjectAccess(projectId, "read");

    const runs = await prisma.testRun.findMany({
      where: {
        projectId: project.id,
        deletedAt: null,
      },
      include: testRunInclude,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });

    return apiSuccess(runs.map(mapRunToDto));
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("테스트 실행 목록을 불러오지 못했습니다.", 500, "TEST_RUN_LIST_FAILED");
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const csrfError = enforceCsrfProtection(request);

    if (csrfError) {
      return csrfError;
    }

    const { projectId } = await context.params;
    const { project } = await requireProjectAccess(projectId, "create");

    const body = await readJsonBody(request);
    const title = readTrimmedString(body.title);
    const testCaseIds = readStringArray(body.testCaseIds);

    if (!title) {
      return apiError("테스트 플랜 이름을 입력하세요.", 400, "TEST_RUN_TITLE_REQUIRED");
    }

    if (testCaseIds.length === 0) {
      return apiError("실행할 테스트케이스를 1개 이상 선택하세요.", 400, "TEST_RUN_CASES_REQUIRED");
    }

    const testCases = await prisma.testCase.findMany({
      where: {
        projectId: project.id,
        deletedAt: null,
        OR: [{ id: { in: testCaseIds } }, { code: { in: testCaseIds } }],
      },
      select: { id: true, code: true },
      orderBy: { code: "asc" },
    });

    if (testCases.length !== testCaseIds.length) {
      return apiError("존재하지 않는 테스트케이스가 포함되어 있습니다.", 400, "TEST_RUN_CASES_INVALID");
    }

    const slug = await createUniqueRunSlug(project.id, readTrimmedString(body.slug) || title);
    const requestedStatus = parseRunStatus(body.status);
    const status = requestedStatus ?? (body.startNow === false ? "planned" : "in_progress");
    const today = new Date();

    const run = await prisma.$transaction(async (tx) => {
      const createdRun = await tx.testRun.create({
        data: {
          projectId: project.id,
          slug,
          title,
          description: readTrimmedString(body.description) || "새 테스트 플랜",
          assigneeName: readTrimmedString(body.assignee) || "김QA",
          environment: readTrimmedString(body.environment) || "QA Server",
          startDate: parseDateInput(body.startDate, today),
          dueDate: parseDateInput(body.dueDate, today),
          status: toDbRunStatus(status),
        },
      });

      await tx.testRunResult.createMany({
        data: testCases.map((testCase) => ({
          runId: createdRun.id,
          testCaseId: testCase.id,
          code: `${slug}-${testCase.code}`,
          status: "PENDING" as const,
        })),
      });

      return tx.testRun.findUniqueOrThrow({
        where: { id: createdRun.id },
        include: testRunInclude,
      });
    });

    return apiSuccess(mapRunToDto(run), { status: 201 });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("테스트 실행을 생성하지 못했습니다.", 500, "TEST_RUN_CREATE_FAILED");
  }
}
