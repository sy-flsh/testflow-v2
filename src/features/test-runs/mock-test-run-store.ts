"use client";

import type { ResultStatus, RunStatus, TestCase, TestRun, TestRunResult } from "@/lib/domain/types";
import { mockTestCases, createRun } from "@/lib/mock/mock-data";
import { loadMockRuns, saveMockRuns } from "@/lib/mock/mock-store";

export type MockTestCase = TestCase;
export type MockRunResult = TestRunResult;
export type MockTestRun = TestRun;
export type { ResultStatus, RunStatus };
export { createRun, loadMockRuns, mockTestCases, saveMockRuns };

export function summarizeRun(run: MockTestRun) {
  const total = run.results.length;
  const pass = run.results.filter((result) => result.status === "passed").length;
  const fail = run.results.filter((result) => result.status === "failed").length;
  const block = run.results.filter((result) => result.status === "blocked").length;
  const skip = run.results.filter((result) => result.status === "skipped").length;
  const done = run.results.filter((result) => result.status !== "pending").length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  return { total, done, pass, fail, block, skip, progress };
}

export function toRunId(title: string) {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || `run-${Date.now()}`;
}
