-- CreateEnum
CREATE TYPE "DefectStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DefectSeverity" AS ENUM ('CRITICAL', 'MAJOR', 'MINOR', 'TRIVIAL');

-- CreateTable
CREATE TABLE "defects" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "reproductionSteps" TEXT NOT NULL DEFAULT '',
    "checklist" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "severity" "DefectSeverity" NOT NULL DEFAULT 'MAJOR',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "DefectStatus" NOT NULL DEFAULT 'OPEN',
    "assigneeName" TEXT NOT NULL DEFAULT '미지정',
    "reporterName" TEXT NOT NULL DEFAULT '김QA',
    "attachmentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "defects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "defect_links" (
    "id" TEXT NOT NULL,
    "defectId" TEXT NOT NULL,
    "testCaseId" TEXT,
    "testRunResultId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "defect_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "defects_projectId_status_idx" ON "defects"("projectId", "status");

-- CreateIndex
CREATE INDEX "defects_projectId_severity_idx" ON "defects"("projectId", "severity");

-- CreateIndex
CREATE INDEX "defects_projectId_deletedAt_idx" ON "defects"("projectId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "defects_projectId_code_key" ON "defects"("projectId", "code");

-- CreateIndex
CREATE INDEX "defect_links_testCaseId_idx" ON "defect_links"("testCaseId");

-- CreateIndex
CREATE INDEX "defect_links_testRunResultId_idx" ON "defect_links"("testRunResultId");

-- CreateIndex
CREATE UNIQUE INDEX "defect_links_defectId_testCaseId_key" ON "defect_links"("defectId", "testCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "defect_links_defectId_testRunResultId_key" ON "defect_links"("defectId", "testRunResultId");

-- AddForeignKey
ALTER TABLE "defects" ADD CONSTRAINT "defects_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defect_links" ADD CONSTRAINT "defect_links_defectId_fkey" FOREIGN KEY ("defectId") REFERENCES "defects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defect_links" ADD CONSTRAINT "defect_links_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defect_links" ADD CONSTRAINT "defect_links_testRunResultId_fkey" FOREIGN KEY ("testRunResultId") REFERENCES "test_run_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;
