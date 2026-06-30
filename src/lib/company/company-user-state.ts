import type { CompanyUserStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/** prisma 또는 트랜잭션 client(둘 다 같은 delegate 시그니처). 공용 CO helper 가 tx 안에서도 동작하게 한다. */
type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * c9-1: Company 단위 사용자 활성/비활성 상태 helper.
 *
 * Fallback 정책(문서화 + smoke test 검증):
 * - CompanyUserState 레코드가 **없으면 ACTIVE 로 간주**한다(보수적 fallback).
 * - INACTIVE 는 오직 deactivate API 로 명시 생성된 경우에만 발생한다.
 * - migration backfill + seed 가 기존/demo 멤버의 ACTIVE 레코드를 보장하므로, 누락 상태는
 *   배포 과도기를 위한 안전망일 뿐 정상 경로에서는 거의 발생하지 않는다.
 *   (레코드 누락만으로 사용자를 전부 차단하지 않기 위함)
 */

/** (companyId, userId) 가 해당 Company 에서 활성인지. 레코드 없으면 ACTIVE 로 간주. */
export async function isCompanyUserActive(companyId: string, userId: string): Promise<boolean> {
  const state = await prisma.companyUserState.findUnique({
    where: { companyId_userId: { companyId, userId } },
    select: { status: true },
  });

  return !state || state.status === "ACTIVE";
}

/** 해당 User 가 **INACTIVE** 인 Company id 집합. (me/멤버십 선택에서 제외용) */
export async function getInactiveCompanyIdsForUser(userId: string): Promise<Set<string>> {
  const rows = await prisma.companyUserState.findMany({
    where: { userId, status: "INACTIVE" },
    select: { companyId: true },
  });

  return new Set(rows.map((row) => row.companyId));
}

/**
 * c9-4: 해당 User 가 **INACTIVE Company 때문에 제외된** ACTIVE WorkspaceMember 를 갖는지.
 * (활성 workspace 후보가 0인 사유가 "비활성 Company" 인지, "멤버십 자체가 없음(예: Company-only CO)"
 *  인지 구분하는 데 사용한다. companyId 가 null 인 legacy/personal workspace 는 INACTIVE 대상이 아님.)
 */
export async function hasMembershipBlockedByInactiveCompany(
  userId: string,
  inactiveCompanyIds: Set<string>,
): Promise<boolean> {
  if (inactiveCompanyIds.size === 0) {
    return false;
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      workspace: { companyId: { in: Array.from(inactiveCompanyIds) } },
    },
    select: { id: true },
  });

  return Boolean(membership);
}

/** companyIds 중 해당 User 가 INACTIVE 인 집합. */
export async function getInactiveCompanyIdsAmong(
  userId: string,
  companyIds: string[],
): Promise<Set<string>> {
  if (companyIds.length === 0) {
    return new Set();
  }

  const rows = await prisma.companyUserState.findMany({
    where: { userId, companyId: { in: companyIds }, status: "INACTIVE" },
    select: { companyId: true },
  });

  return new Set(rows.map((row) => row.companyId));
}

/**
 * 대상 User 가 해당 Company 소속인지(상태/멤버십/Role 어느 하나라도) 확인한다.
 * activate/deactivate 대상 검증용(타 Company/미존재 → 404 처리에 사용).
 */
export async function isUserInCompany(companyId: string, userId: string): Promise<boolean> {
  const state = await prisma.companyUserState.findUnique({
    where: { companyId_userId: { companyId, userId } },
    select: { userId: true },
  });

  if (state) {
    return true;
  }

  const workspaces = await prisma.workspace.findMany({
    where: { companyId },
    select: { id: true },
  });
  const workspaceIds = workspaces.map((workspace) => workspace.id);

  const member = await prisma.workspaceMember.findFirst({
    where: { userId, workspaceId: { in: workspaceIds } },
    select: { id: true },
  });

  if (member) {
    return true;
  }

  const projects = await prisma.project.findMany({
    where: { workspaceId: { in: workspaceIds } },
    select: { id: true },
  });
  const projectIds = projects.map((project) => project.id);

  const role = await prisma.userRole.findFirst({
    where: {
      userId,
      OR: [
        { scopeType: "COMPANY", scopeId: companyId },
        { scopeType: "WORKSPACE", scopeId: { in: workspaceIds } },
        { scopeType: "PROJECT", scopeId: { in: projectIds } },
      ],
    },
    select: { id: true },
  });

  return Boolean(role);
}

