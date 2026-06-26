import type {
  InvitationStatus,
  Role,
  ScopeType,
  SecurityAuditEventType,
} from "@prisma/client";

/** c7-1: CO 회원 목록 항목 DTO. */
export type CompanyUserScopedRole = {
  scopeId: string;
  role: Role;
};

/** c9-1: Company 단위 사용자 활성 상태. */
export type CompanyUserStatusValue = "ACTIVE" | "INACTIVE";

export type CompanyUserDto = {
  userId: string;
  name: string;
  email: string;
  status: CompanyUserStatusValue;
  /** c10-1: 전역 계정 탈퇴(soft delete) 여부. true 면 CompanyUserState 와 무관하게 실제 접근 불가. */
  accountDeleted: boolean;
  /** 표시용 Role 요약 토큰 목록 (예: ["CO", "WO(W)"]). UserRole 기준. */
  roles: string[];
  companyRoles: CompanyUserScopedRole[];
  workspaceRoles: CompanyUserScopedRole[];
  projectRoles: CompanyUserScopedRole[];
};

/** c9-3: Company 사용자 목록 검색/필터/정렬/페이지네이션. */
export type CompanyUserStatusFilter = "ALL" | CompanyUserStatusValue;
export type CompanyUserSort = "nameAsc" | "nameDesc" | "newest";

export type CompanyUserListDto = {
  companyId: string;
  users: CompanyUserDto[];
  pagination: InvitationPagination;
  filters: { q: string | null; status: CompanyUserStatusFilter; sort: CompanyUserSort };
};

/** c7-2: 사용자 상세 + Role Matrix 편집에 필요한 DTO. */
export type CompanyUserRoleEntry = {
  scopeType: ScopeType;
  scopeId: string;
  role: Role;
};

export type CompanyProjectNode = {
  id: string;
  name: string;
};

export type CompanyWorkspaceNode = {
  id: string;
  name: string;
  projects: CompanyProjectNode[];
};

export type CompanyUserDetailDto = {
  userId: string;
  name: string;
  email: string;
  status: CompanyUserStatusValue;
  /** c10-1: 전역 계정 탈퇴 여부. true 면 activate/deactivate/role 변경 불가(409 USER_ACCOUNT_DELETED). */
  accountDeleted: boolean;
  company: { id: string; name: string };
  /** Company 소속 Workspace 목록 + 각 Workspace 하위 Project 목록 (Matrix 행 구성용) */
  workspaces: CompanyWorkspaceNode[];
  /** 대상 사용자의 현재 UserRole 전체 (회사 범위). Matrix 초기값. */
  roles: CompanyUserRoleEntry[];
};

/** c8-3: 초대 Role Matrix 용 Company scope 트리 DTO (읽기 전용). */
export type CompanyScopeTreeDto = {
  company: { id: string; name: string };
  workspaces: CompanyWorkspaceNode[];
};

/** c8-1: 초대 Role snapshot 1행 DTO. */
export type InvitationRoleDto = {
  scopeType: ScopeType;
  scopeId: string;
  role: Role;
};

/** c8-5: 초대 목록 필터/정렬/페이지네이션 타입. */
export type InvitationStatusFilter = InvitationStatus | "ALL";
export type InvitationSort = "newest" | "oldest" | "expiresAtAsc" | "expiresAtDesc";

export type InvitationPagination = {
  page: number;
  size: number;
  total: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

/** c8-5: GET /api/company/invitations 확장 응답 (invitations 키는 기존 호환 유지). */
export type CompanyInvitationListDto = {
  companyId: string;
  invitations: CompanyInvitationDto[];
  pagination: InvitationPagination;
  filters: { q: string | null; status: InvitationStatusFilter; sort: InvitationSort };
};

/** c9-7: Company 보안 감사 로그 조회 DTO. */
export type SecurityAuditEventTypeFilter = "ALL" | SecurityAuditEventType;
export type SecurityAuditSort = "newest" | "oldest";

/**
 * 감사 actor/target 표시용. 삭제된 사용자는 userId 만 유지하고 name/email 은 null.
 * c10-1: withdrawn=true 면 전역 탈퇴(soft-deleted) 사용자 — name/email 은 마스킹되어 null 이며
 * UI/CSV 에서 "탈퇴한 사용자"로 표시한다. withdrawn=false + name/email null 은 물리 삭제("삭제된 사용자").
 */
export type SecurityAuditUserRef = {
  userId: string;
  name: string | null;
  email: string | null;
  withdrawn: boolean;
};

export type SecurityAuditEventDto = {
  id: string;
  eventType: SecurityAuditEventType;
  occurredAt: string;
  guardName: string | null;
  actor: SecurityAuditUserRef | null;
  target: SecurityAuditUserRef | null;
  // metadata/throttle/internal 은 절대 포함하지 않는다.
};

/** c9-8: 현재 필터(eventType 제외, date/user/guard 적용) 기준 유형별 통계. */
export type SecurityAuditSummary = {
  total: number;
  byEventType: {
    COMPANY_USER_DEACTIVATED: number;
    COMPANY_USER_REACTIVATED: number;
    INACTIVE_COMPANY_ACCESS_DENIED: number;
  };
};

export type CompanySecurityAuditListDto = {
  companyId: string;
  events: SecurityAuditEventDto[];
  pagination: InvitationPagination;
  summary: SecurityAuditSummary;
  filters: {
    eventType: SecurityAuditEventTypeFilter;
    from: string | null;
    to: string | null;
    user: string | null;
    guard: string | null;
    sort: SecurityAuditSort;
  };
};

/** c8-1: 초대 목록/생성 응답 DTO (tokenHash·raw token 절대 미포함). */
export type CompanyInvitationDto = {
  id: string;
  email: string;
  status: InvitationStatus;
  invitedBy: { name: string; email: string } | null;
  createdAt: string;
  expiresAt: string;
  roles: InvitationRoleDto[];
  /** 동일 email 의 기존 User 존재 여부 (수락 처리 방식은 c8-2 결정). */
  existingUser: boolean;
};
