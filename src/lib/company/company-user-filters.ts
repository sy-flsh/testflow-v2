import type { CompanyUserSort, CompanyUserStatusFilter } from "./types";

/**
 * c9-3: Company 사용자 목록 검색/상태필터/정렬/페이지 파라미터의 공용 상수·정규화.
 * 서버(GET /api/company/users)와 클라이언트(사용자 탭 URL 상태)가 동일 규칙을 공유한다.
 * 잘못된 값은 400 이 아니라 **안전한 기본값으로 fallback**(c8-5 invitation-filters 와 동일 패턴).
 *
 * 초대 목록(invitation-filters)과 status/sort 의미가 다르므로 파일을 분리한다.
 */
export const COMPANY_USER_SIZES = [10, 20, 50] as const;
export const COMPANY_USER_STATUS_FILTERS: CompanyUserStatusFilter[] = [
  "ALL",
  "ACTIVE",
  "INACTIVE",
];
export const COMPANY_USER_SORTS: CompanyUserSort[] = ["nameAsc", "nameDesc", "newest"];

export const DEFAULT_COMPANY_USER_FILTERS = {
  q: "",
  status: "ALL" as CompanyUserStatusFilter,
  page: 1,
  size: 20,
  sort: "nameAsc" as CompanyUserSort,
};

export function normalizeCompanyUserStatus(
  value: string | null | undefined,
): CompanyUserStatusFilter {
  return value && (COMPANY_USER_STATUS_FILTERS as string[]).includes(value)
    ? (value as CompanyUserStatusFilter)
    : "ALL";
}

export function normalizeCompanyUserSort(value: string | null | undefined): CompanyUserSort {
  return value && (COMPANY_USER_SORTS as string[]).includes(value)
    ? (value as CompanyUserSort)
    : "nameAsc";
}

export function normalizeCompanyUserSize(value: string | null | undefined): number {
  const parsed = Number(value);
  return (COMPANY_USER_SIZES as readonly number[]).includes(parsed) ? parsed : 20;
}

export function normalizeCompanyUserPage(value: string | null | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}