/**
 * c9-1/c10-1.1 공용: 한 Company 의 **ACTIVE CO** userId 목록.
 *
 * 기준(deactivate 와 withdrawal 이 동일): COMPANY/CO UserRole 보유자 중
 * CompanyUserState 가 **INACTIVE 인 사람만 제외**한다. CompanyUserState 레코드가 없는
 * legacy CO 는 ACTIVE 로 간주(레코드 없음=ACTIVE 인 기존 fallback 과 일관).
 *
 * client 로 트랜잭션 client 를 받을 수 있어 deactivate/withdraw 의 tx 내부에서 재검증 가능.
 */
export async function getActiveCompanyOwnerIds(
  client: DbClient,
  companyId: string,
): Promise<string[]> {
  const cos = await client.userRole.findMany({
    where: { scopeType: "COMPANY", scopeId: companyId, role: "CO" },
    select: { userId: true },
  });
  const coIds = cos.map((co) => co.userId);
  if (coIds.length === 0) {
    return [];
  }
  const inactive = await client.companyUserState.findMany({
    where: { companyId, userId: { in: coIds }, status: "INACTIVE" },
    select: { userId: true },
  });
  const inactiveSet = new Set(inactive.map((state) => state.userId));
  return coIds.filter((id) => !inactiveSet.has(id));
}

/**
 * c10-1.1: 해당 User 가 **마지막 ACTIVE CO** 인 Company id 목록(bulk, Company 별 N+1 없음).
 *
 * - 사용자가 COMPANY/CO Role 을 가진 Company 만 대상.
 * - 사용자가 그 Company 에서 INACTIVE 면 이미 ACTIVE CO 가 아니므로 제외(관리자 공백 유발 안 함).
 * - 남은 Company 중 ACTIVE CO 수가 1명(=본인)뿐인 Company 를 반환.
 *   legacy(상태 레코드 없음) CO 는 ACTIVE 로 계산(c9-1 fallback 과 동일) → 단독 legacy CO 도 차단된다.
 *
 * 반환이 비어있지 않으면 self withdrawal 을 차단한다. tx client 로 같은 트랜잭션 내부 재검증에 사용.
 */
