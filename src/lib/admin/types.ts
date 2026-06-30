import type { SecurityAuditEventType } from "@prisma/client";
import type { InvitationPagination, SecurityAuditUserRef } from "@/lib/company/types";

/**
 * c10-2: MasterAdmin 탈퇴 계정 목록 DTO.
 * 운영상 최소 정보만 노출한다 — passwordHash/session/token/role/company/member/state/audit metadata 미포함.
 * deletedByUserId 는 scalar ID 만(이름/이메일로 resolve 하지 않는다).
 */
export type DeletedAccountDto = {
  userId: string;
  name: string;
  email: string;
  deletedAt: string;
  deletedByUserId: string | null;
  deletionReason: string | null;
};

export type DeletedAccountListDto = {
  users: DeletedAccountDto[];
  pagination: InvitationPagination;
  filters: { q: string | null; sort: "newest" | "oldest" };
};

/** c10-6: 강제 정지 차단 사유(UX hint). 실제 차단은 force-delete route 가 tx 재검증. */
export type ForceDeleteBlockedReason = "SELF" | "LAST_MASTER_ADMIN" | "LAST_ACTIVE_CO";

/** c10-6: MasterAdmin 활성 계정 목록 DTO. role/company/state/session 상세·민감정보 미포함. */
export type ActiveAccountDto = {
  userId: string;
  name: string;
  email: string;
  createdAt: string;
  lastLoginAt: string | null;
  isMasterAdmin: boolean;
  isLastActiveCompanyOwner: boolean;
  forceDeleteAllowed: boolean;
  forceDeleteBlockedReason: ForceDeleteBlockedReason | null;
};

export type ActiveAccountListDto = {
  users: ActiveAccountDto[];
  pagination: InvitationPagination;
  filters: { q: string | null; sort: "newest" | "oldest" };
};

/** c10-3: 전역 보안 감사 이벤트 DTO. metadata/throttle/raw 등 민감정보 미포함. */
export type AdminAuditScopeValue = "COMPANY" | "GLOBAL";

export type AdminAuditEventDto = {
  id: string;
  eventType: SecurityAuditEventType;
  occurredAt: string;
  guardName: string | null;
  scope: AdminAuditScopeValue;
  actor: SecurityAuditUserRef | null;
  target: SecurityAuditUserRef | null;
  /** GLOBAL(companyId=null) event 면 null. company 상세는 id/name 만(role/state 미포함). */
  company: { companyId: string; companyName: string | null } | null;
};

/** c10-3: eventType 제외, scope/date/user/guard 적용 기준 5종 통계(0 포함). */
export type AdminAuditSummary = {
  total: number;
  byEventType: {
    COMPANY_USER_DEACTIVATED: number;
    COMPANY_USER_REACTIVATED: number;
    INACTIVE_COMPANY_ACCESS_DENIED: number;
    USER_SOFT_DELETED: number;
    USER_RESTORED: number;
  };
};

export type AdminSecurityAuditListDto = {
  events: AdminAuditEventDto[];
  pagination: InvitationPagination;
  summary: AdminAuditSummary;
  filters: {
    eventType: string;
    scope: "ALL" | AdminAuditScopeValue;
    from: string | null;
    to: string | null;
    user: string | null;
    guard: string | null;
    sort: "newest" | "oldest";
  };
};
