import type { SecurityAuditEventTypeFilter, SecurityAuditSort } from "./types";

/**
 * c9-7: Company 보안 감사 로그 조회 파라미터의 공용 상수·정규화.
 * 서버(GET /api/company/security-audit)와 클라이언트(URL 상태)가 동일 규칙을 공유한다.
 * 잘못된 값은 400 이 아니라 안전한 기본값으로 fallback(c8-5/c9-3 패턴).
 */
export const COMPANY_SECURITY_AUDIT_SIZES = [10, 20, 50] as const;
export const COMPANY_SECURITY_AUDIT_EVENT_TYPES: SecurityAuditEventTypeFilter[] = [
  "ALL",
  "COMPANY_USER_DEACTIVATED",
  "COMPANY_USER_REACTIVATED",
  "INACTIVE_COMPANY_ACCESS_DENIED",
];
export const COMPANY_SECURITY_AUDIT_SORTS: SecurityAuditSort[] = ["newest", "oldest"];

/** 이벤트 유형 한글 라벨(서버 CSV/클라이언트 표시 공용). */
export const SECURITY_AUDIT_EVENT_LABELS: Record<string, string> = {
  COMPANY_USER_DEACTIVATED: "사용자 비활성화",
  COMPANY_USER_REACTIVATED: "사용자 활성화",
  INACTIVE_COMPANY_ACCESS_DENIED: "비활성 사용자 접근 차단",
};

/** c9-8: CSV export 안전 상한(기본 10000, 1 이상 정수 외 10000 fallback, 환경변수 override 가능). */
export function getSecurityAuditExportLimit(): number {
  const parsed = Number(process.env.SECURITY_AUDIT_EXPORT_LIMIT);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 10000;
}

export const DEFAULT_SECURITY_AUDIT_FILTERS = {
  eventType: "ALL" as SecurityAuditEventTypeFilter,
  from: "",
  to: "",
  user: "",
  guard: "",
  page: 1,
  size: 20,
  sort: "newest" as SecurityAuditSort,
};

export function normalizeSecurityAuditEventType(
  value: string | null | undefined,
): SecurityAuditEventTypeFilter {
  return value && (COMPANY_SECURITY_AUDIT_EVENT_TYPES as string[]).includes(value)
    ? (value as SecurityAuditEventTypeFilter)
    : "ALL";
}

export function normalizeSecurityAuditSort(value: string | null | undefined): SecurityAuditSort {
  return value && (COMPANY_SECURITY_AUDIT_SORTS as string[]).includes(value)
    ? (value as SecurityAuditSort)
    : "newest";
}

export function normalizeSecurityAuditSize(value: string | null | undefined): number {
  const parsed = Number(value);
  return (COMPANY_SECURITY_AUDIT_SIZES as readonly number[]).includes(parsed) ? parsed : 20;
}

export function normalizeSecurityAuditPage(value: string | null | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

export function normalizeSecurityAuditQuery(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD 형식이고 실제 유효한 날짜면 그 문자열, 아니면 null(해당 필터 무시). */
export function normalizeSecurityAuditDate(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!DATE_RE.test(trimmed)) {
    return null;
  }
  // UTC 기준으로 실제 존재하는 날짜인지 검증(예: 2026-02-30 거르기).
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) {
    return null;
  }
  return trimmed;
}
