import type { Priority, TestCaseStatus } from "@/lib/domain/types";

export type AiDraftStatusValue = "draft" | "saved" | "failed" | "fallback";
export type AiDraftTestType = "normal" | "edge" | "negative" | "regression";

export type AiDraftInput = {
  featureName: string;
  requirementText: string;
  targetFolderId?: string;
  priority?: Priority;
  scenarioCount?: number;
  testType?: AiDraftTestType;
};

export type AiDraftStep = {
  action: string;
  expectedResult: string;
};

export type AiDraftItem = {
  title: string;
  description: string;
  preconditions: string;
  priority: Priority;
  status: TestCaseStatus;
  tags: string[];
  steps: AiDraftStep[];
};

export type AiDraftDto = {
  id: string;
  projectId: string;
  prompt: AiDraftInput;
  source: string;
  status: AiDraftStatusValue;
  items: AiDraftItem[];
  errorMessage?: string;
  createdAt: string;
  savedAt?: string;
};
