import { prisma } from "@/lib/db/prisma";

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
