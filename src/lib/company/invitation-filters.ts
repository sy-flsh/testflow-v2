import type { InvitationSort, InvitationStatusFilter } from "./types";

/**
 * c8-5: 초대 목록 검색/필터/정렬/페이지 파라미터의 공용 상수·정규화.
 * 서버(GET API)와 클라이언트(URL 상태)가 동일 규칙을 공유한다.
 * 잘못된 값은 400 이 아니라 **안전한 기본값으로 fallback**(URL 정본·북마크 내성).
 */
export const INVITATION_SIZES = [10, 20, 50] as const;
export const INVITATION_SORTS: InvitationSort[] = [
  "newest",
  "oldest",
  "expiresAtAsc",
  "expiresAtDesc",
];
export const INVITATION_STATUS_FILTERS: InvitationStatusFilter[] = [
  "ALL",
  "PENDING",
  "ACCEPTED",
  "REVOKED",
  "EXPIRED",
];

export const DEFAULT_INVITATION_FILTERS = {
  q: "",
  status: "ALL" as InvitationStatusFilter,
  page: 1,
  size: 20,
  sort: "newest" as InvitationSort,
};

export function normalizeInvitationStatus(
  value: string | null | undefined,
): InvitationStatusFilter {
  return value && (INVITATION_STATUS_FILTERS as string[]).includes(value)
    ? (value as InvitationStatusFilter)
    : "ALL";
}

export function normalizeInvitationSort(value: string | null | undefined): InvitationSort {
  return value && (INVITATION_SORTS as string[]).includes(value)
    ? (value as InvitationSort)
    : "newest";
}

export function normalizeInvitationSize(value: string | null | undefined): number {
  const parsed = Number(value);
  return (INVITATION_SIZES as readonly number[]).includes(parsed) ? parsed : 20;
}

export function normalizeInvitationPage(value: string | null | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}
