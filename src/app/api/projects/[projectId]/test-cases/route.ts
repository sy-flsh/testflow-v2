import { apiError, apiSuccess } from "@/lib/api/response";
import {
  readJsonBody,
  readStringArray,
  readTrimmedString,
} from "@/lib/api/request";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireProjectAccess,
} from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import {
  createNextTestCaseCode,
  findFolderByIdOrSlug,
  mapTestCaseToDto,
  parsePriority,
  parseTestCaseStatus,
  testCaseInclude,
  toDbPriority,
  toDbTestCaseStatus,
} from "@/lib/testcases/testcase-api";
import { enforceCsrfProtection } from "@/lib/security/csrf";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const { project } = await requireProjectAccess(projectId, "read");

    const testCases = await prisma.testCase.findMany({
      where: {
        projectId: project.id,
        deletedAt: null,
      },
      include: testCaseInclude,
      orderBy: [{ createdAt: "desc" }],
    });

    return apiSuccess(testCases.map(mapTestCaseToDto));
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("테스트케이스 목록을 불러오지 못했습니다.", 500, "TEST_CASE_LIST_FAILED");
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

    if (!title) {
      return apiError("테스트케이스 제목을 입력하세요.", 400, "TEST_CASE_TITLE_REQUIRED");
    }

    const folderKey = readTrimmedString(body.folderId);
    const folder = folderKey
      ? await findFolderByIdOrSlug(project.id, folderKey)
      : await prisma.testFolder.findFirst({
          where: { projectId: project.id, deletedAt: null },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        });

    if (!folder) {
      return apiError("테스트케이스 폴더를 찾을 수 없습니다.", 404, "TEST_CASE_FOLDER_NOT_FOUND");
    }

    const priority = parsePriority(body.priority) ?? "medium";
    const status = parseTestCaseStatus(body.status) ?? "draft";
    const code = readTrimmedString(body.code || body.id) || (await createNextTestCaseCode(project.id));
    const steps = readStringArray(body.steps);

    const testCase = await prisma.testCase.create({
      data: {
        projectId: project.id,
        folderId: folder.id,
        code,
        title,
        priority: toDbPriority(priority),
        status: toDbTestCaseStatus(status),
        tags: readStringArray(body.tags),
        authorName: readTrimmedString(body.author) || "김QA",
        description: readTrimmedString(body.description),
        preconditions: readTrimmedString(body.preconditions),
        expectedResult: readTrimmedString(body.expectedResult),
        steps: {
          create: steps.map((step, index) => ({
            order: index + 1,
            action: step,
          })),
        },
      },
      include: testCaseInclude,
    });

    return apiSuccess(mapTestCaseToDto(testCase), { status: 201 });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("테스트케이스를 생성하지 못했습니다.", 500, "TEST_CASE_CREATE_FAILED");
  }
}
