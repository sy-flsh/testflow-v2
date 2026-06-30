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

/** c10-8: MasterAdmin 관리 목록 DTO(권한 변경용). passwordHash/session/role/company 미포함. */
export type MasterAdminStatus = "ACTIVE" | "INACTIVE" | "ACCOUNT_DELETED";
export type RevokeBlockedReasonDto = "SELF" | "LAST_ACTIVE_MASTER" | "NOT_ACTIVE" | "ACCOUNT_DELETED";

export type MasterAdminDto = {
  masterAdminId: string;
  userId: string;
  name: string;
  email: string;
  status: MasterAdminStatus;
  isCurrentActor: boolean;
  createdAt: string;
  updatedAt: string;
  revokeAllowed: boolean;
  revokeBlockedReason: RevokeBlockedReasonDto | null;
};

export type MasterAdminListDto = {
  masterAdmins: MasterAdminDto[];
  pagination: InvitationPagination;
  filters: { q: string | null; status: "ACTIVE" | "INACTIVE" | "ALL"; sort: "newest" | "oldest" };
  /** userId 가 null 인 legacy unbound MasterAdmin 레코드 수(권한 미인정, email/name 미노출). */
  legacyUnboundCount: number;
};

/** c10-8: 위임 후보(검색) DTO. */
export type MasterAdminCandidateEligibility =
  | "ELIGIBLE"
  | "ALREADY_ACTIVE_MASTER"
  | "INACTIVE_MASTER_CAN_REACTIVATE"
  | "LEGACY_BINDING_REQUIRED";

export type MasterAdminCandidateDto = {
  userId: string;
  name: string;
  email: string;
  eligibility: MasterAdminCandidateEligibility;
};

/**
 * c10-9: legacy(userId=null) MasterAdmin 레코드 DTO.
 * raw email/name/passwordHash 미노출 — 불투명 식별자(masterAdminId)와 메타만.
 */
export type LegacyMasterAdminDto = {
  masterAdminId: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
};

export type LegacyMasterAdminListDto = {
  legacyRows: LegacyMasterAdminDto[];
  pagination: InvitationPagination;
};

/** c10-9: legacy bind 후보(검색) DTO — 활성·미연결 User 만. eligibility/role/state 미포함. */
export type MasterAdminBindCandidateDto = {
  userId: string;
  name: string;
  email: string;
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
    MASTER_ADMIN_GRANTED: number;
    MASTER_ADMIN_REVOKED: number;
    MASTER_ADMIN_LEGACY_BOUND: number;
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
