-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scopeType" "ScopeType" NOT NULL,
    "scopeId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_roles_scopeType_scopeId_idx" ON "user_roles"("scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "user_roles_role_idx" ON "user_roles"("role");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_scopeType_scopeId_key" ON "user_roles"("userId", "scopeType", "scopeId");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- c4 Data migration: 기존 WorkspaceMember.role 을 UserRole(WORKSPACE scope)로 이관한다.
-- 매핑: ADMIN -> WO, MEMBER -> MEMBER, VIEWER -> VIEWER (scopeType=WORKSPACE, scopeId=workspaceId)
-- 기존 workspace_members 행/role 은 그대로 보존(병존). ON CONFLICT 로 idempotent.
-- shadow DB(빈 테이블)에서는 0행 영향, 기존 데이터가 있는 DB 에서만 실제 이관된다.
INSERT INTO "user_roles" ("id", "userId", "scopeType", "scopeId", "role", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  wm."userId",
  'WORKSPACE'::"ScopeType",
  wm."workspaceId",
  (CASE wm."role"
    WHEN 'ADMIN' THEN 'WO'
    WHEN 'MEMBER' THEN 'MEMBER'
    WHEN 'VIEWER' THEN 'VIEWER'
  END)::"Role",
  now(),
  now()
FROM "workspace_members" wm
ON CONFLICT ("userId", "scopeType", "scopeId") DO NOTHING;
