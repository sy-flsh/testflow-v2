-- c10-7: MasterAdmin identity 를 User.id 로 고정.
-- AlterTable: userId nullable 추가(legacy email/passwordHash 은 보존하되 인증 기준에서 배제).
ALTER TABLE "master_admins" ADD COLUMN     "userId" TEXT;

-- Fail-closed backfill: User.email 은 unique 이므로 email 1:1 매칭만 채운다.
-- 매칭되는 User 가 없으면 userId 는 NULL 유지(권한 미인정). 임의 User 에 자동 연결하지 않는다.
UPDATE "master_admins" m
SET "userId" = u."id"
FROM "users" u
WHERE u."email" = m."email" AND m."userId" IS NULL;

-- CreateIndex: userId 1:1(unique). NULL 다중 허용(Postgres) → 미연결 row 공존 가능.
CREATE UNIQUE INDEX "master_admins_userId_key" ON "master_admins"("userId");

-- AddForeignKey: onDelete Restrict 로 연결 User 의 물리 삭제를 막아 binding 보존(soft delete 영향 없음).
ALTER TABLE "master_admins" ADD CONSTRAINT "master_admins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
