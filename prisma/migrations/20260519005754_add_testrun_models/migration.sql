-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'BLOCKED', 'SKIPPED');

-- CreateTable
CREATE TABLE "test_runs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "assigneeName" TEXT NOT NULL DEFAULT '김QA',
    "environment" TEXT NOT NULL DEFAULT 'QA Server',
    "startDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "test_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_run_results" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "ResultStatus" NOT NULL DEFAULT 'PENDING',
    "actualResult" TEXT NOT NULL DEFAULT '',
    "defectCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_run_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "test_runs_projectId_status_idx" ON "test_runs"("projectId", "status");

-- CreateIndex
CREATE INDEX "test_runs_projectId_deletedAt_idx" ON "test_runs"("projectId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "test_runs_projectId_slug_key" ON "test_runs"("projectId", "slug");

-- CreateIndex
CREATE INDEX "test_run_results_testCaseId_idx" ON "test_run_results"("testCaseId");

-- CreateIndex
CREATE INDEX "test_run_results_runId_status_idx" ON "test_run_results"("runId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "test_run_results_runId_testCaseId_key" ON "test_run_results"("runId", "testCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "test_run_results_runId_code_key" ON "test_run_results"("runId", "code");

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_run_results" ADD CONSTRAINT "test_run_results_runId_fkey" FOREIGN KEY ("runId") REFERENCES "test_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_run_results" ADD CONSTRAINT "test_run_results_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "test_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
