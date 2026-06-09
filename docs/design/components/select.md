# Select 컴포넌트 명세 (Select · Combobox · SearchBox)

| 항목 | 내용 |
| --- | --- |
| 문서명 | Select 컴포넌트 명세 (Select · Combobox · SearchBox) |
| 문서 버전 | v0.1 |
| 최초 작성일 | 2026-06-08 |
| 최종 개정일 | 2026-06-08 |
| 작성 주체 | Frontend 개발 에이전트 |
| 문서 등급 | L2 |
| 상위 문서 | `docs/design/figma-master.md` §7.2 / `docs/design/00_design_system_v3.md` §5 Select · §6 폼 유효성 / `docs/design/components/text-input.md` (State 공유) |
| 적용 범위 | 드롭다운 (status·role·priority), 멤버/TC 검색 (Combobox·SearchBox), 다중 선택 |
| 코드 경로 (예정) | `frontend/src/components/Form/Select.tsx` / `Combobox.tsx` / `SearchBox.tsx` |

> Input과 동일한 사이즈·State 체계 공유 (`00_design_system_v3.md` §5 Select 명시). 본 문서는 차이점만 정리.

---

## 1. Figma 정본

| 항목 | 값 |
| --- | --- |
| File Key | `5G8kNWGjSSPaG3OepCfU55` |
| 컴포넌트 페이지 | TBD |
| Base frame (Trigger Default) | TBD-SELECT-DEFAULT |
| Dropdown panel frame | TBD-SELECT-PANEL |

---

## 2. State 매트릭스 (Trigger)

> Input과 동일. `components/text-input.md` §3 참조. Figma node-id만 본 표.

| State | Figma node-id | 비고 |
| --- | --- | --- |
| Default (empty) | TBD | placeholder 노출 |
| Filled (선택됨) | TBD | 선택 값 텍스트 |
| Hover | TBD | |
| Focused | TBD | brand-500 ring |
| Open (panel 노출) | TBD | chevron ▲ |
| Disabled | TBD | |
| Error | TBD | red-500 ring |

### 2.1 Trigger 표기

- 우측: chevron ▼ (닫힘) / ▲ (열림) — `transform: rotate(180deg)`, 150ms transition
- placeholder: `slate-400`
- 선택 값: `neutral-800`

---

## 3. Dropdown panel

| 항목 | 값 |
| --- | --- |
| 위치 | 트리거 하단 4px gap |
| 너비 | 트리거와 동일 (auto-grow 옵션 없음 — 기본) |
| max-height | 320px (내부 스크롤) |
| border | `slate-200` |
| border-radius | 8px |
| z-index | `--z-popover: 60` |
| shadow | medium elevation 토큰 |

### 3.1 Option item State

| State | Background | 텍스트 | 비고 |
| --- | --- | --- | --- |
| Default | transparent | `neutral-800` | padding 8px 12px, radius 6px |
| Hover | `bg-muted` | `neutral-800` | |
| Selected | `bg-subtle` | `neutral-800` + 우측 `brand-600` ✓ | |
| Focused (키보드) | `bg-muted` + outline | `neutral-800` | `↑↓` 이동 시 |
| Disabled | transparent | `slate-400` | `cursor: not-allowed` |

---

## 4. Variant — Combobox (자유 입력 + 선택)

| 항목 | 값 |
| --- | --- |
| Trigger | TextInput 형식 (placeholder + 입력 가능) |
| Dropdown | 입력값으로 필터링된 옵션 |
| 새 값 허용 옵션 | `allowCreate` prop — 없는 값 입력 시 "추가" 옵션 노출 |
| 사용처 | 태그 입력, 자유 카테고리 선택 |

## 5. Variant — SearchBox (검색 전용)

| 항목 | 값 |
| --- | --- |
| Leading 아이콘 | 🔍 (`lucide-react: Search`) |
| Trailing 아이콘 | clear `[×]` (입력값 있을 때만) |
| Dropdown | 검색 결과 (debounced API, 200ms) |
| 사용처 | 멤버 검색 (초대 모달), TC 검색 (Plan 작성) |

## 6. Variant — Multi-select

| 항목 | 값 |
| --- | --- |
| Trigger 표기 | 선택된 N개를 chip 또는 "N개 선택됨" 라벨 |
| Option | checkbox + label 형태 |
| Apply 버튼 | optional (모달 내부 사용 시 OK 적용) |
| 사용처 | 권한 부여, 다중 사용자 초대, TC 다중 선택 (Plan) |

---

## 7. 키보드

- `↑↓`: 옵션 이동
- `Enter`: 선택
- `Esc`: 닫기
- `Tab`: 다음 폼 필드로 이동 (Combobox는 현재 입력 confirm 후 이동)
- `Space` (trigger focus 시): 열기/닫기

---

## 8. 검증 메시지 매핑 (i18n)

`00_design_system_v3.md` §6 정본. raw 문구 X.

| 조건 | i18n 키 |
| --- | --- |
| 역할 미선택 | `validation.role.required` |
| 일반 필수 미선택 | `validation.<field>.required` |

---

## 9. 접근성

- Trigger: `role="combobox"` + `aria-expanded` + `aria-controls`(panel id) + `aria-haspopup="listbox"`
- Panel: `role="listbox"`
- Option: `role="option"` + `aria-selected`
- Multi-select 옵션: `aria-selected` 다중 허용
- 검색·필터 시 `aria-activedescendant` (현재 focused option id)

---

## 10. 코드 매핑 (예정)

| 항목 | 코드 경로 |
| --- | --- |
| Select | `frontend/src/components/Form/Select.tsx` |
| Combobox | `frontend/src/components/Form/Combobox.tsx` |
| SearchBox | `frontend/src/components/Form/SearchBox.tsx` |
| Multi-select | `frontend/src/components/Form/MultiSelect.tsx` (또는 Combobox `multiple` prop) |

---

## 11. 변경 이력

| 버전 | 일자 | 변경 |
| --- | --- | --- |
| v0.1 | 2026-06-08 | 초안. Trigger State 7종 (Default/Filled/Hover/Focused/Open/Disabled/Error), Variant 3종 (Combobox/SearchBox/Multi-select), Option State 5종, 키보드 룰 락. Figma node-id 전 항목 TBD. |