export async function getCompaniesWhereUserIsLastActiveCO(
  client: DbClient,
  userId: string,
): Promise<string[]> {
  const myCoRoles = await client.userRole.findMany({
    where: { userId, scopeType: "COMPANY", role: "CO" },
    select: { scopeId: true },
  });
  const coCompanyIds = Array.from(new Set(myCoRoles.map((role) => role.scopeId)));
  if (coCompanyIds.length === 0) {
    return [];
  }

  // 본인이 INACTIVE 인 Company 는 제외(이미 ACTIVE CO 아님).
  const myInactive = await client.companyUserState.findMany({
    where: { userId, companyId: { in: coCompanyIds }, status: "INACTIVE" },
    select: { companyId: true },
  });
  const myInactiveSet = new Set(myInactive.map((state) => state.companyId));
  const activeCoCompanyIds = coCompanyIds.filter((id) => !myInactiveSet.has(id));
  if (activeCoCompanyIds.length === 0) {
    return [];
  }

  // 대상 Company 들의 모든 CO + INACTIVE 상태를 각각 1회 bulk 조회(N+1 없음).
  const allCos = await client.userRole.findMany({
    where: { scopeType: "COMPANY", role: "CO", scopeId: { in: activeCoCompanyIds } },
    select: { userId: true, scopeId: true },
  });
  const coUserIds = Array.from(new Set(allCos.map((co) => co.userId)));
  const inactiveStates = await client.companyUserState.findMany({
    where: { companyId: { in: activeCoCompanyIds }, userId: { in: coUserIds }, status: "INACTIVE" },
    select: { companyId: true, userId: true },
  });
  const inactivePair = new Set(inactiveStates.map((state) => `${state.companyId}:${state.userId}`));

  // Company 별 ACTIVE CO 수 집계.
  const activeCountByCompany = new Map<string, number>();
  for (const co of allCos) {
    if (inactivePair.has(`${co.scopeId}:${co.userId}`)) {
      continue;
    }
    activeCountByCompany.set(co.scopeId, (activeCountByCompany.get(co.scopeId) ?? 0) + 1);
  }

  // 본인이 ACTIVE CO 이면서 그 Company 의 ACTIVE CO 가 1명뿐 → 마지막 ACTIVE CO.
  return activeCoCompanyIds.filter((id) => (activeCountByCompany.get(id) ?? 0) <= 1);
}

/**
 * c10-6: 주어진 userIds 중 **어떤 Company 에서든 마지막 ACTIVE CO** 인 userId 집합(bulk, N+1 없음).
 *
 * getCompaniesWhereUserIsLastActiveCO 와 동일 기준(CO Role − INACTIVE; legacy 무상태=ACTIVE)을 쓰되,
 * admin active-list 의 UX hint 계산용으로 여러 User 를 4쿼리로 한 번에 처리한다.
 * (정확한 차단은 force-delete route 가 tx 내부 getCompaniesWhereUserIsLastActiveCO 로 재검증한다.)
 */
export async function getLastActiveCompanyOwnerUserIds(
  client: DbClient,
  userIds: string[],
): Promise<Set<string>> {
  if (userIds.length === 0) {
    return new Set();
  }
  const myCoRoles = await client.userRole.findMany({
    where: { userId: { in: userIds }, scopeType: "COMPANY", role: "CO" },
    select: { scopeId: true },
  });
  const companyIds = Array.from(new Set(myCoRoles.map((role) => role.scopeId)));
  if (companyIds.length === 0) {
    return new Set();
  }

  const allCos = await client.userRole.findMany({
    where: { scopeType: "COMPANY", role: "CO", scopeId: { in: companyIds } },
    select: { userId: true, scopeId: true },
  });
  const coUserIds = Array.from(new Set(allCos.map((co) => co.userId)));
  const inactiveStates = await client.companyUserState.findMany({
    where: { companyId: { in: companyIds }, userId: { in: coUserIds }, status: "INACTIVE" },
    select: { companyId: true, userId: true },
  });
  const inactivePair = new Set(inactiveStates.map((state) => `${state.companyId}:${state.userId}`));

  // Company 별 ACTIVE CO 목록.
  const activeByCompany = new Map<string, string[]>();
  for (const co of allCos) {
    if (inactivePair.has(`${co.scopeId}:${co.userId}`)) {
      continue;
    }
    const list = activeByCompany.get(co.scopeId) ?? [];
    list.push(co.userId);
    activeByCompany.set(co.scopeId, list);
  }

  // ACTIVE CO 가 1명뿐인 Company 의 그 단독 CO 가 입력 집합에 있으면 마지막 ACTIVE CO.
  const inputSet = new Set(userIds);
  const result = new Set<string>();
  for (const list of activeByCompany.values()) {
    if (list.length === 1 && inputSet.has(list[0])) {
      result.add(list[0]);
    }
  }
  return result;
}

export type CompanyUserStateView = {
  status: CompanyUserStatus;
  deactivatedAt: string | null;
  reactivatedAt: string | null;
};
