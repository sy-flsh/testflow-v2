import { apiError, apiSuccess } from "@/lib/api/response";
import { readJsonBody, readTrimmedString } from "@/lib/api/request";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireProjectAccess,
} from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { enforceCsrfProtection } from "@/lib/security/csrf";
import { checkRateLimit, rateLimitErrorResponse } from "@/lib/security/rate-limit";
import { generateAiDraftItems, mapAiDraftToDto, sanitizeInput } from "@/lib/testcases/ai-drafts";
import { findFolderByIdOrSlug } from "@/lib/testcases/testcase-api";

export const runtime = "nodejs";

const AI_DRAFT_WINDOW_MS = 60 * 60 * 1000;
const AI_DRAFT_USER_LIMIT = 20;

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
    const { project, user } = await requireProjectAccess(projectId, "create");
    const rateLimit = await checkRateLimit({
      scope: "testcases:ai-draft:user",
      key: user.id,
      limit: AI_DRAFT_USER_LIMIT,
      windowMs: AI_DRAFT_WINDOW_MS,
    });

    if (!rateLimit.allowed) {
      return rateLimitErrorResponse(rateLimit);
    }

    const body = await readJsonBody(request);
    const requirementText = readTrimmedString(body.requirementText);

    if (!requirementText) {
      return apiError("요구사항을 입력하세요.", 400, "AI_DRAFT_REQUIREMENT_REQUIRED");
    }

    const targetFolderId = readTrimmedString(body.targetFolderId);

    if (targetFolderId) {
      const folder = await findFolderByIdOrSlug(project.id, targetFolderId);

      if (!folder) {
        return apiError("대상 폴더를 찾을 수 없습니다.", 404, "AI_DRAFT_FOLDER_NOT_FOUND");
      }
    }

    const input = sanitizeInput({
      featureName: readTrimmedString(body.featureName),
      requirementText,
      targetFolderId: targetFolderId || undefined,
      priority: body.priority,
      scenarioCount: body.scenarioCount,
      testType: body.testType,
    });
    const result = await generateAiDraftItems(input);
    const draft = await prisma.aiTestCaseDraft.create({
      data: {
        projectId: project.id,
        prompt: input,
        source: result.source,
        status: result.status,
        items: result.items,
        errorMessage: result.errorMessage,
      },
    });
    const dto = mapAiDraftToDto(draft);

    return apiSuccess(
      {
        draft: dto,
        fallbackUsed: dto.status === "fallback",
        message:
          dto.status === "fallback"
            ? "AI 응답 실패로 기본 규칙 기반 초안을 생성했습니다."
            : "AI 테스트케이스 초안을 생성했습니다.",
      },
      { status: 201 },
    );
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("AI 테스트케이스 초안을 생성하지 못했습니다.", 500, "AI_DRAFT_CREATE_FAILED");
  }
}
