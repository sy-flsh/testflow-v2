import { apiError, apiSuccess } from "@/lib/api/response";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireRecentMasterAdminAuth,
} from "@/lib/auth/guards";
import {
  buildAdminAuditWhere,
  loadAuditCompanyMap,
  parseAdminAuditFilters,
} from "@/lib/admin/admin-security-audit-query";
import type { AdminAuditEventDto, AdminAuditSummary } from "@/lib/admin/types";
import {
  normalizeSecurityAuditPage,
  normalizeSecurityAuditSize,
} from "@/lib/company/security-audit-filters";
import {
  auditUserRef,
  loadAuditUserMap,
  resolveMatchedUserIds,
  securityAuditOrderBy,
} from "@/lib/company/security-audit-query";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

/**
 * c10-3: MasterAdmin 전역 보안 감사 로그 조회(read-only).
 * GET /api/admin/security-audit?eventType=ALL&scope=ALL&from=&to=&user=&guard=&page=1&size=20&sort=newest
 *
 * - requireMasterAdmin: 비로그인 401, 탈퇴 403 USER_ACCOUNT_DELETED, 비-Master 403 AUTH_FORBIDDEN.
 * - 범위: SecurityAuditEvent 전체. scope 로 COMPANY(companyId not null)/GLOBAL(null)/ALL 만 제한.
 * - summary: eventType 제외, scope/date/user/guard 적용. 5종 0 포함. metadata/throttle/raw 미반환.
 */
export async function GET(request: Request) {
  try {
    await requireRecentMasterAdminAuth();

    const url = new URL(request.url);
    const filters = parseAdminAuditFilters(url.searchParams);
    const size = normalizeSecurityAuditSize(url.searchParams.get("size"));
    const requestedPage = normalizeSecurityAuditPage(url.searchParams.get("page"));

    const matchedIds = await resolveMatchedUserIds(filters.user);
    const listWhere = buildAdminAuditWhere({ filters, matchedIds, includeEventType: true });
    const summaryWhere = buildAdminAuditWhere({ filters, matchedIds, includeEventType: false });

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
        companyId: true,
      },
    });

    const userMap = await loadAuditUserMap(events);
    const companyMap = await loadAuditCompanyMap(events);

    const items: AdminAuditEventDto[] = events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      occurredAt: event.occurredAt.toISOString(),
      guardName: event.guardName,
      scope: event.companyId ? "COMPANY" : "GLOBAL",
      actor: auditUserRef(event.actorUserId, userMap),
      target: auditUserRef(event.targetUserId, userMap),
      company: event.companyId
        ? { companyId: event.companyId, companyName: companyMap.get(event.companyId) ?? null }
        : null,
    }));

    const grouped = await prisma.securityAuditEvent.groupBy({
      by: ["eventType"],
      where: summaryWhere,
      _count: { _all: true },
    });
    const summary: AdminAuditSummary = {
      total: 0,
      byEventType: {
        COMPANY_USER_DEACTIVATED: 0,
        COMPANY_USER_REACTIVATED: 0,
        INACTIVE_COMPANY_ACCESS_DENIED: 0,
        USER_SOFT_DELETED: 0,
        USER_RESTORED: 0,
      },
    };
    for (const row of grouped) {
      summary.byEventType[row.eventType] = row._count._all;
      summary.total += row._count._all;
    }

    return apiSuccess({
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
        scope: filters.scope,
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
    return apiError("전역 보안 감사 로그를 불러오지 못했습니다.", 500, "ADMIN_SECURITY_AUDIT_LIST_FAILED");
  }
}
