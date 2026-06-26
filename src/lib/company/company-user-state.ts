import type { CompanyUserStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

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

export type CompanyUserStateView = {
  status: CompanyUserStatus;
  deactivatedAt: string | null;
  reactivatedAt: string | null;
};
