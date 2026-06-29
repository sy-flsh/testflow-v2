export type AdminAuditParamPatch = Record<string, string | number | null>;
export type AdminAuditPresetKey = "all" | "today" | "7d" | "30d";

export type AdminAuditChip = {
  key: "eventType" | "scope" | "date" | "user" | "guard" | "sort" | "size";
  label: string;
  removePatch: AdminAuditParamPatch;
};

export type AdminAuditChipParams = {
  eventType: string;
  scope: string;
  from: string;
  to: string;
  user: string;
  guard: string;
  sort: string;
  size: number;
};

export function todayUtc(now?: Date): string;
export function daysAgoUtc(days: number, now?: Date): string;
export function activePreset(from: string, to: string, now?: Date): AdminAuditPresetKey | null;
export function exportButtonLabel(total: number | null | undefined, exporting: boolean): string;

export function toggleAdminEventTypePatch(
  currentType: string,
  clickedType: string,
): AdminAuditParamPatch | null;
export function adminPresetPatch(key: AdminAuditPresetKey, now?: Date): AdminAuditParamPatch;
export function buildAdminActiveChips(
  params: AdminAuditChipParams,
  eventLabels: Record<string, string>,
  scopeLabels: Record<string, string>,
): AdminAuditChip[];
