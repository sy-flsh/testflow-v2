// @ts-check
/**
 * c10-2: MasterAdmin 탈퇴 계정 목록의 공용 필터 정규화(서버 route + 클라이언트 URL state + node smoke 공유).
 *
 * - 브라우저/Prisma 의존성 없는 순수 함수. 잘못된 값은 400 대신 안전한 기본값으로 fallback(기존 list 패턴).
 * - URL query prefix: adminDeletedQ / adminDeletedPage / adminDeletedSize / adminDeletedSort.
 * - 타입은 동명의 admin-deleted-filters.d.ts 에서 선언(tsconfig 는 .mjs 미타입체크, .d.ts 사용).
 */

export const ADMIN_DELETED_SIZES = [10, 20, 50];
export const ADMIN_DELETED_SORTS = ["newest", "oldest"];
export const DEFAULT_ADMIN_DELETED_SORT = "newest";
export const DEFAULT_ADMIN_DELETED_SIZE = 20;

/** @param {unknown} value */
export function normalizeAdminDeletedSize(value) {
  const parsed = Number(value);
  return ADMIN_DELETED_SIZES.includes(parsed) ? parsed : DEFAULT_ADMIN_DELETED_SIZE;
}

/** @param {unknown} value */
export function normalizeAdminDeletedSort(value) {
  return typeof value === "string" && ADMIN_DELETED_SORTS.includes(value)
    ? value
    : DEFAULT_ADMIN_DELETED_SORT;
}

/** @param {unknown} value */
export function normalizeAdminDeletedPage(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

/** @param {unknown} value */
export function normalizeAdminDeletedQuery(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * 필터 변경 시 적용할 URL patch(기본값은 호출부 updateUrl 에서 query 에서 제거). page 는 항상 1 로 reset.
 * @param {{ q?: string|null, size?: number, sort?: string }} change
 * @returns {Record<string, string | number | null>}
 */
export function adminDeletedFilterPatch(change) {
  const patch = { adminDeletedPage: null };
  if ("q" in change) patch.adminDeletedQ = change.q ? String(change.q).trim() || null : null;
  if ("size" in change) patch.adminDeletedSize = change.size ?? null;
  if ("sort" in change) patch.adminDeletedSort = change.sort ?? null;
  return patch;
}
