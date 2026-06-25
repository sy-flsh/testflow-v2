import type { Role, ScopeType } from "@prisma/client";
import type { CompanyUserRoleEntry } from "@/lib/company/types";

/**
 * c7-2: Role Matrix 편집 UI 전용 클라이언트 helper (순수 함수 — prisma/서버 의존 없음).
 */

/** Workspace 행에서 선택 가능한 Role (없음 + WO/Member/Viewer). */
export const WORKSPACE_ROLE_OPTIONS: Array<{ value: Role | "NONE"; label: string }> = [
  { value: "NONE", label: "없음" },
  { value: "WO", label: "WO" },
  { value: "MEMBER", label: "Member" },
  { value: "VIEWER", label: "Viewer" },
];

/** Project 행에서 선택 가능한 Role (없음 + PO/Member/Viewer). */
export const PROJECT_ROLE_OPTIONS: Array<{ value: Role | "NONE"; label: string }> = [
  { value: "NONE", label: "없음" },
  { value: "PO", label: "PO" },
  { value: "MEMBER", label: "Member" },
  { value: "VIEWER", label: "Viewer" },
];

/** (scopeType, scopeId) → Role 조회 키. */
export function scopeKey(scopeType: ScopeType, scopeId: string): string {
  return `${scopeType}:${scopeId}`;
}

/** 서버 roles 목록을 편집용 Map<scopeKey, Role> 으로 변환한다. */
export function rolesToMap(roles: CompanyUserRoleEntry[]): Map<string, Role> {
  return new Map(roles.map((entry) => [scopeKey(entry.scopeType, entry.scopeId), entry.role]));
}

/** 편집 Map → sync API body 의 roles 배열(없음 제외). 안정적 정렬로 dirty 비교를 쉽게 한다. */
export function mapToRoles(map: Map<string, Role>): CompanyUserRoleEntry[] {
  const entries: CompanyUserRoleEntry[] = [];

  for (const [key, role] of map) {
    const [scopeType, scopeId] = key.split(/:(.+)/) as [ScopeType, string];
    entries.push({ scopeType, scopeId, role });
  }

  return entries.sort((a, b) => {
    if (a.scopeType !== b.scopeType) {
      return a.scopeType.localeCompare(b.scopeType);
    }

    return a.scopeId.localeCompare(b.scopeId);
  });
}

/** 두 편집 Map 이 동일한지(=저장 불필요) 비교한다. */
export function rolesEqual(a: Map<string, Role>, b: Map<string, Role>): boolean {
  if (a.size !== b.size) {
    return false;
  }

  for (const [key, role] of a) {
    if (b.get(key) !== role) {
      return false;
    }
  }

  return true;
}

/**
 * c7-2 요구사항 §8: sync API 에러 code → 사용자 친화 한국어 메시지.
 * 알려진 code 는 명시 매핑하고, 그 외에는 서버 message → 일반 메시지 순으로 fallback.
 */
const SYNC_ERROR_MESSAGES: Record<string, string> = {
  USER_INVALID_ROLE_SCOPE: "허용되지 않은 권한/대상 조합입니다. (예: WO는 Workspace에만 부여)",
  USER_DUPLICATE_SCOPE: "같은 대상에 중복된 권한이 지정되었습니다.",
  USER_SCOPE_NOT_IN_COMPANY: "현재 회사에 속하지 않은 Workspace/Project 입니다.",
  USER_SELF_CO_REVOKE_FORBIDDEN:
    "본인의 CO 권한은 회수할 수 없습니다. 다른 CO가 회수해야 합니다.",
  USER_LAST_CO_FORBIDDEN: "회사의 마지막 CO 권한은 회수할 수 없습니다.",
  USER_LAST_WO_FORBIDDEN: "Workspace의 마지막 WO 권한은 회수할 수 없습니다.",
  USER_LAST_PO_FORBIDDEN: "Project의 마지막 PO 권한은 회수할 수 없습니다.",
  USER_ROLES_REQUIRED: "전송할 권한 목록이 올바르지 않습니다.",
  USER_NOT_FOUND: "대상 사용자를 찾을 수 없습니다.",
  AUTH_FORBIDDEN: "권한이 없습니다. 회원 권한 관리는 CO만 가능합니다.",
  AUTH_UNAUTHORIZED: "로그인이 필요합니다.",
};

export function syncErrorMessage(code: string | undefined, serverMessage?: string): string {
  if (code && SYNC_ERROR_MESSAGES[code]) {
    return SYNC_ERROR_MESSAGES[code];
  }

  return serverMessage ?? "권한 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.";
}

/**
 * 클라이언트용 Role 요약 토큰 (서버 roleSummaryToken 과 동일 규칙의 순수 복제본).
 * 서버 helper(src/lib/auth/roles.ts)는 prisma 를 import 하는 server-only 모듈이라
 * 클라이언트 컴포넌트에서 직접 쓸 수 없어 동일 로직을 여기 둔다.
 * - COMPANY/CO → "CO", WORKSPACE → "WO(W)"/"M(W)"/"V(W)", PROJECT → "PO(P)"/"M(P)"/"V(P)"
 */
export function summaryToken(scopeType: ScopeType, role: Role): string {
  if (scopeType === "COMPANY") {
    return role;
  }

  const suffix = scopeType === "WORKSPACE" ? "(W)" : "(P)";
  const base = role === "MEMBER" ? "M" : role === "VIEWER" ? "V" : role;

  return `${base}${suffix}`;
}

const ROLE_ORDER: Record<Role, number> = {
  MASTER: 0,
  CO: 1,
  WO: 2,
  PO: 3,
  MEMBER: 4,
  VIEWER: 5,
};

const SCOPE_ORDER: Record<ScopeType, number> = {
  COMPANY: 0,
  WORKSPACE: 1,
  PROJECT: 2,
};

/** 저장 응답 roles → 목록 행 갱신용 요약 토큰 배열 (c7-1 목록과 동일 정렬: scope→role). */
export function rolesToSummaryTokens(roles: CompanyUserRoleEntry[]): string[] {
  return [...roles]
    .sort(
      (a, b) =>
        SCOPE_ORDER[a.scopeType] - SCOPE_ORDER[b.scopeType] ||
        ROLE_ORDER[a.role] - ROLE_ORDER[b.role],
    )
    .map((entry) => summaryToken(entry.scopeType, entry.role));
}
