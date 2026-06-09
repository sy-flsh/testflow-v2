# Checkbox 컴포넌트 명세

| 항목 | 내용 |
| --- | --- |
| 문서명 | Checkbox 컴포넌트 명세 |
| 문서 버전 | v0.3 |
| 최초 작성일 | 2026-06-08 |
| 최종 개정일 | 2026-06-09 |
| Figma master | [`29:9561`](https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=29-9561) (`Checkbox` composite — box + label slot) · [`29:9112`](https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=29-9112) (`CheckboxBase` — 16×16 box only) |
| 작성 주체 | Frontend 개발 에이전트 |
| 문서 등급 | L2 |
| 상위 문서 | `docs/design/figma-master.md` §7.2 / `docs/design/00_design_system_v3.md` §5 Checkbox |
| 적용 범위 | Role 매트릭스, 회원 목록 다중 선택, DataTable 일괄 선택, 약관 동의 |
| 코드 경로 (예정) | `frontend/src/components/Form/Checkbox.tsx`, `CheckboxGroup.tsx` |

---

## 1. State 매트릭스

> 정본: `00_design_system_v3.md` §5 Checkbox. **Figma master** [`29:9561`](https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=29-9561) (Checkbox composite) + [`29:9112`](https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=29-9112) (CheckboxBase 박스만). Component Property(`checked`/`indeterminate`/`size`/`state`/`type`)로 전 State 조합 포커.

| State | Figma node-id | Border | Background | Check Icon |
| --- | --- | --- | --- | --- |
| Unchecked | [`415:12262`](https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=415-12262) | `neutral-300` (#D4D4D4) 1px | white (#FFFFFF) | — |
| Unchecked Hover | (state=Hover instance) | `brand-500` 1px | white | — |
| **Checked** | [`415:12604`](https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=415-12604) | `brand-600` (#7F56D9) 1px | **`brand-50` (#F9F5FF)** | **`brand-600` ✓** (보라 체크, 흰색 아님) |
| Checked Hover | (state=Hover instance) | `brand-700` 1px | `brand-100` | `brand-700` ✓ |
| Indeterminate | (indeterminate=True) | `brand-600` 1px | `brand-50` | `brand-600` — (헤더 일괄 선택 부분 상태) |
| Focused | (state=Focused) | `brand-500` 1px + ring `brand-100` 4px | — | — |
| Disabled | (state=Disabled) | `neutral-200` 1px | `neutral-50` / `neutral-100` | `neutral-500` ✓ |
| Error | (state=Error 또는 코드 전용 `is-error`) | `status-danger-500` 1px | white | — (약관 미동의 등) |

> 라벨 정합 (Figma 29:9561 외측 텍스트): `Inter Medium 14/20`, color `#404040` (= `neutral-700`), gap 8px.
> 이전 v0.2 의 `415:12604` 는 인스턴스였음 — v0.3 에서 실제 master `29:9561` / `29:9112` 로 정정.

---

## 2. 크기·스타일

- width × height: 16px × 16px (md 기본). sm 14px, lg 20px.
- border: **1px solid** (Figma 29:9112 정합. v0.2 의 1.5px 는 오기 — v0.3 정정)
- border-radius: 4px
- transition: `border-color .15s, background .15s`
- 라벨: `Inter Medium 14px / line-height 20px / color #404040 (neutral-700)`, gap 8px

---

## 3. 그룹 (CheckboxGroup)

| 항목 | 값 |
| --- | --- |
| 레이아웃 | `flex-direction: column`, gap `var(--gap-xs)` (기본 8px) |
| 헤더 일괄 선택 | DataTable 헤더 — Indeterminate state 지원 (선택 일부일 때) |
| 라벨 정렬 | `align-items: flex-start` (다행 라벨 대응) |

---

## 4. 약관 동의 패턴 (회원가입)

- 약관 링크: `brand-700` + underline
- 필수 항목 미동의 시: CTA 버튼 Disabled 유지 (메시지 없음 — `00_design_system_v3.md` §6 정합)
- 전체 동의 토글: 헤더 행 Indeterminate state 사용 가능

---

## 5. 키보드·접근성

- `Space`: 토글
- `Tab`: 다음 체크박스 또는 다음 폼 필드
- `<input type="checkbox">` 시맨틱 또는 `role="checkbox"` + `aria-checked="true|false|mixed"` (Indeterminate = `mixed`)
- 라벨 클릭으로 토글 가능 (`<label for>` 또는 wrap)
- Required 시 `aria-required="true"`, Error 시 `aria-invalid="true"`

---

## 6. 검증 메시지

`validation.<field>.required` 키 (약관 외). 표시 위치는 CheckboxGroup 하단 error text.

---

## 7. 코드 매핑

| 항목 | 코드 경로 |
| --- | --- |
| Checkbox | `frontend/src/components/Form/Checkbox.tsx` |
| CheckboxGroup | `frontend/src/components/Form/CheckboxGroup.tsx` |

---

## 8. 변경 이력

| 버전 | 일자 | 변경 |
| --- | --- | --- |
| v0.1 | 2026-06-08 | 초안. State 8종 (Indeterminate 포함), 약관 동의 패턴, DataTable 일괄 선택 헤더 Indeterminate 락. Figma node-id 전 TBD. |
| v0.2 | 2026-06-09 | Figma master node-id 락 — [`415:12604`](https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=415-12604) (`Checkbox`, 140×20 라벨 포함). Component Property(`Selected`/`Indeterminate`/`State`/`Disabled`/`Size`) 기반 단일 master로 State 8종 전 조합 커버. §1 TBD → Property 값 치환. |
| v0.3 | 2026-06-09 | **master node-id 정정**. v0.2 의 [`415:12604`](https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=415-12604) 는 인스턴스였음 (login 화면 인스턴스 `342:12934` 와 동급). 실제 master = [`29:9561`](https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=29-9561) (Checkbox composite) + [`29:9112`](https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=29-9112) (CheckboxBase). 정합 수정: ① border 1.5px → **1px**, ② token `slate-*` → **`neutral-*`** (실제 정의된 토큰), ③ `red-500` → `status-danger-500`, ④ 라벨 font 13/18 regular → **14/20 medium** `#404040 (neutral-700)`, ⑤ Property 명 케이스 정정 (`Selected` → `checked` 등). `checkbox.css` 동시 갱신. |
| v0.4 | 2026-06-09 | **Checked state 시각 정합**. 사용자 지정 인스턴스 ([`415:12262`](https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=415-12262) unchecked / [`415:12604`](https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=415-12604) checked) 기준 디자인 컨텍스트 추출 → checked = bg **`brand-50` (#F9F5FF)** + border `brand-600` (#7F56D9) + **`brand-600` 보라 ✓ 체크마크** (이전 v0.3 의 `brand-600` 채움 + 흰 ✓ 는 반대였음). `checkbox.css` checked / checked-hover / indeterminate / disabled-checked 모두 정합 갱신. §1 State 표 node-id + 토큰 정정. |
