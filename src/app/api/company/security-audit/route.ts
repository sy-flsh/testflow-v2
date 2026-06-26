import { apiError, apiSuccess } from "@/lib/api/response";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireCompanyOwner,
} from "@/lib/auth/guards";
import { normalizeSecurityAuditPage, normalizeSecurityAuditSize } from "@/lib/company/security-audit-filters";
import {
  auditUserRef,
  buildSecurityAuditWhere,
  loadAuditUserMap,
  parseSecurityAuditFilters,
  resolveMatchedUserIds,
  securityAuditOrderBy,
} from "@/lib/company/security-audit-query";
import type { SecurityAuditEventDto, SecurityAuditSummary } from "@/lib/company/types";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

/**
 * c9-7/c9-8: Company 보안 감사 로그 조회 (read-only, CO 전용) + 유형별 summary.
 * GET /api/company/security-audit?eventType=ALL&from=&to=&user=&guard=&page=1&size=20&sort=newest
 *
 * - requireCompanyOwner: 비CO 403 AUTH_FORBIDDEN, INACTIVE CO 403 USER_INACTIVE(c9-1/c9-4).
 * - 범위: SecurityAuditEvent.companyId = 현재 CO Company 만(companyId null·타 Company 미포함).
 * - summary: 현재 date/user/guard 필터 적용, **eventType 필터는 제외**(유형별 비교 유지). page/size 무관.
 * - metadata/throttleKey/internal/raw 민감정보는 응답에 포함하지 않는다.
 */
export async function GET(request: Request) {
  try {
    const { companyId } = await requireCompanyOwner();

    const url = new URL(request.url);
    const filters = parseSecurityAuditFilters(url.searchParams);
    const size = normalizeSecurityAuditSize(url.searchParams.get("size"));
    const requestedPage = normalizeSecurityAuditPage(url.searchParams.get("page"));

    // user 검색 매칭 ID 는 list/summary 공용으로 1회만 조회.
    const matchedIds = await resolveMatchedUserIds(filters.user);

    const listWhere = buildSecurityAuditWhere({
      companyId,
      filters,
      matchedIds,
      includeEventType: true,
    });
    const summaryWhere = buildSecurityAuditWhere({
      companyId,
      filters,
      matchedIds,
      includeEventType: false,
    });

    const total = await prisma.securityAuditEvent.count({ where: listWhere });
    const totalPages = Math.ceil(total / size);
    const page = total === 0 ? 1 : Math.min(Math.max(1, requestedPage), totalPages);

    const events = await prisma.securityAuditEvent.findMany({
      where: listWhere,
      orderBy: securityAuditOrderBy(filters.sort),
      skip: (page - 1) * size,
      take: size,
      select: {
        id: true,
        eventType: true,
        occurredAt: true,
        guardName: true,
        actorUserId: true,
        targetUserId: true,
      },
    });

    const userMap = await loadAuditUserMap(events);
    const items: SecurityAuditEventDto[] = events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      occurredAt: event.occurredAt.toISOString(),
      guardName: event.guardName,
      actor: auditUserRef(event.actorUserId, userMap),
      target: auditUserRef(event.targetUserId, userMap),
    }));

    // summary: eventType 제외 필터 기준 유형별 count.
    const grouped = await prisma.securityAuditEvent.groupBy({
      by: ["eventType"],
      where: summaryWhere,
      _count: { _all: true },
    });
    const summary: SecurityAuditSummary = {
      total: 0,
      byEventType: {
        COMPANY_USER_DEACTIVATED: 0,
        COMPANY_USER_REACTIVATED: 0,
        INACTIVE_COMPANY_ACCESS_DENIED: 0,
      },
    };
    for (const row of grouped) {
      // c10-1: 전역 lifecycle 이벤트(USER_SOFT_DELETED/USER_RESTORED)는 companyId=null 이라 이 Company
      // 범위 query 결과에 포함되지 않는다. 방어적으로 알려진 3종만 집계(타입 안전 + 범위 정책 유지).
      if (
        row.eventType === "COMPANY_USER_DEACTIVATED" ||
        row.eventType === "COMPANY_USER_REACTIVATED" ||
        row.eventType === "INACTIVE_COMPANY_ACCESS_DENIED"
      ) {
        summary.byEventType[row.eventType] = row._count._all;
        summary.total += row._count._all;
      }
    }

    return apiSuccess({
      companyId,
      events: items,
      pagination: {
        page,
        size,
        total,
        totalPages,
        hasPrevious: page > 1,
        hasNext: page < totalPages,
      },
      summary,
      filters: {
        eventType: filters.eventType,
        from: filters.from,
        to: filters.to,
        user: filters.user || null,
        guard: filters.guard || null,
        sort: filters.sort,
      },
    });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("보안 감사 로그를 불러오지 못했습니다.", 500, "SECURITY_AUDIT_LIST_FAILED");
  }
}
