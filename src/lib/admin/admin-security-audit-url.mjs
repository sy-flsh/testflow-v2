// @ts-check
/**
 * c10-3: 전역 보안 감사 콘솔(/admin/security-audit)의 순수 URL/필터 helper.
 *
 * - c9-9 security-audit-url.mjs 와 동일 패턴이지만 URL prefix 가 adminAudit* 이고 scope 필터 + 5종
 *   eventType 을 지원한다. 브라우저 의존성 없는 순수 함수 → React 화면과 node smoke 공유.
 * - prefix 와 무관한 helper(exportButtonLabel/activePreset/todayUtc/daysAgoUtc)는 c9-9 것을 재사용한다.
 * - 타입은 동명의 admin-security-audit-url.d.ts 에서 선언.
 */

export {
  activePreset,
  daysAgoUtc,
  exportButtonLabel,
  todayUtc,
} from "../company/security-audit-url.mjs";

import { daysAgoUtc, todayUtc } from "../company/security-audit-url.mjs";

/**
 * summary 카드/유형 버튼 클릭 시 적용할 eventType patch(adminAudit*).
 * @param {string} currentType
 * @param {string} clickedType
 * @returns {Record<string, string | number | null> | null}
 */
export function toggleAdminEventTypePatch(currentType, clickedType) {
  if (clickedType === "ALL") {
    if (currentType === "ALL") return null;
    return { adminAuditType: null, adminAuditPage: null };
  }
  if (currentType === clickedType) {
    return { adminAuditType: null, adminAuditPage: null };
  }
  return { adminAuditType: clickedType, adminAuditPage: null };
}

/**
 * 기간 프리셋(UTC) → adminAuditFrom/adminAuditTo patch(page 1 reset). 새 query key 없음.
 * @param {"all" | "today" | "7d" | "30d"} key
 * @param {Date} [now]
 * @returns {Record<string, string | number | null>}
 */
export function adminPresetPatch(key, now = new Date()) {
  if (key === "all") {
    return { adminAuditFrom: null, adminAuditTo: null, adminAuditPage: null };
  }
  const today = todayUtc(now);
  const from = key === "today" ? today : key === "7d" ? daysAgoUtc(6, now) : daysAgoUtc(29, now);
  return { adminAuditFrom: from, adminAuditTo: today, adminAuditPage: null };
}

/**
 * 현재 적용 중인 필터 → chip 목록(기본값은 chip 미생성). 각 chip removePatch 는 자기 key + page1 만.
 * @param {{ eventType: string, scope: string, from: string, to: string, user: string, guard: string, sort: string, size: number }} params
 * @param {Record<string, string>} eventLabels
 * @param {Record<string, string>} scopeLabels
 * @returns {Array<{ key: string, label: string, removePatch: Record<string, string | number | null> }>}
 */
export function buildAdminActiveChips(params, eventLabels, scopeLabels) {
  const { eventType, scope, from, to, user, guard, sort, size } = params;
  const chips = [];

  if (eventType && eventType !== "ALL") {
    chips.push({
      key: "eventType",
      label: (eventLabels && eventLabels[eventType]) || eventType,
      removePatch: { adminAuditType: null, adminAuditPage: null },
    });
  }

  if (scope && scope !== "ALL") {
    chips.push({
      key: "scope",
      label: (scopeLabels && scopeLabels[scope]) || scope,
      removePatch: { adminAuditScope: null, adminAuditPage: null },
    });
  }

  if (from || to) {
    let label;
    if (from && to) label = `${from} ~ ${to}`;
    else if (from) label = `${from} 이후`;
    else label = `${to} 이전`;
    chips.push({
      key: "date",
      label,
      removePatch: { adminAuditFrom: null, adminAuditTo: null, adminAuditPage: null },
    });
  }

  if (user) {
    chips.push({
      key: "user",
      label: `사용자: ${user}`,
      removePatch: { adminAuditUser: null, adminAuditPage: null },
    });
  }

  if (guard) {
    chips.push({
      key: "guard",
      label: `Guard: ${guard}`,
      removePatch: { adminAuditGuard: null, adminAuditPage: null },
    });
  }

  if (sort === "oldest") {
    chips.push({
      key: "sort",
      label: "오래된순",
      removePatch: { adminAuditSort: null, adminAuditPage: null },
    });
  }

  if (size === 10 || size === 50) {
    chips.push({
      key: "size",
      label: `${size}개씩 보기`,
      removePatch: { adminAuditSize: null, adminAuditPage: null },
    });
  }

  return chips;
}
