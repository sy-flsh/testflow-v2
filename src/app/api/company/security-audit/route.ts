import type { Prisma } from "@prisma/client";
import { apiError, apiSuccess } from "@/lib/api/response";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireCompanyOwner,
} from "@/lib/auth/guards";
import {
  normalizeSecurityAuditDate,
  normalizeSecurityAuditEventType,
  normalizeSecurityAuditPage,
  normalizeSecurityAuditQuery,
  normalizeSecurityAuditSize,
  normalizeSecurityAuditSort,
} from "@/lib/company/security-audit-filters";
import type {
  SecurityAuditEventDto,
  SecurityAuditUserRef,
} from "@/lib/company/types";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

/**
 * c9-7: Company 보안 감사 로그 조회 (read-only, CO 전용).
 * GET /api/company/security-audit?eventType=ALL&from=&to=&user=&guard=&page=1&size=20&sort=newest
 *
 * - requireCompanyOwner: 비CO 403 AUTH_FORBIDDEN, INACTIVE CO 403 USER_INACTIVE(c9-1/c9-4).
 * - 범위: SecurityAuditEvent.companyId = 현재 CO Company 만(companyId null·타 Company 미포함).
 * - 날짜는 UTC day boundary(from=00:00:00.000Z inclusive, to=23:59:59.999Z inclusive),
 *   잘못된 날짜/형식은 해당 필터만 무시, from>to 면 날짜 필터 전체 해제(fallback).
 * - user 검색: 현재 이름/이메일 contains 로 매칭되는 userId 집합을 actor/target IN 으로 DB 필터(total 정확).
 *   삭제된 User 는 audit event 가 남고 actor/target name/email 은 null + userId 유지.
 * - metadata/throttleKey/internal/raw 민감정보는 응답에 포함하지 않는다.
 */
export async function GET(request: Request) {
  try {
    const { companyId } = await requireCompanyOwner();

    const url = new URL(request.url);
    const eventType = normalizeSecurityAuditEventType(url.searchParams.get("eventType"));
    const sort = normalizeSecurityAuditSort(url.searchParams.get("sort"));
    const size = normalizeSecurityAuditSize(url.searchParams.get("size"));
    const requestedPage = normalizeSecurityAuditPage(url.searchParams.get("page"));
    const user = normalizeSecurityAuditQuery(url.searchParams.get("user"));
    const guard = normalizeSecurityAuditQuery(url.searchParams.get("guard"));

    let from = normalizeSecurityAuditDate(url.searchParams.get("from"));
    let to = normalizeSecurityAuditDate(url.searchParams.get("to"));

    // from > to 면 모호함을 피하기 위해 날짜 필터 전체를 해제한다(swap 하지 않음).
    if (from && to && from > to) {
      from = null;
      to = null;
    }

    const occurredAt: Prisma.DateTimeFilter = {};
    if (from) {
      occurredAt.gte = new Date(`${from}T00:00:00.000Z`);
    }
    if (to) {
      occurredAt.lte = new Date(`${to}T23:59:59.999Z`);
    }

    const where: Prisma.SecurityAuditEventWhereInput = {
      companyId, // 현재 Company 로 범위 확정(companyId null·타 Company 자동 제외)
      ...(eventType !== "ALL" ? { eventType } : {}),
      ...(from || to ? { occurredAt } : {}),
      ...(guard ? { guardName: { contains: guard, mode: "insensitive" as const } } : {}),
    };

    // user 검색: 이름/이메일 contains 로 매칭되는 userId → actor/target IN 으로 DB 필터.
    if (user) {
      const matched = await prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: user, mode: "insensitive" } },
            { email: { contains: user, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });
      const matchedIds = matched.map((u) => u.id);
      where.OR = [{ actorUserId: { in: matchedIds } }, { targetUserId: { in: matchedIds } }];
    }

    const total = await prisma.securityAuditEvent.count({ where });
    const totalPages = Math.ceil(total / size);
    const page = total === 0 ? 1 : Math.min(Math.max(1, requestedPage), totalPages);

    const events = await prisma.securityAuditEvent.findMany({
      where,
      orderBy:
        sort === "oldest"
          ? [{ occurredAt: "asc" }, { id: "asc" }]
          : [{ occurredAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * size,
      take: size,
      select: {
        id: true,
        eventType: true,
        occurredAt: true,
        guardName: true,
        actorUserId: true,
        targetUserId: true,
        // metadata 등은 select 하지 않는다.
      },
    });

    // actor/target userId dedupe 후 단일 bulk 조회(N+1 금지).
    const userIds = Array.from(
      new Set(
        events.flatMap((event) =>
          [event.actorUserId, event.targetUserId].filter((id): id is string => Boolean(id)),
        ),
      ),
    );
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const ref = (userId: string | null): SecurityAuditUserRef | null => {
      if (!userId) {
        return null;
      }
      const u = userMap.get(userId);
      return { userId, name: u?.name ?? null, email: u?.email ?? null };
    };

    const items: SecurityAuditEventDto[] = events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      occurredAt: event.occurredAt.toISOString(),
      guardName: event.guardName,
      actor: ref(event.actorUserId),
      target: ref(event.targetUserId),
    }));

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
      filters: {
        eventType,
        from: from || null,
        to: to || null,
        user: user || null,
        guard: guard || null,
        sort,
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
