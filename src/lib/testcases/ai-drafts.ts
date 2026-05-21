import {
  AiDraftStatus as PrismaAiDraftStatus,
  type AiTestCaseDraft as DbAiTestCaseDraft,
} from "@prisma/client";
import type {
  AiDraftDto,
  AiDraftInput,
  AiDraftItem,
  AiDraftStatusValue,
  AiDraftTestType,
} from "@/lib/testcases/ai-draft-types";
import type { Priority, TestCaseStatus } from "@/lib/domain/types";

const toDomainStatus: Record<PrismaAiDraftStatus, AiDraftStatusValue> = {
  DRAFT: "draft",
  SAVED: "saved",
  FAILED: "failed",
  FALLBACK: "fallback",
};

const defaultAiApiUrl = "https://api.openai.com/v1/chat/completions";
const defaultAiModel = "gpt-4o-mini";

export function mapAiDraftToDto(draft: DbAiTestCaseDraft): AiDraftDto {
  return {
    id: draft.id,
    projectId: draft.projectId,
    prompt: sanitizeInput(draft.prompt),
    source: draft.source,
    status: toDomainStatus[draft.status],
    items: sanitizeDraftItems(draft.items),
    errorMessage: draft.errorMessage ?? undefined,
    createdAt: draft.createdAt.toISOString(),
    savedAt: draft.savedAt?.toISOString(),
  };
}

export function sanitizeInput(value: unknown): AiDraftInput {
  if (!isRecord(value)) {
    return {
      featureName: "",
      requirementText: "",
      scenarioCount: 4,
      testType: "normal",
    };
  }

  return {
    featureName: readString(value.featureName),
    requirementText: readString(value.requirementText),
    targetFolderId: readString(value.targetFolderId) || undefined,
    priority: parsePriorityValue(value.priority) ?? "medium",
    scenarioCount: clampScenarioCount(value.scenarioCount),
    testType: parseTestType(value.testType),
  };
}

export async function generateAiDraftItems(input: AiDraftInput) {
  const normalizedInput = sanitizeInput(input);
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return {
      items: createFallbackDraftItems(normalizedInput),
      source: "fallback",
      status: "FALLBACK" as const,
      errorMessage: "OPENAI_API_KEY가 없어 rule-based fallback 초안을 생성했습니다.",
    };
  }

  try {
    const items = await requestOpenAiDrafts(normalizedInput, apiKey);

    return {
      items,
      source: "openai",
      status: "DRAFT" as const,
      errorMessage: null,
    };
  } catch (error) {
    return {
      items: createFallbackDraftItems(normalizedInput),
      source: "fallback",
      status: "FALLBACK" as const,
      errorMessage: getErrorMessage(error),
    };
  }
}

export function sanitizeDraftItems(value: unknown): AiDraftItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => sanitizeDraftItem(item))
    .filter((item) => item.title && item.steps.length > 0);
}

export function createFallbackDraftItems(input: AiDraftInput): AiDraftItem[] {
  const count = clampScenarioCount(input.scenarioCount);
  const featureName = input.featureName || "요구사항";
  const requirementSummary = summarizeRequirement(input.requirementText);
  const priority = input.priority ?? "medium";
  const cases = [
    {
      title: `${featureName} 정상 처리 확인`,
      description: `${requirementSummary} 요구사항의 정상 사용자 흐름을 검증합니다.`,
      preconditions: `${featureName} 기능에 접근 가능한 테스트 계정과 기본 데이터가 준비되어 있다.`,
      priority,
      status: "draft" as TestCaseStatus,
      tags: ["ai-draft", "normal"],
      steps: [
        { action: `${featureName} 화면 또는 기능에 진입한다.`, expectedResult: "기능 진입 화면이 정상 표시된다." },
        { action: "필수 정보를 정상 값으로 입력한다.", expectedResult: "입력값이 오류 없이 반영된다." },
        { action: "저장 또는 실행 버튼을 클릭한다.", expectedResult: "요청이 성공 처리되고 완료 메시지가 표시된다." },
      ],
    },
    {
      title: `${featureName} 필수값 누락 검증`,
      description: "필수 입력값이 없을 때 사용자에게 명확한 오류가 표시되는지 확인합니다.",
      preconditions: `${featureName} 입력 화면에 진입할 수 있다.`,
      priority: "high" as Priority,
      status: "draft" as TestCaseStatus,
      tags: ["ai-draft", "negative"],
      steps: [
        { action: "필수 입력값을 비운 상태로 둔다.", expectedResult: "필수 입력 필드가 비어 있다." },
        { action: "저장 또는 실행 버튼을 클릭한다.", expectedResult: "처리가 차단되고 필수값 안내가 표시된다." },
      ],
    },
    {
      title: `${featureName} 권한/예외 상황 처리`,
      description: "권한이 없거나 예외 응답이 발생할 때 안전하게 안내되는지 확인합니다.",
      preconditions: "권한이 제한된 계정 또는 예외 응답을 재현할 수 있는 조건이 준비되어 있다.",
      priority,
      status: "draft" as TestCaseStatus,
      tags: ["ai-draft", "exception"],
      steps: [
        { action: "권한이 제한된 계정으로 기능에 접근한다.", expectedResult: "접근 제한 안내가 표시된다." },
        { action: "예외가 발생하는 요청을 수행한다.", expectedResult: "데이터가 손상되지 않고 오류 안내가 표시된다." },
      ],
    },
    {
      title: `${featureName} 경계값 입력 검증`,
      description: "최소/최대 길이와 형식 경계에서 입력 검증이 올바른지 확인합니다.",
      preconditions: `${featureName} 입력 조건과 제한값을 확인할 수 있다.`,
      priority: "medium" as Priority,
      status: "draft" as TestCaseStatus,
      tags: ["ai-draft", "edge"],
      steps: [
        { action: "최소 길이 입력값을 입력한다.", expectedResult: "허용 범위라면 정상 처리된다." },
        { action: "최대 길이 초과 입력값을 입력한다.", expectedResult: "초과 입력이 차단되거나 오류 메시지가 표시된다." },
      ],
    },
    {
      title: `${featureName} 저장 후 조회 일관성 확인`,
      description: "저장된 데이터가 목록/상세/새로고침 후에도 유지되는지 검증합니다.",
      preconditions: `${featureName} 데이터를 생성할 수 있는 권한이 있다.`,
      priority,
      status: "draft" as TestCaseStatus,
      tags: ["ai-draft", "regression"],
      steps: [
        { action: "정상 데이터를 입력하고 저장한다.", expectedResult: "저장이 성공한다." },
        { action: "목록과 상세 화면을 다시 조회한다.", expectedResult: "저장한 데이터가 동일하게 표시된다." },
        { action: "브라우저를 새로고침한다.", expectedResult: "저장 데이터가 유지된다." },
      ],
    },
  ] satisfies AiDraftItem[];

  return cases
    .filter((item) => matchesTestType(input.testType, item.tags))
    .concat(cases)
    .slice(0, count)
    .map((item) => ({ ...item, status: "draft" as TestCaseStatus }));
}

