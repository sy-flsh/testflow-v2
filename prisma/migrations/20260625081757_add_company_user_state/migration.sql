-- CreateEnum
CREATE TYPE "CompanyUserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "company_user_states" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "CompanyUserStatus" NOT NULL DEFAULT 'ACTIVE',
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedByUserId" TEXT,
    "reactivatedAt" TIMESTAMP(3),
    "reactivatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_user_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_user_states_companyId_status_idx" ON "company_user_states"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "company_user_states_companyId_userId_key" ON "company_user_states"("companyId", "userId");

-- AddForeignKey
ALTER TABLE "company_user_states" ADD CONSTRAINT "company_user_states_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_user_states" ADD CONSTRAINT "company_user_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- c9-1 backfill: 기존 Company 멤버(= 해당 Company scope UserRole 보유자 ∪ 해당 Company Workspace 멤버)를
-- 모두 ACTIVE 로 생성한다. (companyId, userId) 중복은 ON CONFLICT DO NOTHING 으로 안전 처리.
INSERT INTO "company_user_states" ("id", "companyId", "userId", "status", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, src."companyId", src."userId", 'ACTIVE', now(), now()
FROM (
  -- COMPANY scope UserRole
  SELECT ur."scopeId" AS "companyId", ur."userId" AS "userId"
  FROM "user_roles" ur
  WHERE ur."scopeType" = 'COMPANY'
  UNION
  -- WORKSPACE scope UserRole → 상위 Company
  SELECT w."companyId", ur."userId"
  FROM "user_roles" ur
  JOIN "workspaces" w ON w."id" = ur."scopeId"
  WHERE ur."scopeType" = 'WORKSPACE' AND w."companyId" IS NOT NULL
  UNION
  -- PROJECT scope UserRole → 상위 Workspace 의 Company
  SELECT w."companyId", ur."userId"
  FROM "user_roles" ur
  JOIN "projects" p ON p."id" = ur."scopeId"
  JOIN "workspaces" w ON w."id" = p."workspaceId"
  WHERE ur."scopeType" = 'PROJECT' AND w."companyId" IS NOT NULL
  UNION
  -- WorkspaceMember → 상위 Company
  SELECT w."companyId", wm."userId"
  FROM "workspace_members" wm
  JOIN "workspaces" w ON w."id" = wm."workspaceId"
  WHERE w."companyId" IS NOT NULL
) src
WHERE src."companyId" IS NOT NULL
ON CONFLICT ("companyId", "userId") DO NOTHING;
