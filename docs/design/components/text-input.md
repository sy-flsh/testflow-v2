# TextInput 컴포넌트 명세 (Input · Textarea · Password)

| 항목 | 내용 |
| --- | --- |
| 문서명 | TextInput 컴포넌트 명세 (Input · Textarea · Password) |
| 문서 버전 | v0.1 |
| 최초 작성일 | 2026-06-08 |
| 최종 개정일 | 2026-06-08 |
| 작성 주체 | Frontend 개발 에이전트 |
| 문서 등급 | L2 |
| 상위 문서 | `docs/design/figma-master.md` §7.2 / `docs/design/00_design_system_v3.md` §5 Input · §6 폼 유효성 / `docs/standards/frontend-coding-standard.md` §12.7 i18n |
| 적용 범위 | 텍스트 입력 (이름·설명·title·이메일·아이디·비밀번호·검색어 등) 모든 폼 필드 |
| 코드 경로 (예정) | `frontend/src/components/Form/TextInput.tsx` / `Textarea.tsx` / `PasswordInput.tsx` + `frontend/src/components/Form/FormField.tsx` |

> 정본 정의는 `00_design_system_v3.md` §5 Input. 본 문서는 Figma node-id 매트릭스 + 변형(Textarea/Password) 차이 + 검증 메시지 매핑만 추가.

---

## 1. Figma 정본

| 항목 | 값 |
| --- | --- |
| File Key | `5G8kNWGjSSPaG3OepCfU55` |
| 컴포넌트 페이지 | TBD |
| Base frame (Default empty) | TBD-INPUT-DEFAULT |

---

## 2. 사이즈

> `00_design_system_v3.md` §5 공통 사이즈 토큰. 본 표 동일.

| Size | Height | Padding X | Font | Radius |
| --- | --- | --- | --- | --- |
| sm | 32–36px | 12px | 14px | 6px |
| **md** (기본) | 36–40px | 14px | 14–16px | 8px |
| lg | 40–44px | 16px | 16px | 8px |
| xl | 44px | 18px | 16px | 10px |

---

## 3. State 매트릭스 (Input)

> 정본: `00_design_system_v3.md` §5 Input States. Figma node-id 매트릭스만 본 표.

| State | Figma node-id | Border | Background | Value | Placeholder | 비고 |
| --- | --- | --- | --- | --- | --- | --- |
| Default (empty) | TBD | `slate-300` | white | — | `slate-400` | |
| Filled | TBD | `slate-300` | white | `neutral-800` | — | |
| Hover | TBD | `slate-400` | white | — | `slate-400` | |
| Focused | TBD | `brand-500` + ring `brand-100` 4px | white | `neutral-800` | `slate-400` | `box-shadow: 0 0 0 4px var(--brand-100)` |
| Disabled | TBD | `slate-200` | `slate-50` | `slate-400` | `slate-400` | `cursor: not-allowed` |
| Read-only | TBD | `slate-200` | `slate-50` | `neutral-700` | — | tabindex 유지 |
| Error | TBD | `red-500` + ring `red-100` 4px | white | `neutral-800` | `slate-400` | 하단 error text |
| Success | TBD | `green-500` | white | `neutral-800` | — | 하단 success text |

### 3.1 Label / Helper / Error text

- Label: Text sm / Medium / `neutral-700`, `margin-bottom: 6px`. 필수 `*` → `red-600`, 선택 `(선택)` → `slate-500`
- Helper text: Text sm / `slate-600`, `margin-top: 6px`
- Error text: Text sm / `red-600` + ⓘ 아이콘 (Error 시 helper 숨김)
- Success text: Text sm / `green-600` + ✓ 아이콘

---

## 4. Variant — Textarea

| 항목 | 값 | 비고 |
| --- | --- | --- |
| min-height | 80px | |
| resize | `vertical` | |
| State 매트릭스 | Input과 동일 (§3) | Figma node-id 별도: TBD-TEXTAREA-* |
| 글자 수 카운터 | optional (max length 시 우측 하단) | `1234 / 5000` 형식 |

---

## 5. Variant — Password

| 항목 | 값 | 비고 |
| --- | --- | --- |
| Trailing 아이콘 | 눈(👁) 토글 (visibility on/off) | `lucide-react: Eye/EyeOff` |
| 강도 인디케이터 | 입력 후 노출 (4단계 바) | `00_design_system_v3.md` §6 비밀번호 강도 정본 |
| autocomplete | `current-password` / `new-password` 구분 | 회원가입 = new-password, 로그인 = current-password |

---

## 6. Trailing / Leading 아이콘

- `lucide-react`, `currentColor` 상속
- 기본: `slate-500`
- Error 상태: `red-500`
- Success 상태: `green-500`
- 클릭 가능 trailing 아이콘은 `aria-label` 필수 (예: "비밀번호 표시")

---

## 7. 검증 메시지 매핑 (i18n)

> 정본: `00_design_system_v3.md` §6.1 — i18n 키 `validation.<field>.<rule>` / `success.<field>.<rule>`. raw 문구 X.

| 필드 | 조건 | i18n 키 |
| --- | --- | --- |
| 성명 | 미입력 | `validation.name.required` |
| 이메일 | 미입력 | `validation.email.required` |
| 이메일 | 형식 오류 | `validation.email.format` |
| 이메일 | 중복 | `validation.email.duplicate` |
| 아이디 | 미입력 | `validation.username.required` |
| 아이디 | 형식 오류 | `validation.username.format` |
| 아이디 | 중복 | `validation.username.duplicate` |
| 비밀번호 | 형식 오류 | `validation.password.format` |
| 비밀번호 확인 | 불일치 | `validation.passwordConfirm.mismatch` |
| 비밀번호 확인 | 일치 (성공) | `success.passwordConfirm.match` |

### 7.1 검증 타이밍

> 정본: `00_design_system_v3.md` §6.2.

| 시점 | 적용 |
| --- | --- |
| On Blur | 형식 오류, 필수값 미입력 |
| On Change | 비밀번호 확인 일치, 비밀번호 강도 |
| On Submit | 전체 일괄 검사 → 첫 에러 필드로 스크롤 |

---

## 8. 접근성

- `<label for>` 또는 `aria-labelledby` 필수
- Error 시 `aria-invalid="true"` + `aria-describedby`(error text id)
- Required 시 `aria-required="true"` + label에 `*` 시각 표기
- Disabled 시 `disabled` 속성 (focus 불가) / Read-only 시 `readonly` 속성 (focus 가능)

---

## 9. 코드 매핑 (예정)

| 항목 | 코드 경로 |
| --- | --- |
| TextInput | `frontend/src/components/Form/TextInput.tsx` |
| Textarea | `frontend/src/components/Form/Textarea.tsx` |
| PasswordInput | `frontend/src/components/Form/PasswordInput.tsx` |
| FormField (라벨+helper+error 합성) | `frontend/src/components/Form/FormField.tsx` |
| useForm | `frontend/src/hooks/useForm.ts` |

---

## 10. 변경 이력

| 버전 | 일자 | 변경 |
| --- | --- | --- |
| v0.1 | 2026-06-08 | 초안. State 8종 (Default/Filled/Hover/Focused/Disabled/Read-only/Error/Success), Variant 3종 (Input/Textarea/Password). 검증 메시지 매핑 `00_design_system_v3.md` §6 정본 참조. Figma node-id 전 항목 TBD. |