async function requestOpenAiDrafts(input: AiDraftInput, apiKey: string) {
  const response = await fetch(process.env.AI_TESTCASE_API_URL || defaultAiApiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.AI_TESTCASE_MODEL || defaultAiModel,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You generate QA test case drafts. Return strict JSON only. No markdown.",
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Generate Korean QA test case drafts as JSON.",
            outputSchema: {
              items: [
                {
                  title: "string",
                  description: "string",
                  preconditions: "string",
                  priority: "high|medium|low",
                  status: "draft|ready",
                  tags: ["string"],
                  steps: [{ action: "string", expectedResult: "string" }],
                },
              ],
            },
            input,
          }),
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error(`AI 요청 실패: ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  const content = readOpenAiContent(payload);

  if (!content) {
    throw new Error("AI 응답에서 JSON 콘텐츠를 찾지 못했습니다.");
  }

  const parsed = JSON.parse(content) as unknown;
  const items = sanitizeDraftItems(isRecord(parsed) ? parsed.items : parsed);

  if (items.length === 0) {
    throw new Error("AI 응답 JSON에 유효한 테스트케이스 초안이 없습니다.");
  }

  return items.slice(0, clampScenarioCount(input.scenarioCount));
}

function sanitizeDraftItem(value: unknown): AiDraftItem {
  const item = isRecord(value) ? value : {};
  const steps = Array.isArray(item.steps)
    ? item.steps
        .map((step) => {
          if (!isRecord(step)) {
            return { action: "", expectedResult: "" };
          }

          return {
            action: readString(step.action),
            expectedResult: readString(step.expectedResult),
          };
        })
        .filter((step) => step.action)
    : [];

  return {
    title: readString(item.title),
    description: readString(item.description),
    preconditions: readString(item.preconditions),
    priority: parsePriorityValue(item.priority) ?? "medium",
    status: parseStatusValue(item.status) ?? "draft",
    tags: Array.isArray(item.tags)
      ? item.tags.map((tag) => readString(tag)).filter(Boolean)
      : [],
    steps,
  };
}

function readOpenAiContent(payload: unknown) {
  if (!isRecord(payload)) {
    return "";
  }

  const choices = payload.choices;
  if (!Array.isArray(choices)) {
    return "";
  }

  const firstChoice = choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    return "";
  }

  return readString(firstChoice.message.content);
}

function parsePriorityValue(value: unknown): Priority | null {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }

  return null;
}

function parseStatusValue(value: unknown): TestCaseStatus | null {
  if (value === "ready" || value === "draft" || value === "deprecated") {
    return value;
  }

  return null;
}

function parseTestType(value: unknown): AiDraftTestType {
  if (value === "normal" || value === "edge" || value === "negative" || value === "regression") {
    return value;
  }

  return "normal";
}

function clampScenarioCount(value: unknown) {
  const count = typeof value === "number" ? value : Number(value);

  if (Number.isNaN(count)) {
    return 4;
  }

  return Math.min(Math.max(Math.floor(count), 1), 5);
}

function matchesTestType(testType: AiDraftTestType | undefined, tags: string[]) {
  if (!testType || testType === "normal") {
    return true;
  }

  return tags.includes(testType);
}

function summarizeRequirement(value: string) {
  const firstLine = value
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return "입력한";
  }

  return firstLine.length > 80 ? `${firstLine.slice(0, 80)}...` : firstLine;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "AI 초안 생성에 실패했습니다.";
}
