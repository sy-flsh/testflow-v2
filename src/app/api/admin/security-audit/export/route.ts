import { apiError } from "@/lib/api/response";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireRecentMasterAdminAuth,
} from "@/lib/auth/guards";
import {
  ADMIN_AUDIT_EVENT_LABELS,
  buildAdminAuditWhere,
  loadAuditCompanyMap,
  parseAdminAuditFilters,
} from "@/lib/admin/admin-security-audit-query";
import { CSV_BOM, csvRow } from "@/lib/company/csv";
import { getSecurityAuditExportLimit } from "@/lib/company/security-audit-filters";
import {
  auditUserRef,
  loadAuditUserMap,
  resolveMatchedUserIds,
  securityAuditOrderBy,
} from "@/lib/company/security-audit-query";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

const CSV_HEADER = [
  "발생 시각",
  "이벤트 코드",
  "이벤트 이름",
  "범위",
  "Company 이름",
  "Company ID",
  "처리자 이름",
  "처리자 이메일",
  "처리자 사용자 ID",
  "대상 사용자 이름",
  "대상 사용자 이메일",
  "대상 사용자 ID",
  "발생 위치",
];

/**
 * c10-3: MasterAdmin 전역 보안 감사 로그 CSV export (read-only).
 * GET /api/admin/security-audit/export?eventType&scope&from&to&user&guard&sort
 *
 * - list 와 동일 필터(공용 helper). page/size 무시, 필터 전체 export.
 * - 기존 안전 상한(기본 10000) 재사용 → 초과 시 422 SECURITY_AUDIT_EXPORT_LIMIT_EXCEEDED.
 * - UTF-8 BOM + RFC4180 escape + formula injection 방지 재사용. metadata/throttle/raw 미포함.
 */
export async function GET(request: Request) {
  try {
    await requireRecentMasterAdminAuth();

    const url = new URL(request.url);
    const filters = parseAdminAuditFilters(url.searchParams);
    const matchedIds = await resolveMatchedUserIds(filters.user);
    const where = buildAdminAuditWhere({ filters, matchedIds, includeEventType: true });

    const limit = getSecurityAuditExportLimit();
    const total = await prisma.securityAuditEvent.count({ where });

    if (total > limit) {
      return apiError(
        `내보낼 수 있는 보안 감사 로그는 최대 ${limit.toLocaleString("en-US")}건입니다. 기간 또는 필터를 좁혀 주세요.`,
        422,
        "SECURITY_AUDIT_EXPORT_LIMIT_EXCEEDED",
      );
    }

    const events = await prisma.securityAuditEvent.findMany({
      where,
      orderBy: securityAuditOrderBy(filters.sort),
      take: limit,
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

    const lines: string[] = [csvRow(CSV_HEADER)];
    for (const event of events) {
      const actor = auditUserRef(event.actorUserId, userMap);
      const target = auditUserRef(event.targetUserId, userMap);

      // actor 없음 → "시스템"; 탈퇴 → "탈퇴한 사용자"; 물리 삭제 → "삭제된 사용자".
      const actorName = !actor
        ? "시스템"
        : actor.withdrawn
          ? "탈퇴한 사용자"
          : actor.name ?? "삭제된 사용자";
      const targetName = !target
        ? ""
        : target.withdrawn
          ? "탈퇴한 사용자"
          : target.name ?? "삭제된 사용자";

      const isCompany = Boolean(event.companyId);

      lines.push(
        csvRow([
          event.occurredAt.toISOString(),
          event.eventType,
          ADMIN_AUDIT_EVENT_LABELS[event.eventType] ?? event.eventType,
          isCompany ? "COMPANY" : "GLOBAL",
          isCompany ? companyMap.get(event.companyId as string) ?? "" : "",
          isCompany ? (event.companyId as string) : "",
          actorName,
          actor?.email ?? "", // 탈퇴/삭제 사용자는 null → 빈 값(미노출).
          actor?.userId ?? "",
          targetName,
          target?.email ?? "",
          target?.userId ?? "",
          event.guardName ?? "",
        ]),
      );
    }

    const body = CSV_BOM + lines.join("\r\n");
    const filename = `admin-security-audit-${exportTimestamp()}.csv`;

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (isAuthGuardError(error)) {
      return authGuardErrorResponse(error);
    }

    console.error(error);
    return apiError("전역 보안 감사 로그를 내보내지 못했습니다.", 500, "ADMIN_SECURITY_AUDIT_EXPORT_FAILED");
  }
}

/** 파일명용 UTC 타임스탬프 YYYYMMDD-HHmmss (사용자 입력 미포함). */
function exportTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`
  );
}
