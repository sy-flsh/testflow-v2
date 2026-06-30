import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * c10-2: MasterAdmin 권한 판정의 단일 진실원.
 *
 * MasterAdmin 여부는 **DB MasterAdmin 테이블**로만 판단한다(Company CO/Workspace/UserRole 과 분리,
 * 하드코딩 email 비교 금지). 로그인 세션은 User 기반이므로, 세션 User 의 email 과 동일한
 * **활성 MasterAdmin 레코드**가 있으면 MasterAdmin 으로 본다(seed 가 같은 email 의 User 를 보장).
 */

/** 세션 User email 로 활성 MasterAdmin 레코드를 찾는다(없거나 비활성이면 null). */
export async function findActiveMasterAdminByEmail(
  email: string,
): Promise<{ id: string } | null> {
  const master = await prisma.masterAdmin.findUnique({
    where: { email },
    select: { id: true, isActive: true },
  });
  return master && master.isActive ? { id: master.id } : null;
}

/** 해당 email 이 활성 MasterAdmin 인지 boolean. (auth payload 의 isMasterAdmin flag 용) */
export async function isMasterAdminEmail(email: string): Promise<boolean> {
  return Boolean(await findActiveMasterAdminByEmail(email));
}

/**
 * c10-6: **활성 MasterAdmin email 집합**.
 * 활성 = MasterAdmin.isActive 이고 동일 email User 가 존재하며 deletedAt=null(탈퇴/강제정지 미포함).
 * 마지막 MasterAdmin 보호(force-delete) 및 active-list UX hint 의 bulk 계산용. tx client 재검증 가능.
 */
export async function getActiveMasterAdminEmails(client: DbClient = prisma): Promise<Set<string>> {
  const masters = await client.masterAdmin.findMany({
    where: { isActive: true },
    select: { email: true },
  });
  const emails = masters.map((m) => m.email);
  if (emails.length === 0) {
    return new Set();
  }
  const activeUsers = await client.user.findMany({
    where: { email: { in: emails }, deletedAt: null },
    select: { email: true },
  });
  return new Set(activeUsers.map((u) => u.email));
}
