import { SECURITY_AUDIT_EVENT_LABELS } from "@/lib/company/security-audit-filters";

/**
 * c10-3: 전역 보안 감사 콘솔 상수/정규화 (client-safe — prisma 미import).
 * 서버 query helper, export route, 클라이언트 view, node smoke 가 공유한다.
 */

export const ADMIN_AUDIT_EVENT_TYPES = [
  "ALL",
  "COMPANY_USER_DEACTIVATED",
  "COMPANY_USER_REACTIVATED",
  "INACTIVE_COMPANY_ACCESS_DENIED",
  "USER_SOFT_DELETED",
  "USER_RESTORED",
  "MASTER_ADMIN_GRANTED",
  "MASTER_ADMIN_REVOKED",
] as const;
export type AdminAuditEventTypeFilter = (typeof ADMIN_AUDIT_EVENT_TYPES)[number];

export const ADMIN_AUDIT_SCOPES = ["ALL", "COMPANY", "GLOBAL"] as const;
export type AdminAuditScopeFilter = (typeof ADMIN_AUDIT_SCOPES)[number];

/** 7종 한글 라벨(Company 3종 + 전역 lifecycle 2종 + MasterAdmin 권한 2종). Company audit 라벨 맵(c9)은 그대로 둔다. */
export const ADMIN_AUDIT_EVENT_LABELS: Record<string, string> = {
  ...SECURITY_AUDIT_EVENT_LABELS,
  USER_SOFT_DELETED: "계정 탈퇴",
  USER_RESTORED: "계정 복구",
  MASTER_ADMIN_GRANTED: "MasterAdmin 권한 부여",
  MASTER_ADMIN_REVOKED: "MasterAdmin 권한 해제",
};

export const ADMIN_AUDIT_SCOPE_LABELS: Record<string, string> = {
  COMPANY: "Company 이벤트",
  GLOBAL: "Global 이벤트",
};

export function normalizeAdminAuditEventType(
  value: string | null | undefined,
): AdminAuditEventTypeFilter {
  return value && (ADMIN_AUDIT_EVENT_TYPES as readonly string[]).includes(value)
    ? (value as AdminAuditEventTypeFilter)
    : "ALL";
}

export function normalizeAdminAuditScope(
  value: string | null | undefined,
): AdminAuditScopeFilter {
  return value && (ADMIN_AUDIT_SCOPES as readonly string[]).includes(value)
    ? (value as AdminAuditScopeFilter)
    : "ALL";
}
