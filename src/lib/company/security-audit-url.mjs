// @ts-check
/**
 * c9-9: Company 보안 감사 로그 화면의 순수 URL/필터 helper.
 *
 * - 브라우저 의존성(window/document/clipboard) 없이 동작하는 순수 함수만 둔다.
 *   덕분에 React 컴포넌트(security-audit-view.tsx)와 node smoke test 가 같은 로직을 공유한다.
 * - 새 URL query key 를 만들지 않는다. 기존 audit* key 의 patch(또는 null)만 반환한다.
 * - 타입은 동명의 security-audit-url.d.ts 에서 선언한다(tsconfig 는 .mjs 를 타입체크하지 않음).
 *
 * AuditParamPatch: Record<string, string | number | null>.
 *   null/기본값은 호출부(updateUrl)에서 query 에서 제거된다.
 */

/**
 * summary 카드/유형 버튼 클릭 시 적용할 eventType patch.
 * - ALL 클릭: 이미 ALL 이면 변경 없음(null) → 불필요한 history push 방지.
 * - 같은 type 재클릭: ALL 로 toggle off + page 1.
 * - 다른 type 클릭: 해당 type 으로 교체 + page 1.
 * @param {string} currentType
 * @param {string} clickedType
 * @returns {Record<string, string | number | null> | null}
 */
export function toggleEventTypePatch(currentType, clickedType) {
  if (clickedType === "ALL") {
    if (currentType === "ALL") return null;
    return { auditType: null, auditPage: null };
  }
  if (currentType === clickedType) {
    return { auditType: null, auditPage: null };
  }
  return { auditType: clickedType, auditPage: null };
}

/**
 * 현재 적용 중인 필터를 chip 목록으로 변환한다(기본값은 chip 미생성).
 * 각 chip 의 removePatch 는 자기 key 만 기본값으로 되돌리고 page 를 1 로 초기화한다.
 * @param {{ eventType: string, from: string, to: string, user: string, guard: string, sort: string, size: number }} params
 * @param {Record<string, string>} eventLabels - eventType 코드 → 한글 라벨
 * @returns {Array<{ key: string, label: string, removePatch: Record<string, string | number | null> }>}
 */
export function buildActiveChips(params, eventLabels) {
  const { eventType, from, to, user, guard, sort, size } = params;
  const chips = [];

  if (eventType && eventType !== "ALL") {
    chips.push({
      key: "eventType",
      label: (eventLabels && eventLabels[eventType]) || eventType,
      removePatch: { auditType: null, auditPage: null },
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
      removePatch: { auditFrom: null, auditTo: null, auditPage: null },
    });
  }

  if (user) {
    chips.push({
      key: "user",
      label: `사용자: ${user}`,
      removePatch: { auditUser: null, auditPage: null },
    });
  }

  if (guard) {
    chips.push({
      key: "guard",
      label: `Guard: ${guard}`,
      removePatch: { auditGuard: null, auditPage: null },
    });
  }

  if (sort === "oldest") {
    chips.push({
      key: "sort",
      label: "오래된순",
      removePatch: { auditSort: null, auditPage: null },
    });
  }

  if (size === 10 || size === 50) {
    chips.push({
      key: "size",
      label: `${size}개씩 보기`,
      removePatch: { auditSize: null, auditPage: null },
    });
  }

  return chips;
}

/**
 * CSV export 버튼 라벨.
 * @param {number | null | undefined} total - 현재 필터 결과 수(pagination.total)
 * @param {boolean} exporting
 * @returns {string}
 */
export function exportButtonLabel(total, exporting) {
  if (exporting) return "내보내는 중…";
  if (total === null || total === undefined) return "CSV 내보내기";
  return `CSV 내보내기 (${total}건)`;
}

// --- 기간 프리셋(UTC) helper. now 주입 가능(테스트 결정성). ---

/**
 * @param {Date} [now]
 * @returns {string} YYYY-MM-DD (UTC)
 */
export function todayUtc(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

/**
 * @param {number} days
 * @param {Date} [now]
 * @returns {string} now - days 의 UTC 날짜 YYYY-MM-DD
 */
export function daysAgoUtc(days, now = new Date()) {
  const d = new Date(now.getTime());
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * 현재 from/to 가 어떤 프리셋과 정확히 일치하는지.
 * @param {string} from
 * @param {string} to
 * @param {Date} [now]
 * @returns {"all" | "today" | "7d" | "30d" | null}
 */
export function activePreset(from, to, now = new Date()) {
  if (!from && !to) return "all";
  const today = todayUtc(now);
  if (from === today && to === today) return "today";
  if (from === daysAgoUtc(6, now) && to === today) return "7d";
  if (from === daysAgoUtc(29, now) && to === today) return "30d";
  return null;
}

/**
 * 프리셋 클릭 시 적용할 from/to patch(page 1 초기화). 새 query key 없음.
 * @param {"all" | "today" | "7d" | "30d"} key
 * @param {Date} [now]
 * @returns {Record<string, string | number | null>}
 */
export function presetPatch(key, now = new Date()) {
  if (key === "all") {
    return { auditFrom: null, auditTo: null, auditPage: null };
  }
  const today = todayUtc(now);
  const from = key === "today" ? today : key === "7d" ? daysAgoUtc(6, now) : daysAgoUtc(29, now);
  return { auditFrom: from, auditTo: today, auditPage: null };
}
