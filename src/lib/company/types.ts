import type { InvitationStatus, Role, ScopeType } from "@prisma/client";

/** c7-1: CO 회원 목록 항목 DTO. */
export type CompanyUserScopedRole = {
  scopeId: string;
  role: Role;
};

export type CompanyUserDto = {
  userId: string;
  name: string;
  email: string;
  status: "ACTIVE" | "PENDING";
  /** 표시용 Role 요약 토큰 목록 (예: ["CO", "WO(W)"]). UserRole 기준. */
  roles: string[];
  companyRoles: CompanyUserScopedRole[];
  workspaceRoles: CompanyUserScopedRole[];
  projectRoles: CompanyUserScopedRole[];
};

export type CompanyUserListDto = {
  companyId: string;
  users: CompanyUserDto[];
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
  status: "ACTIVE" | "PENDING";
  company: { id: string; name: string };
  /** Company 소속 Workspace 목록 + 각 Workspace 하위 Project 목록 (Matrix 행 구성용) */
  workspaces: CompanyWorkspaceNode[];
  /** 대상 사용자의 현재 UserRole 전체 (회사 범위). Matrix 초기값. */
  roles: CompanyUserRoleEntry[];
};

/** c8-1: 초대 Role snapshot 1행 DTO. */
export type InvitationRoleDto = {
  scopeType: ScopeType;
  scopeId: string;
  role: Role;
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
