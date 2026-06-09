# Radio 컴포넌트 명세

| 항목 | 내용 |
| --- | --- |
| 문서명 | Radio 컴포넌트 명세 |
| 문서 버전 | v0.1 |
| 최초 작성일 | 2026-06-08 |
| 최종 개정일 | 2026-06-08 |
| 작성 주체 | Frontend 개발 에이전트 |
| 문서 등급 | L2 |
| 상위 문서 | `docs/design/figma-master.md` §7.2 / `docs/design/00_design_system_v3.md` §5 |
| 적용 범위 | TestRun step 결과 (Pass/Fail/Block/Skip), Role 매트릭스 Project Role, 기타 단일 선택 |
| 코드 경로 (예정) | `frontend/src/components/Form/Radio.tsx`, `RadioGroup.tsx` |

---

## 1. State 매트릭스

> Checkbox와 토큰 공유. 표시는 원형(dot) 차이.

| State | Figma node-id | Border | Background | Dot |
| --- | --- | --- | --- | --- |
| Unchecked | TBD | `slate-300` | white | — |
| Unchecked Hover | TBD | `brand-500` | white | — |
| Checked | TBD | `brand-600` | white | `brand-600` 내부 dot |
| Checked Hover | TBD | `brand-700` | white | `brand-700` |
| Focused | TBD | `brand-500` + ring `brand-100` 4px | — | — |
| Disabled | TBD | `slate-200` | `slate-50` | `slate-400` (Checked 시) |
| Error | TBD | `red-500` | white | — |

---

## 2. 크기

- width × height: 16px × 16px (md 기본)
- border-radius: **50%** (원형)
- 내부 dot: width 6px, 중앙 정렬

---

## 3. RadioGroup

| 항목 | 값 |
| --- | --- |
| 레이아웃 | 수평 (`flex-direction: row`) 또는 수직 (`column`) |
| gap | `var(--gap-xs)` (기본 8px) |
| name 속성 | 그룹 단일 (같은 name = 단일 선택) |
| 기본값 | 미선택 (validation.required 가능) |
| Disabled 그룹 | 전체 비활성 시 그룹 단위로 처리 |

### 3.1 TestRun step 결과 RadioGroup

| 옵션 | 표기 | 코드 |
| --- | --- | --- |
| Pass | green | `PASS` |
| Fail | red | `FAIL` |
| Block | yellow | `BLOCK` |
| Skip | neutral | `SKIP` |
| Untested | slate (기본 선택) | `UNTESTED` |

(`docs/integration/codes.md` `tms.execution_result` 정본 참조)

---

## 4. 키보드·접근성

- `↑↓` (또는 `←→`): 그룹 내 옵션 이동 (자동 선택 변경)
- `Tab`: 그룹 진입/탈출 (`tabindex` 한 번만)
- `<input type="radio" name>` 시맨틱 또는 `role="radio"` + `aria-checked`
- `role="radiogroup"` + `aria-labelledby` (그룹 라벨)

---

## 5. 검증 메시지

`validation.<field>.required` (예: `validation.role.required`). 그룹 하단 error text.

---

## 6. 코드 매핑

| 항목 | 코드 경로 |
| --- | --- |
| Radio | `frontend/src/components/Form/Radio.tsx` |
| RadioGroup | `frontend/src/components/Form/RadioGroup.tsx` |

---

## 7. 변경 이력

| 버전 | 일자 | 변경 |
| --- | --- | --- |
| v0.1 | 2026-06-08 | 초안. State 7종, TestRun step 결과 옵션 매핑 (codes.md 정본 참조), 키보드 `↑↓` 자동 선택 룰 락. Figma node-id 전 TBD. |
