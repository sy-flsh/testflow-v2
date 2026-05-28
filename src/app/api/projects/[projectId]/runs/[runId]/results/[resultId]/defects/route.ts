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
  createNextDefectCode,
  defectInclude,
  mapDefectToDto,
  parseDefectSeverity,
  parsePriority,
  refreshResultDefectCounts,
  toDbDefectSeverity,
  toDbPriority,
} from "@/lib/defects/defect-api";
import {
  findRunByIdOrSlug,
  findRunResultByIdOrCode,
  mapResultToDto,
} from "@/lib/test-runs/test-run-api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ projectId: string; runId: string; resultId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const csrfError = enforceCsrfProtection(request);

    if (csrfError) {
      return csrfError;
    }

    const { projectId, runId, resultId } = await context.params;
    const { project } = await requireProjectAccess(projectId, "create");

    const run = await findRunByIdOrSlug(project.id, runId);

    if (!run) {
      return apiError("테스트 실행을 찾을 수 없습니다.", 404, "TEST_RUN_NOT_FOUND");
    }

    const result = await findRunResultByIdOrCode(run.id, resultId);

    if (!result) {
      return apiError("테스트 실행 결과를 찾을 수 없습니다.", 404, "TEST_RUN_RESULT_NOT_FOUND");
    }

    if (result.status !== "FAILED" && result.status !== "BLOCKED") {
      return apiError(
        "Fail 또는 Block 결과에서만 결함을 생성할 수 있습니다.",
        400,
        "RESULT_STATUS_NOT_DEFECTABLE",
      );
    }

    const body = await readJsonBody(request);
    const title = readTrimmedString(body.title);

    if (!title) {
      return apiError("결함 제목을 입력하세요.", 400, "DEFECT_TITLE_REQUIRED");
    }

    const severity =
      parseDefectSeverity(body.severity) ?? (result.status === "BLOCKED" ? "major" : "critical");
    const priority = parsePriority(body.priority) ?? "high";
    const code = await createNextDefectCode(project.id);

    const created = await prisma.$transaction(async (tx) => {
      const defect = await tx.defect.create({
        data: {
          projectId: project.id,
          code,
          title,
          description:
            readTrimmedString(body.description) ||
            `${result.testCase.code} 실행 중 ${result.status.toLowerCase()} 결과에서 등록된 결함입니다.`,
          reproductionSteps:
            readTrimmedString(body.reproductionSteps) ||
            result.testCase.steps.map((step, index) => `${index + 1}. ${step.action}`).join("\n"),
          checklist: readStringArray(body.checklist),
          severity: toDbDefectSeverity(severity),
          priority: toDbPriority(priority),
          status: "OPEN",
          assigneeName: readTrimmedString(body.assignee) || "미지정",
          reporterName: readTrimmedString(body.reporter) || "김QA",
          links: {
            create: [
              {
                testCaseId: result.testCaseId,
              },
              {
                testRunResultId: result.id,
              },
            ],
          },
        },
      });

      await tx.testRunResult.update({
        where: { id: result.id },
        data: { defectCount: { increment: 1 } },
      });

      return defect;
    });

    await refreshResultDefectCounts([result.id]);

    const defect = await prisma.defect.findUniqueOrThrow({
      where: { id: created.id },
      include: defectInclude,
    });
    const updatedResult = await findRunResultByIdOrCode(run.id, resultId);

    if (!updatedResult) {
      return apiSuccess({ defect: mapDefectToDto(defect), result: null }, { status: 201 });
    }

    return apiSuccess(
      {
        defect: mapDefectToDto(defect),
        result: mapResultToDto(updatedResult),
      },
      { status: 201 },
    );
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("실행 결과에서 결함을 생성하지 못했습니다.", 500, "RESULT_DEFECT_CREATE_FAILED");
  }
}
