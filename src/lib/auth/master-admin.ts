import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * c10-2/c10-7: MasterAdmin 권한 판정의 단일 진실원 — **User.id binding 기준**.
 *
 * c10-7: identity 는 email 이 아니라 `MasterAdmin.userId(= User.id)` 로 고정한다.
 * - 활성 MasterAdmin = `MasterAdmin.isActive = true` AND `userId != null` AND 연결 User 가 `deletedAt = null`.
 * - **userId 가 null 이거나 연결 User 가 없는 row 는 권한으로 인정하지 않는다(fail-closed).**
 * - legacy `email`/`passwordHash` 는 보존하되 **인증 source of truth 가 아니다**(여기서 사용하지 않는다).
 *   (재인증은 c10-5 정책대로 현재 Session User 의 passwordHash 로만 검증한다.)
 */

/** session User id 로 활성 MasterAdmin 레코드를 찾는다(없거나 비활성/탈퇴면 null). */
export async function findActiveMasterAdminByUserId(
  userId: string,
): Promise<{ id: string } | null> {
  const master = await prisma.masterAdmin.findFirst({
    where: { userId, isActive: true, user: { deletedAt: null } },
    select: { id: true },
  });
  return master ?? null;
}

/** 해당 User 가 활성 MasterAdmin 인지 boolean. (auth payload 의 isMasterAdmin flag 용) */
export async function isMasterAdminUserId(userId: string): Promise<boolean> {
  return Boolean(await findActiveMasterAdminByUserId(userId));
}

/**
 * c10-6/c10-7: **활성 MasterAdmin 의 userId 집합**.
 * MasterAdmin.isActive + userId not null + 연결 User.deletedAt=null 만 포함(unbound/legacy row 제외).
 * 마지막 MasterAdmin 보호(force-delete) 및 active-list UX hint 의 bulk 계산용. tx client 재검증 가능.
 */
export async function getActiveMasterAdminUserIds(client: DbClient = prisma): Promise<Set<string>> {
  const masters = await client.masterAdmin.findMany({
    where: { isActive: true, userId: { not: null }, user: { deletedAt: null } },
    select: { userId: true },
  });
  const ids = masters
    .map((m) => m.userId)
    .filter((id): id is string => id !== null);
  return new Set(ids);
}
