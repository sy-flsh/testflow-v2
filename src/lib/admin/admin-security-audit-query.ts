import type { Prisma } from "@prisma/client";
import {
  type AdminAuditEventTypeFilter,
  type AdminAuditScopeFilter,
  normalizeAdminAuditEventType,
  normalizeAdminAuditScope,
} from "@/lib/admin/admin-audit-constants";
import {
  normalizeSecurityAuditDate,
  normalizeSecurityAuditQuery,
  normalizeSecurityAuditSort,
} from "@/lib/company/security-audit-filters";
import type { SecurityAuditSort } from "@/lib/company/types";
import { prisma } from "@/lib/db/prisma";

/**
 * c10-3: MasterAdmin 전역 보안 감사 콘솔의 공용 필터/where helper.
 *
 * - Company audit(c9-7~c9-9)와 달리 단일 Company 로 범위를 고정하지 않고 SecurityAuditEvent 전체를 본다.
 * - scope: COMPANY(companyId not null) / GLOBAL(companyId null) / ALL.
 * - eventType 은 5종 전체(Company 3종 + global lifecycle 2종)를 지원한다.
 * - 상수/정규화/라벨은 client-safe admin-audit-constants 에서, 범용 로직은 c9 helper 를 재사용한다.
 */

// CSV export route 가 라벨을 쓰므로 re-export(서버 모듈에서 한 곳으로 import 하기 위함).
export { ADMIN_AUDIT_EVENT_LABELS } from "@/lib/admin/admin-audit-constants";

export type AdminAuditFilters = {
  eventType: AdminAuditEventTypeFilter;
  scope: AdminAuditScopeFilter;
  from: string | null;
  to: string | null;
  user: string;
  guard: string;
  sort: SecurityAuditSort;
};

/** query 정규화(+ from>to 면 날짜 필터 전체 해제 — c9-7 동일 규칙). page/size 는 호출부 처리. */
export function parseAdminAuditFilters(searchParams: URLSearchParams): AdminAuditFilters {
  const eventType = normalizeAdminAuditEventType(searchParams.get("eventType"));
  const scope = normalizeAdminAuditScope(searchParams.get("scope"));
  const sort = normalizeSecurityAuditSort(searchParams.get("sort"));
  const user = normalizeSecurityAuditQuery(searchParams.get("user"));
  const guard = normalizeSecurityAuditQuery(searchParams.get("guard"));

  let from = normalizeSecurityAuditDate(searchParams.get("from"));
  let to = normalizeSecurityAuditDate(searchParams.get("to"));
  if (from && to && from > to) {
    from = null;
    to = null;
  }

  return { eventType, scope, from, to, user, guard, sort };
}

/**
 * where 빌더. includeEventType=false 면 eventType 필터 제외(summary 용 — 유형 선택은 목록만 좁히고
 * 통계는 전체 유형 비교 기준). companyId 범위는 scope 로만 제한한다(특정 Company 로 고정하지 않음).
 */
export function buildAdminAuditWhere(opts: {
  filters: AdminAuditFilters;
  matchedIds: string[] | null;
  includeEventType: boolean;
}): Prisma.SecurityAuditEventWhereInput {
  const { filters, matchedIds, includeEventType } = opts;

  const occurredAt: Prisma.DateTimeFilter = {};
  if (filters.from) {
    occurredAt.gte = new Date(`${filters.from}T00:00:00.000Z`);
  }
  if (filters.to) {
    occurredAt.lte = new Date(`${filters.to}T23:59:59.999Z`);
  }

  const where: Prisma.SecurityAuditEventWhereInput = {
    ...(includeEventType && filters.eventType !== "ALL" ? { eventType: filters.eventType } : {}),
    ...(filters.scope === "COMPANY" ? { companyId: { not: null } } : {}),
    ...(filters.scope === "GLOBAL" ? { companyId: null } : {}),
    ...(filters.from || filters.to ? { occurredAt } : {}),
    ...(filters.guard ? { guardName: { contains: filters.guard, mode: "insensitive" as const } } : {}),
  };

  if (matchedIds !== null) {
    where.OR = [{ actorUserId: { in: matchedIds } }, { targetUserId: { in: matchedIds } }];
  }

  return where;
}

/** event 목록의 companyId dedupe 후 단일 bulk 조회 → companyId→name map (N+1 금지). */
export async function loadAuditCompanyMap(
  events: Array<{ companyId: string | null }>,
): Promise<Map<string, string>> {
  const ids = Array.from(
    new Set(events.map((event) => event.companyId).filter((id): id is string => Boolean(id))),
  );
  if (!ids.length) {
    return new Map();
  }
  const companies = await prisma.company.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  return new Map(companies.map((company) => [company.id, company.name]));
}
