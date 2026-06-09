# DatePicker 컴포넌트 명세

| 항목 | 내용 |
| --- | --- |
| 문서명 | DatePicker 컴포넌트 명세 |
| 문서 버전 | v0.1 |
| 최초 작성일 | 2026-06-08 |
| 최종 개정일 | 2026-06-08 |
| 작성 주체 | Frontend 개발 에이전트 |
| 문서 등급 | L2 |
| 상위 문서 | `docs/design/figma-master.md` §7.2 / `docs/design/00_design_system_v3.md` §5 |
| 적용 범위 | Plan 사이클 일정 (시작·종료), 기타 날짜 입력 |
| 코드 경로 (예정) | `frontend/src/components/Form/DatePicker.tsx`, `DateRangePicker.tsx` |

> Input과 동일한 사이즈·State 체계 공유 (`components/text-input.md` §2~§3). Calendar panel만 추가 정의.

---

## 1. Trigger State

`components/text-input.md` §3 Input State 재사용. Trailing 아이콘 = 📅 (`lucide-react: Calendar`).

| State | Figma node-id | 비고 |
| --- | --- | --- |
| Default (empty) | TBD | placeholder = `YYYY-MM-DD` |
| Filled (선택됨) | TBD | 값 `2026-06-08` 형식 |
| Focused | TBD | Calendar panel 자동 노출 |
| Open (panel 노출) | TBD | trigger active |
| Disabled | TBD | |
| Error | TBD | 유효하지 않은 날짜 |

---

## 2. Calendar panel

| 항목 | 값 |
| --- | --- |
| 위치 | trigger 하단 4px gap |
| 너비 | 280px (기본) |
| z-index | `--z-popover: 60` |
| border | `slate-200` |
| border-radius | 8px |
| shadow | medium elevation |

### 2.1 Cell State

| State | Background | 텍스트 |
| --- | --- | --- |
| Default | transparent | `neutral-800` |
| Today | `brand-50` 테두리 | `brand-700` |
| Hover | `bg-muted` | `neutral-800` |
| Selected | `brand-600` | white |
| In range (Range 모드) | `brand-50` | `neutral-800` |
| Range edge | `brand-600` | white |
| Disabled (min/max 범위 밖) | transparent | `slate-300` |
| Other month (이전·다음 달) | transparent | `slate-400` |

### 2.2 헤더

- 좌우 화살표 (`<` `>`): 월 이동
- 중앙 라벨 (`2026년 6월`): 클릭 시 월/연도 선택 패널 전환
- 우측 `[오늘]` 버튼 (선택)

---

## 3. Variant — DateRangePicker

- Trigger 2개 (start · end) 또는 단일 trigger (`2026-06-01 ~ 2026-06-30`)
- Panel: 2개월 동시 노출 (1280px 폼 너비 기준)
- 선택 순서: start → end. start 클릭 시 end 초기화
- min span / max span 제약 옵션 (예: max 90일)

---

## 4. 키보드

- `↑↓←→`: 일 이동 (주/일 단위)
- `Enter`: 선택
- `Esc`: panel 닫기
- `PageUp/PageDown`: 월 이동
- `Shift+PageUp/PageDown`: 연도 이동
- `Home/End`: 주의 시작/끝
- `Tab`: 다음 폼 필드

---

## 5. 포맷 / locale

- 표시 포맷: `YYYY-MM-DD` (ISO 8601, locale 무관) — 정본
- 입력 포맷: `YYYY-MM-DD` 우선, locale 별 별칭 허용 (`2026/06/08`)
- 첫 요일: locale 기반 (한국 = 일요일, EU = 월요일)
- 라이브러리 후보: `date-fns` (tree-shake 친화). `dayjs`도 고려

---

## 6. 검증

| 조건 | i18n 키 |
| --- | --- |
| 미입력 | `validation.<field>.required` |
| 형식 오류 | `validation.date.format` |
| 범위 밖 | `validation.date.outOfRange` |
| 종료일 < 시작일 (Range) | `validation.dateRange.endBeforeStart` |

> 위 키들은 `00_design_system_v3.md` §6 정본 미정 — 추후 추가 PR 필요.

---

## 7. 접근성

- `role="dialog"` (panel) + `aria-modal="false"`
- 각 cell `role="gridcell"` + `aria-selected`
- 선택된 날짜 `aria-current="date"` (today 마킹)
- 비활성 cell `aria-disabled="true"`

---

## 8. 코드 매핑

| 항목 | 코드 경로 |
| --- | --- |
| DatePicker | `frontend/src/components/Form/DatePicker.tsx` |
| DateRangePicker | `frontend/src/components/Form/DateRangePicker.tsx` |
| date lib | `date-fns` (예정) |

---

## 9. 변경 이력

| 버전 | 일자 | 변경 |
| --- | --- | --- |
| v0.1 | 2026-06-08 | 초안. Trigger State 6종 + Cell State 8종 + Variant 2종 (Single/Range) + 키보드 8종 + 포맷 ISO 8601 정본 + locale 룰 락. Figma node-id 전 TBD. `validation.date.*` 키 정본 추가 필요. |
