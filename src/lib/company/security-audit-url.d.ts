import type { SecurityAuditEventTypeFilter, SecurityAuditSort } from "./types";

/** c9-9: audit 화면 URL patch (audit* key → 값 또는 null). */
export type AuditParamPatch = Record<string, string | number | null>;

export type AuditChipKey = "eventType" | "date" | "user" | "guard" | "sort" | "size";

export type AuditChip = {
  key: AuditChipKey;
  label: string;
  removePatch: AuditParamPatch;
};

export type ActiveFilterParams = {
  eventType: SecurityAuditEventTypeFilter;
  from: string;
  to: string;
  user: string;
  guard: string;
  sort: SecurityAuditSort;
  size: number;
};

export type AuditPresetKey = "all" | "today" | "7d" | "30d";

export function toggleEventTypePatch(
  currentType: SecurityAuditEventTypeFilter,
  clickedType: SecurityAuditEventTypeFilter,
): AuditParamPatch | null;

export function buildActiveChips(
  params: ActiveFilterParams,
  eventLabels: Record<string, string>,
): AuditChip[];

export function exportButtonLabel(total: number | null | undefined, exporting: boolean): string;

export function todayUtc(now?: Date): string;
export function daysAgoUtc(days: number, now?: Date): string;
export function activePreset(from: string, to: string, now?: Date): AuditPresetKey | null;
export function presetPatch(key: AuditPresetKey, now?: Date): AuditParamPatch;
