-- c2: Workspace를 Company 하위로 연결 (expand 단계, 기존 데이터 보존)
-- companyId 는 nullable 로 도입한다. 기존 signup 경로가 company 없이 Workspace를
-- 생성하므로 NOT NULL 강제는 Company-aware signup 전환(c5)에서 처리한다.
-- ownerUserId 는 relation 미연결 nullable 스칼라(User 모델 무변경).

-- AlterTable: nullable 컬럼 추가
ALTER TABLE "workspaces" ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "ownerUserId" TEXT;

-- Backfill: 기존 워크스페이스를 가장 먼저 생성된 Company(기본 testflow-demo)에 연결.
-- companies 가 비어 있으면(신규 배포) NULL 로 남고, 이후 단계에서 backfill 한다.
UPDATE "workspaces"
SET "companyId" = (SELECT "id" FROM "companies" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "companyId" IS NULL;

-- CreateIndex
CREATE INDEX "workspaces_companyId_idx" ON "workspaces"("companyId");

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
