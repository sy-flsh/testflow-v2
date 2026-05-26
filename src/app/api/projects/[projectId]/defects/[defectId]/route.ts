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
import {
  defectInclude,
  findDefectByIdOrCode,
  mapDefectToDto,
  parseDefectSeverity,
  parseDefectStatus,
  parsePriority,
  refreshResultDefectCounts,
  replaceDefectLinks,
  resolveResultIds,
  resolveTestCaseIds,
  toDbDefectSeverity,
  toDbDefectStatus,
  toDbPriority,
} from "@/lib/defects/defect-api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ projectId: string; defectId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { projectId, defectId } = await context.params;
    const { project } = await requireProjectAccess(projectId, "read");

    const defect = await findDefectByIdOrCode(project.id, defectId);

    if (!defect) {
      return apiError("결함을 찾을 수 없습니다.", 404, "DEFECT_NOT_FOUND");
    }

    return apiSuccess(mapDefectToDto(defect));
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("결함을 불러오지 못했습니다.", 500, "DEFECT_READ_FAILED");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { projectId, defectId } = await context.params;
    const { project } = await requireProjectAccess(projectId, "update");

    const defect = await findDefectByIdOrCode(project.id, defectId);

    if (!defect) {
      return apiError("결함을 찾을 수 없습니다.", 404, "DEFECT_NOT_FOUND");
    }

    const body = await readJsonBody(request);
    const data: {
      title?: string;
      description?: string;
      reproductionSteps?: string;
      checklist?: string[];
      severity?: ReturnType<typeof toDbDefectSeverity>;
      priority?: ReturnType<typeof toDbPriority>;
      status?: ReturnType<typeof toDbDefectStatus>;
      assigneeName?: string;
      reporterName?: string;
      attachmentCount?: number;
    } = {};

    if (body.title !== undefined) {
      const title = readTrimmedString(body.title);

      if (!title) {
        return apiError("결함 제목을 입력하세요.", 400, "DEFECT_TITLE_REQUIRED");
      }

      data.title = title;
    }

    const description = readOptionalTrimmedString(body.description);
    const reproductionSteps = readOptionalTrimmedString(body.reproductionSteps);
    const assignee = readOptionalTrimmedString(body.assignee);
    const reporter = readOptionalTrimmedString(body.reporter);

    if (description !== undefined) {
      data.description = description;
    }

    if (reproductionSteps !== undefined) {
      data.reproductionSteps = reproductionSteps;
    }

    if (body.checklist !== undefined) {
      data.checklist = readStringArray(body.checklist);
    }

    if (body.severity !== undefined) {
      const severity = parseDefectSeverity(body.severity);

      if (!severity) {
        return apiError("지원하지 않는 결함 심각도입니다.", 400, "DEFECT_SEVERITY_INVALID");
      }

      data.severity = toDbDefectSeverity(severity);
    }

    if (body.priority !== undefined) {
      const priority = parsePriority(body.priority);

      if (!priority) {
        return apiError("지원하지 않는 우선순위입니다.", 400, "DEFECT_PRIORITY_INVALID");
      }

      data.priority = toDbPriority(priority);
    }

    if (body.status !== undefined) {
      const status = parseDefectStatus(body.status);

      if (!status) {
        return apiError("지원하지 않는 결함 상태입니다.", 400, "DEFECT_STATUS_INVALID");
      }

      data.status = toDbDefectStatus(status);
    }

    if (assignee !== undefined) {
      data.assigneeName = assignee || "미지정";
    }

    if (reporter !== undefined) {
      data.reporterName = reporter || "김QA";
    }

    if (typeof body.attachmentCount === "number" && Number.isFinite(body.attachmentCount)) {
      data.attachmentCount = Math.max(0, Math.floor(body.attachmentCount));
    }

    const previousResultIds = defect.links
      .map((link) => link.testRunResultId)
      .filter((id): id is string => Boolean(id));

    await prisma.defect.update({
      where: { id: defect.id },
      data,
    });

    let nextResultIds: string[] = [];

    if (body.testCaseIds !== undefined || body.testRunResultIds !== undefined) {
      const resolvedTestCaseIds =
        body.testCaseIds !== undefined
          ? await resolveTestCaseIds(project.id, readStringArray(body.testCaseIds))
          : defect.links
              .map((link) => link.testCaseId)
              .filter((id): id is string => Boolean(id));

      if (!resolvedTestCaseIds) {
        return apiError("존재하지 않는 테스트케이스가 포함되어 있습니다.", 400, "DEFECT_TEST_CASE_INVALID");
      }

      const resolvedResultIds =
        body.testRunResultIds !== undefined
          ? await resolveResultIds(project.id, readStringArray(body.testRunResultIds))
          : previousResultIds;

      if (!resolvedResultIds) {
        return apiError("존재하지 않는 실행 결과가 포함되어 있습니다.", 400, "DEFECT_RESULT_INVALID");
      }

      await replaceDefectLinks(defect.id, resolvedTestCaseIds, resolvedResultIds);
      nextResultIds = resolvedResultIds;
    }

    await refreshResultDefectCounts([...previousResultIds, ...nextResultIds]);

    const updatedDefect = await prisma.defect.findUniqueOrThrow({
      where: { id: defect.id },
      include: defectInclude,
    });

    return apiSuccess(mapDefectToDto(updatedDefect));
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("결함을 수정하지 못했습니다.", 500, "DEFECT_UPDATE_FAILED");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { projectId, defectId } = await context.params;
    const { project } = await requireProjectAccess(projectId, "delete");

    const defect = await findDefectByIdOrCode(project.id, defectId);

    if (!defect) {
      return apiError("결함을 찾을 수 없습니다.", 404, "DEFECT_NOT_FOUND");
    }

    const resultIds = defect.links
      .map((link) => link.testRunResultId)
      .filter((id): id is string => Boolean(id));

    await prisma.defect.update({
      where: { id: defect.id },
      data: { deletedAt: new Date() },
    });

    await refreshResultDefectCounts(resultIds);

    return apiSuccess({ id: defect.code });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("결함을 삭제하지 못했습니다.", 500, "DEFECT_DELETE_FAILED");
  }
}
