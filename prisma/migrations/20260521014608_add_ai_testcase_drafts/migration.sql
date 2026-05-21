-- CreateEnum
CREATE TYPE "AiDraftStatus" AS ENUM ('DRAFT', 'SAVED', 'FAILED', 'FALLBACK');

-- CreateTable
CREATE TABLE "ai_test_case_drafts" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "prompt" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'fallback',
    "status" "AiDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "items" JSONB NOT NULL,
    "errorMessage" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "savedAt" TIMESTAMP(3),

    CONSTRAINT "ai_test_case_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_test_case_drafts_projectId_status_idx" ON "ai_test_case_drafts"("projectId", "status");

-- CreateIndex
CREATE INDEX "ai_test_case_drafts_createdAt_idx" ON "ai_test_case_drafts"("createdAt");

-- AddForeignKey
ALTER TABLE "ai_test_case_drafts" ADD CONSTRAINT "ai_test_case_drafts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
