import { apiError, apiSuccess } from "@/lib/api/response";
import { readJsonBody } from "@/lib/api/request";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireProjectAccess,
} from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { enforceCsrfProtection } from "@/lib/security/csrf";
import {
  getDbPriority,
  getDbStatus,
  sanitizeImportRows,
} from "@/lib/testcases/import-api";
import {
  createNextTestCaseCode,
  mapTestCaseToDto,
  testCaseInclude,
} from "@/lib/testcases/testcase-api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const csrfError = enforceCsrfProtection(request);

    if (csrfError) {
      return csrfError;
    }

    const { projectId } = await context.params;
    const { project } = await requireProjectAccess(projectId, "create");

    const folders = await prisma.testFolder.findMany({
      where: { projectId: project.id, deletedAt: null },
      select: { id: true, slug: true, name: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    const defaultFolder = folders[0];

    if (!defaultFolder) {
      return apiError("테스트케이스 폴더를 찾을 수 없습니다.", 404, "TEST_CASE_FOLDER_NOT_FOUND");
    }

    const body = await readJsonBody(request);
    const { rows, errors: payloadErrors } = sanitizeImportRows(body.rows, folders);

    if (rows.length === 0) {
      return apiError(
        payloadErrors[0] || "저장할 수 있는 유효 행이 없습니다.",
        400,
        "TEST_CASE_IMPORT_NO_VALID_ROWS",
      );
    }

    const createdIds: string[] = [];
    const errors: string[] = [...payloadErrors];
    let skippedCount = 0;

    await prisma.$transaction(async (tx) => {
      let nextNumber = await getNextCodeNumber(project.id);

      for (const row of rows) {
        try {
          const code = `TC-${String(nextNumber).padStart(3, "0")}`;
          nextNumber += 1;
          const testCase = await tx.testCase.create({
            data: {
              projectId: project.id,
              folderId: row.mapped.folderId ?? defaultFolder.id,
              code,
              title: row.mapped.title,
              priority: getDbPriority(row.mapped.priority),
              status: getDbStatus(row.mapped.status),
              tags: row.mapped.tags,
              authorName: "김QA",
              description: row.mapped.description,
              preconditions: row.mapped.preconditions,
              expectedResult:
                row.mapped.steps.find((step) => step.expectedResult)?.expectedResult ?? "",
              steps: {
                create: row.mapped.steps.map((step, index) => ({
                  order: index + 1,
                  action: step.action || `단계 ${index + 1}`,
                  expectedResult: step.expectedResult,
                })),
              },
            },
          });

          createdIds.push(testCase.id);
        } catch (error) {
          skippedCount += 1;
          errors.push(`${row.rowNumber}행 저장 실패: ${getErrorMessage(error)}`);
        }
      }
    });

    const created = await prisma.testCase.findMany({
      where: { id: { in: createdIds } },
      include: testCaseInclude,
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess({
      createdCount: created.length,
      skippedCount,
      errors,
      testCases: created.map(mapTestCaseToDto),
    });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("CSV 가져오기를 저장하지 못했습니다.", 500, "TEST_CASE_IMPORT_COMMIT_FAILED");
  }
}

async function getNextCodeNumber(projectId: string) {
  const nextCode = await createNextTestCaseCode(projectId);
  const match = nextCode.match(/^TC-(\d+)$/);

  return match ? Number(match[1]) : 1;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "알 수 없는 오류";
}
