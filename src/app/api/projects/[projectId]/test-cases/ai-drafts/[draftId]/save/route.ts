import { apiError, apiSuccess } from "@/lib/api/response";
import { readJsonBody, readStringArray, readTrimmedString } from "@/lib/api/request";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireProjectAccess,
} from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { enforceCsrfProtection } from "@/lib/security/csrf";
import { mapAiDraftToDto, sanitizeDraftItems } from "@/lib/testcases/ai-drafts";
import {
  createNextTestCaseCode,
  findFolderByIdOrSlug,
  mapTestCaseToDto,
  testCaseInclude,
  toDbPriority,
  toDbTestCaseStatus,
} from "@/lib/testcases/testcase-api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ projectId: string; draftId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const csrfError = enforceCsrfProtection(request);

    if (csrfError) {
      return csrfError;
    }

    const { projectId, draftId } = await context.params;
    const { project } = await requireProjectAccess(projectId, "create");

    const draft = await prisma.aiTestCaseDraft.findFirst({
      where: {
        id: draftId,
        projectId: project.id,
      },
    });

    if (!draft) {
      return apiError("AI 초안을 찾을 수 없습니다.", 404, "AI_DRAFT_NOT_FOUND");
    }

    const body = await readJsonBody(request);
    const items = sanitizeDraftItems(draft.items);
    const selectedIndexes = readSelectedIndexes(body.itemIndexes, items.length);

    if (selectedIndexes.length === 0) {
      return apiError("저장할 초안을 1개 이상 선택하세요.", 400, "AI_DRAFT_ITEMS_REQUIRED");
    }

    const folderKey =
      readTrimmedString(body.targetFolderId) ||
      readTrimmedString(body.folderId) ||
      getPromptTargetFolderId(draft.prompt);
    const folder = folderKey
      ? await findFolderByIdOrSlug(project.id, folderKey)
      : await prisma.testFolder.findFirst({
          where: { projectId: project.id, deletedAt: null },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        });

    if (!folder) {
      return apiError("저장할 폴더를 찾을 수 없습니다.", 404, "AI_DRAFT_FOLDER_NOT_FOUND");
    }

    const createdIds: string[] = [];

    await prisma.$transaction(async (tx) => {
      let nextNumber = await getNextCodeNumber(project.id);

      for (const index of selectedIndexes) {
        const item = items[index];
        const code = `TC-${String(nextNumber).padStart(3, "0")}`;
        nextNumber += 1;

        const created = await tx.testCase.create({
          data: {
            projectId: project.id,
            folderId: folder.id,
            code,
            title: item.title,
            priority: toDbPriority(item.priority),
            status: toDbTestCaseStatus(item.status),
            tags: Array.from(new Set(["ai-draft", ...item.tags])),
            authorName: "김QA",
            description: item.description,
            preconditions: item.preconditions,
            expectedResult: item.steps.find((step) => step.expectedResult)?.expectedResult ?? "",
            steps: {
              create: item.steps.map((step, stepIndex) => ({
                order: stepIndex + 1,
                action: step.action,
                expectedResult: step.expectedResult,
              })),
            },
          },
        });

        createdIds.push(created.id);
      }

      await tx.aiTestCaseDraft.update({
        where: { id: draft.id },
        data: {
          status: "SAVED",
          savedAt: new Date(),
        },
      });
    });

    const [createdTestCases, savedDraft] = await Promise.all([
      prisma.testCase.findMany({
        where: { id: { in: createdIds } },
        include: testCaseInclude,
        orderBy: { createdAt: "desc" },
      }),
      prisma.aiTestCaseDraft.findUniqueOrThrow({ where: { id: draft.id } }),
    ]);

    return apiSuccess({
      savedCount: createdTestCases.length,
      testCases: createdTestCases.map(mapTestCaseToDto),
      draft: mapAiDraftToDto(savedDraft),
    });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("AI 초안을 테스트케이스로 저장하지 못했습니다.", 500, "AI_DRAFT_SAVE_FAILED");
  }
}

function readSelectedIndexes(value: unknown, itemCount: number) {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => (typeof item === "number" ? item : Number(item)))
          .filter((item) => Number.isInteger(item) && item >= 0 && item < itemCount),
      ),
    );
  }

  return readStringArray(value)
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 0 && item < itemCount);
}

async function getNextCodeNumber(projectId: string) {
  const nextCode = await createNextTestCaseCode(projectId);
  const match = nextCode.match(/^TC-(\d+)$/);

  return match ? Number(match[1]) : 1;
}

function getPromptTargetFolderId(value: unknown) {
  if (typeof value !== "object" || value === null || !("targetFolderId" in value)) {
    return "";
  }

  const folderId = (value as { targetFolderId?: unknown }).targetFolderId;

  return typeof folderId === "string" ? folderId.trim() : "";
}
