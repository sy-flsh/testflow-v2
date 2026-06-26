import { apiError } from "@/lib/api/response";
import {
  authGuardErrorResponse,
  isAuthGuardError,
  requireCompanyOwner,
} from "@/lib/auth/guards";
import { CSV_BOM, csvRow } from "@/lib/company/csv";
import {
  SECURITY_AUDIT_EVENT_LABELS,
  getSecurityAuditExportLimit,
} from "@/lib/company/security-audit-filters";
import {
  auditUserRef,
  buildSecurityAuditWhere,
  loadAuditUserMap,
  parseSecurityAuditFilters,
  resolveMatchedUserIds,
  securityAuditOrderBy,
} from "@/lib/company/security-audit-query";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

const CSV_HEADER = [
  "발생 시각",
  "이벤트 유형 코드",
  "이벤트 유형 이름",
  "처리자 이름",
  "처리자 이메일",
  "처리자 사용자 ID",
  "대상 사용자 이름",
  "대상 사용자 이메일",
  "대상 사용자 ID",
  "발생 위치",
];

/**
 * c9-8: Company 보안 감사 로그 CSV export (CO 전용, read-only).
 * GET /api/company/security-audit/export?eventType&from&to&user&guard&sort
 *
 * - list API 와 100% 동일한 필터(공용 helper). page/size 는 무시하고 필터 조건 전체를 내보낸다.
 * - 안전 상한(기본 10000): 초과면 422 SECURITY_AUDIT_EXPORT_LIMIT_EXCEEDED.
 * - UTF-8 BOM + RFC4180 escape + formula injection(`=+-@` → `'`) 방지.
 * - metadata/throttle/internal/raw 민감정보는 절대 export 하지 않는다(컬럼 allowlist).
 */
export async function GET(request: Request) {
  try {
    const { companyId } = await requireCompanyOwner();

    const url = new URL(request.url);
    const filters = parseSecurityAuditFilters(url.searchParams);
    const matchedIds = await resolveMatchedUserIds(filters.user);
    const where = buildSecurityAuditWhere({
      companyId,
      filters,
      matchedIds,
      includeEventType: true,
    });

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
      take: limit, // 안전 상한(total <= limit 이지만 방어적으로 cap)
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

    const lines: string[] = [csvRow(CSV_HEADER)];
    for (const event of events) {
      const actor = auditUserRef(event.actorUserId, userMap);
      const target = auditUserRef(event.targetUserId, userMap);

      // actor 없음 → "시스템"; 삭제된(name null & userId 있음) → "삭제된 사용자".
      const actorName = !actor ? "시스템" : actor.name ?? "삭제된 사용자";
      const actorEmail = actor?.email ?? "";
      const actorId = actor?.userId ?? "";

      // target 없음 → 모든 컬럼 빈 값; 삭제된 → "삭제된 사용자" + userId.
      const targetName = !target ? "" : target.name ?? "삭제된 사용자";
      const targetEmail = target?.email ?? "";
      const targetId = target?.userId ?? "";

      lines.push(
        csvRow([
          event.occurredAt.toISOString(),
          event.eventType,
          SECURITY_AUDIT_EVENT_LABELS[event.eventType] ?? event.eventType,
          actorName,
          actorEmail,
          actorId,
          targetName,
          targetEmail,
          targetId,
          event.guardName ?? "",
        ]),
      );
    }

    const body = CSV_BOM + lines.join("\r\n");
    const filename = `security-audit-${exportTimestamp()}.csv`;

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
    return apiError("보안 감사 로그를 내보내지 못했습니다.", 500, "SECURITY_AUDIT_EXPORT_FAILED");
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
