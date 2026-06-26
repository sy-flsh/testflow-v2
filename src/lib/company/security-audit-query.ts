import type { Prisma } from "@prisma/client";
import {
  normalizeSecurityAuditDate,
  normalizeSecurityAuditEventType,
  normalizeSecurityAuditQuery,
  normalizeSecurityAuditSort,
} from "@/lib/company/security-audit-filters";
import type {
  SecurityAuditEventTypeFilter,
  SecurityAuditSort,
  SecurityAuditUserRef,
} from "@/lib/company/types";
import { prisma } from "@/lib/db/prisma";

/**
 * c9-8: list / export / summary 가 100% 동일한 필터 규칙을 공유하도록 추출한 서버 helper.
 */
export type SecurityAuditFilters = {
  eventType: SecurityAuditEventTypeFilter;
  from: string | null;
  to: string | null;
  user: string;
  guard: string;
  sort: SecurityAuditSort;
};

/** query 정규화(+ from>to 면 날짜 필터 전체 해제). page/size 는 호출부가 별도 처리. */
export function parseSecurityAuditFilters(searchParams: URLSearchParams): SecurityAuditFilters {
  const eventType = normalizeSecurityAuditEventType(searchParams.get("eventType"));
  const sort = normalizeSecurityAuditSort(searchParams.get("sort"));
  const user = normalizeSecurityAuditQuery(searchParams.get("user"));
  const guard = normalizeSecurityAuditQuery(searchParams.get("guard"));

  let from = normalizeSecurityAuditDate(searchParams.get("from"));
  let to = normalizeSecurityAuditDate(searchParams.get("to"));
  if (from && to && from > to) {
    from = null;
    to = null;
  }

  return { eventType, from, to, user, guard, sort };
}

/** user 검색어 → 이름/이메일 contains 로 매칭되는 userId 집합(검색 없으면 null = 미적용). */
export async function resolveMatchedUserIds(user: string): Promise<string[] | null> {
  if (!user) {
    return null;
  }
  const matched = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: user, mode: "insensitive" } },
        { email: { contains: user, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  return matched.map((u) => u.id);
}

/**
 * where 빌더. includeEventType=false 면 eventType 필터를 제외한다(summary 용 — eventType 선택은
 * 목록만 좁히고 통계는 전체 유형 비교 기준).
 */
export function buildSecurityAuditWhere(opts: {
  companyId: string;
  filters: SecurityAuditFilters;
  matchedIds: string[] | null;
  includeEventType: boolean;
}): Prisma.SecurityAuditEventWhereInput {
  const { companyId, filters, matchedIds, includeEventType } = opts;

  const occurredAt: Prisma.DateTimeFilter = {};
  if (filters.from) {
    occurredAt.gte = new Date(`${filters.from}T00:00:00.000Z`);
  }
  if (filters.to) {
    occurredAt.lte = new Date(`${filters.to}T23:59:59.999Z`);
  }

  const where: Prisma.SecurityAuditEventWhereInput = {
    companyId, // 현재 Company 로 범위 확정(companyId null·타 Company 자동 제외)
    ...(includeEventType && filters.eventType !== "ALL" ? { eventType: filters.eventType } : {}),
    ...(filters.from || filters.to ? { occurredAt } : {}),
    ...(filters.guard ? { guardName: { contains: filters.guard, mode: "insensitive" as const } } : {}),
  };

  if (matchedIds !== null) {
    where.OR = [{ actorUserId: { in: matchedIds } }, { targetUserId: { in: matchedIds } }];
  }

  return where;
}

export function securityAuditOrderBy(
  sort: SecurityAuditSort,
): Prisma.SecurityAuditEventOrderByWithRelationInput[] {
  return sort === "oldest"
    ? [{ occurredAt: "asc" }, { id: "asc" }]
    : [{ occurredAt: "desc" }, { id: "desc" }];
}

/** event 목록의 actor/target id dedupe 후 단일 bulk 조회 → userId→User map (N+1 금지). */
export async function loadAuditUserMap(
  events: Array<{ actorUserId: string | null; targetUserId: string | null }>,
): Promise<Map<string, { id: string; name: string; email: string }>> {
  const ids = Array.from(
    new Set(
      events.flatMap((event) =>
        [event.actorUserId, event.targetUserId].filter((id): id is string => Boolean(id)),
      ),
    ),
  );
  if (!ids.length) {
    return new Map();
  }
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true },
  });
  return new Map(users.map((u) => [u.id, u]));
}

/** userId + userMap → 표시 ref. 삭제된 사용자는 userId 만 유지하고 name/email 은 null. */
export function auditUserRef(
  userId: string | null,
  userMap: Map<string, { id: string; name: string; email: string }>,
): SecurityAuditUserRef | null {
  if (!userId) {
    return null;
  }
  const user = userMap.get(userId);
  return { userId, name: user?.name ?? null, email: user?.email ?? null };
}
