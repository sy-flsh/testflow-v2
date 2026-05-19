-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "TestCaseStatus" AS ENUM ('READY', 'DRAFT', 'DEPRECATED');

-- CreateTable
CREATE TABLE "test_folders" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "test_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_cases" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TestCaseStatus" NOT NULL DEFAULT 'DRAFT',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "authorName" TEXT NOT NULL DEFAULT '김QA',
    "description" TEXT NOT NULL DEFAULT '',
    "preconditions" TEXT NOT NULL DEFAULT '',
    "expectedResult" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "test_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_steps" (
    "id" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "expectedResult" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "test_folders_projectId_parentId_idx" ON "test_folders"("projectId", "parentId");

-- CreateIndex
CREATE INDEX "test_folders_projectId_deletedAt_idx" ON "test_folders"("projectId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "test_folders_projectId_slug_key" ON "test_folders"("projectId", "slug");

-- CreateIndex
CREATE INDEX "test_cases_projectId_status_idx" ON "test_cases"("projectId", "status");

-- CreateIndex
CREATE INDEX "test_cases_projectId_folderId_idx" ON "test_cases"("projectId", "folderId");

-- CreateIndex
CREATE INDEX "test_cases_projectId_deletedAt_idx" ON "test_cases"("projectId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "test_cases_projectId_code_key" ON "test_cases"("projectId", "code");

-- CreateIndex
CREATE INDEX "test_steps_testCaseId_idx" ON "test_steps"("testCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "test_steps_testCaseId_order_key" ON "test_steps"("testCaseId", "order");

-- AddForeignKey
ALTER TABLE "test_folders" ADD CONSTRAINT "test_folders_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_folders" ADD CONSTRAINT "test_folders_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "test_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "test_folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_steps" ADD CONSTRAINT "test_steps_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
