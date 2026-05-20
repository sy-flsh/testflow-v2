import { apiError, apiSuccess } from "@/lib/api/response";
import {
  readJsonBody,
  readOptionalTrimmedString,
  readStringArray,
  readTrimmedString,
} from "@/lib/api/request";
import { prisma } from "@/lib/db/prisma";
import {
  createNextDefectCode,
  defectInclude,
  findProjectForDefectApi,
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
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const project = await findProjectForDefectApi(projectId);

    if (!project) {
      return apiError("프로젝트를 찾을 수 없습니다.", 404, "PROJECT_NOT_FOUND");
    }

    const defects = await prisma.defect.findMany({
      where: {
        projectId: project.id,
        deletedAt: null,
      },
      include: defectInclude,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });

    return apiSuccess(defects.map(mapDefectToDto));
  } catch (error) {
    console.error(error);
    return apiError("결함 목록을 불러오지 못했습니다.", 500, "DEFECT_LIST_FAILED");
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const project = await findProjectForDefectApi(projectId);

    if (!project) {
      return apiError("프로젝트를 찾을 수 없습니다.", 404, "PROJECT_NOT_FOUND");
    }

    const body = await readJsonBody(request);
    const title = readTrimmedString(body.title);

    if (!title) {
      return apiError("결함 제목을 입력하세요.", 400, "DEFECT_TITLE_REQUIRED");
    }

    const testCaseIds = collectIds(body.testCaseIds, body.linkedTestCaseId);
    const testRunResultIds = collectIds(body.testRunResultIds, body.linkedRunResultId);
    const resolvedTestCaseIds = await resolveTestCaseIds(project.id, testCaseIds);

    if (!resolvedTestCaseIds) {
      return apiError("존재하지 않는 테스트케이스가 포함되어 있습니다.", 400, "DEFECT_TEST_CASE_INVALID");
    }

    const resolvedResultIds = await resolveResultIds(project.id, testRunResultIds);

    if (!resolvedResultIds) {
      return apiError("존재하지 않는 실행 결과가 포함되어 있습니다.", 400, "DEFECT_RESULT_INVALID");
    }

    const severity = parseDefectSeverity(body.severity) ?? "major";
    const priority = parsePriority(body.priority) ?? "medium";
    const status = parseDefectStatus(body.status) ?? "open";
    const code = readTrimmedString(body.code || body.id) || (await createNextDefectCode(project.id));

    const defect = await prisma.defect.create({
      data: {
        projectId: project.id,
        code,
        title,
        description: readTrimmedString(body.description),
        reproductionSteps: readTrimmedString(body.reproductionSteps),
        checklist: readStringArray(body.checklist),
        severity: toDbDefectSeverity(severity),
        priority: toDbPriority(priority),
        status: toDbDefectStatus(status),
        assigneeName: readTrimmedString(body.assignee) || "미지정",
        reporterName: readTrimmedString(body.reporter) || "김QA",
      },
    });

    await replaceDefectLinks(defect.id, resolvedTestCaseIds, resolvedResultIds);
    await refreshResultDefectCounts(resolvedResultIds);

    const createdDefect = await prisma.defect.findUniqueOrThrow({
      where: { id: defect.id },
      include: defectInclude,
    });

    return apiSuccess(mapDefectToDto(createdDefect), { status: 201 });
  } catch (error) {
    console.error(error);
    return apiError("결함을 생성하지 못했습니다.", 500, "DEFECT_CREATE_FAILED");
  }
}

function collectIds(primary: unknown, fallback: unknown) {
  const ids = readStringArray(primary);
  const fallbackId = readOptionalTrimmedString(fallback);

  return Array.from(new Set([...(fallbackId ? [fallbackId] : []), ...ids]));
}
