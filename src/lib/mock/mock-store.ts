"use client";

import type { Defect, Project, TestCase, TestRun, TestRunResult } from "@/lib/domain/types";
import { mockDefects, mockProjects, mockTestCases, mockTestRuns } from "@/lib/mock/mock-data";

const MOCK_VERSION = "v1";
const API_BACKUP_VERSION = "v2";

export const mockStorageKeys = {
  projects: `testflow-v2:${MOCK_VERSION}:projects`,
  testCases: `testflow-v2:${MOCK_VERSION}:test-cases`,
  testRuns: `testflow-v2:${MOCK_VERSION}:test-runs`,
  defects: `testflow-v2:${MOCK_VERSION}:defects`,
  projectApiBackup: `testflow-v2:${API_BACKUP_VERSION}:backup:projects`,
};

export type ProjectBackupSnapshot = {
  savedAt: string;
  projects: Project[];
};

export function loadMockProjects() {
  return loadCollection(mockStorageKeys.projects, mockProjects);
}

export function saveMockProjects(projects: Project[]) {
  saveCollection(mockStorageKeys.projects, projects);
}

export function loadProjectBackupSnapshot() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(mockStorageKeys.projectApiBackup);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as ProjectBackupSnapshot;
  } catch {
    window.localStorage.removeItem(mockStorageKeys.projectApiBackup);
    return null;
  }
}

export function saveProjectBackupSnapshot(projects: Project[]) {
  if (typeof window === "undefined") {
    return;
  }

  const snapshot: ProjectBackupSnapshot = {
    savedAt: new Date().toISOString(),
    projects,
  };

  window.localStorage.setItem(mockStorageKeys.projectApiBackup, JSON.stringify(snapshot));
}

export function loadMockTestCases() {
  return loadCollection(mockStorageKeys.testCases, mockTestCases);
}

export function saveMockTestCases(testCases: TestCase[]) {
  saveCollection(mockStorageKeys.testCases, testCases);
}

export function loadMockRuns() {
  return loadCollection(mockStorageKeys.testRuns, mockTestRuns);
}

export function saveMockRuns(runs: TestRun[]) {
  saveCollection(mockStorageKeys.testRuns, runs);
}

export function loadMockDefects() {
  return loadCollection(mockStorageKeys.defects, mockDefects);
}

export function saveMockDefects(defects: Defect[]) {
  saveCollection(mockStorageKeys.defects, defects);
}

export function createDefectId(defects: Defect[]) {
  const maxId = defects.reduce((max, defect) => {
    const numericId = Number(defect.id.replace("BUG-", ""));
    return Number.isNaN(numericId) ? max : Math.max(max, numericId);
  }, 100);

  return `BUG-${maxId + 1}`;
}

export function addMockDefectFromRunResult(input: {
  result: TestRunResult;
  title: string;
  severity?: Defect["severity"];
  priority?: Defect["priority"];
  reproductionSteps?: string;
}) {
  const defects = loadMockDefects();
  const today = new Date().toISOString().slice(0, 10);
  const nextDefect: Defect = {
    id: createDefectId(defects),
    title: input.title.trim(),
    description: `${input.result.testCase.id} 실행 중 ${input.result.status} 결과에서 등록된 mock 결함입니다.`,
    reproductionSteps:
      input.reproductionSteps ||
      input.result.testCase.steps.map((step, index) => `${index + 1}. ${step}`).join("\n"),
    checklist: ["실행 결과 확인", "재현 가능 여부 확인", "수정 담당자 배정"],
    severity: input.severity ?? (input.result.status === "blocked" ? "major" : "critical"),
    priority: input.priority ?? "high",
    status: "open",
    assignee: "미지정",
    reporter: "김QA",
    createdAt: today,
    updatedAt: today,
    linkedTestCaseId: input.result.testCase.id,
    linkedTestCaseTitle: input.result.testCase.title,
    linkedRunResultId: input.result.id,
    attachmentCount: 0,
  };

  saveMockDefects([nextDefect, ...defects]);
  return nextDefect;
}

function loadCollection<T>(key: string, fallback: T[]) {
  if (typeof window === "undefined") {
    return fallback;
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    saveCollection(key, fallback);
    return fallback;
  }

  try {
    return JSON.parse(raw) as T[];
  } catch {
    saveCollection(key, fallback);
    return fallback;
  }
}

function saveCollection<T>(key: string, value: T[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}
