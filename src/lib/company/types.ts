import type { Role } from "@prisma/client";

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
