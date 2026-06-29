export type AdminDeletedSort = "newest" | "oldest";
export type AdminParamPatch = Record<string, string | number | null>;

export const ADMIN_DELETED_SIZES: number[];
export const ADMIN_DELETED_SORTS: AdminDeletedSort[];
export const DEFAULT_ADMIN_DELETED_SORT: AdminDeletedSort;
export const DEFAULT_ADMIN_DELETED_SIZE: number;

export function normalizeAdminDeletedSize(value: unknown): number;
export function normalizeAdminDeletedSort(value: unknown): AdminDeletedSort;
export function normalizeAdminDeletedPage(value: unknown): number;
export function normalizeAdminDeletedQuery(value: unknown): string;
export function adminDeletedFilterPatch(change: {
  q?: string | null;
  size?: number;
  sort?: AdminDeletedSort;
}): AdminParamPatch;
