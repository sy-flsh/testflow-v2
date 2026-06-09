# Modal 컴포넌트 명세 (BaseModal)

| 항목 | 내용 |
| --- | --- |
| 문서명 | Modal 컴포넌트 명세 (BaseModal) |
| 문서 버전 | v0.1 |
| 최초 작성일 | 2026-06-08 |
| 최종 개정일 | 2026-06-08 |
| 작성 주체 | Frontend 개발 에이전트 |
| 문서 등급 | L2 (컴포넌트 단위 명세) |
| 상위 문서 | `docs/design/figma-master.md` §7.1 / `docs/design/00_design_system_v3.md` §5 Modal · §6 폼 유효성 / `docs/standards/frontend-coding-standard.md` §6.2.2 z-index · §8 UI 표현 패턴 · §12.7 i18n |
| 적용 범위 | TMS 전 화면의 일반 CRUD 모달 (`?modal=...` 쿼리 동기화 56개 +) |
| 코드 경로 (예정) | `frontend/src/components/Modal/BaseModal.tsx` + `frontend/src/hooks/useModal.ts` |

> 본 문서는 `figma-master.md` §7 머리말 락에 따라 **복잡 컴포넌트의 State 매트릭스를 분리 관리**하는 컴포넌트 명세 파일이다.
> `figma-master.md` §7.1 `BaseModal` 행은 본 문서로 링크만 유지하며 state 별 row 분할 X.
> raw 문구 하드코딩 금지. 검증 메시지는 `00_design_system_v3.md` §6 i18n 정본 키만 참조.

---

## 1. Figma 정본

| 항목 | 값 |
| --- | --- |
| File Key | `5G8kNWGjSSPaG3OepCfU55` |
| 컴포넌트 페이지 | TBD (컴포넌트 라이브러리 페이지 node-id 미정) |
| Base frame (Default) | `342:20737` |

> URL 규칙: `https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id={NODE_ID}&m=dev` — `:` → `-` 치환.

---

## 2. State 매트릭스

> Modal frame 자체의 State 변형 (백드롭·컨테이너·내부 input 의 polymorphic 상태). 개별 Input State 정본은 `00_design_system_v3.md` §5 Input States 표 참조 — 본 표는 Modal 컨텍스트에서의 **검증 결과 시각화 차이**만 기록.

| State | Figma node-id | Frame 크기 | 트리거 조건 | 시각 차이 | 비고 |
| --- | --- | --- | --- | --- | --- |
| **Default (empty)** | `342:20737` | 800×400 | 모달 최초 오픈, 모든 입력 미입력 | Input border `slate-300`, placeholder 노출 | Base frame. §7.1 링크 대상 |
| **Filled** | `342:20745` | 800×400 | 모든 입력 완료, focus 해제 (blur), 검증 통과 | Input border `slate-300`, value 텍스트 `neutral-800` | Submit 활성 조건과 정합 (CTA enabled) |
| **Focused** | `342:20753` | 800×400 | input 중 1개 active focus | 해당 input border `brand-500` + ring `brand-100` 4px | Focus ring 정본: design-system §5 Input Focused 행 |
| **Error Label** | `342:20761` | 800×**426** (높이 +26) | On Blur 검증 실패 OR Submit 시 서버 422 응답 | Input border `red-500` + ring `red-100` 4px, input 아래 error text 영역 추가 (+26px) | error text = i18n 키 참조 (§3). 한 줄 기준 +26px |

### 2.1 height delta 규칙

Error Label state는 Default 대비 **컨테이너 +26px**, **input 영역 +26px**, **content 영역 +26px** (310 vs 284). 다중 필드 동시 에러 시 누적되며, 모달 max-height 초과 시 내부 스크롤(scroll-y) 발생. max-height 토큰은 `frontend-coding-standard.md` §UI 표현 패턴 § 모달 참조.

### 2.2 누락 State (TBD)

추후 디자이너 정본에 frame 추가 시 본 표 갱신:

| State | 트리거 | 우선순위 |
| --- | --- | --- |
| Hover (CTA·취소 버튼) | Button §State 정본 (`00_design_system_v3.md` §5 Button) 재사용. Modal frame 분리 불필요 가능성 | low |
| Disabled (Submit 진행 중) | API in-flight, CTA spinner + 입력 잠금 | **high** — Submit 흐름 정합 누락 시 UX hole |
| Loading (모달 진입 시 데이터 fetch) | 상세 모달 (`S-TC-DETAIL` 등 prefill 대기) | medium |
| Success Toast 후 닫힘 | 성공 시 모달 자동 닫힘 + Toast 노출 | low (Toast §정본 별도) |
| Discard 경고 (변경 손실) | 편집 모달 닫기 시 dirty 상태 | medium — `ConfirmDialog` 합성 패턴 |

---

## 3. 검증 메시지 매핑 (i18n)

> raw 문구 금지. `00_design_system_v3.md` §6 정본 i18n 키만 사용. 본 표는 Modal 컨텍스트에서 자주 발생하는 검증만 발췌.

| 필드 유형 | i18n 키 | 표시 위치 | 비고 |
| --- | --- | --- | --- |
| 필수값 미입력 | `validation.<field>.required` | input 하단 error text | 예: `validation.name.required` |
| 형식 오류 | `validation.<field>.format` | input 하단 error text | 예: `validation.email.format` |
| 중복 (서버 검증 422) | `validation.<field>.duplicate` | input 하단 error text | 예: `validation.email.duplicate` |
| 일치/불일치 (확인 필드) | `validation.<field>.mismatch` / `success.<field>.match` | input 하단 error/success text | 예: `validation.passwordConfirm.mismatch` |

### 3.1 BE ErrorCode → i18n 매핑

`backend-coding-standard.md` §5.2 ErrorCode → 본 §3 i18n 키 매핑 정본은 [`docs/integration/error-code-mapping.md`](../../integration/error-code-mapping.md) (작성 예정).
매핑 파일 미작성 동안은 422 응답 body의 `errors[].code` → 컨벤션에 따라 자동 매핑 (`USER.NAME.REQUIRED` → `validation.name.required`).

---

## 4. 검증 타이밍

> `00_design_system_v3.md` §6 유효성 검사 타이밍 정본 정합.

| 시점 | 트리거 | 적용 |
| --- | --- | --- |
| On Blur | 포커스 이탈 | 필수값, 형식 오류 → state 전이 Default/Filled → Error Label |
| On Change | 입력 중 | 비밀번호 확인 일치, 강도 인디케이터 |
| On Submit | CTA 클릭 | 전체 필드 재검증 + 서버 422 응답 → Error Label |
| 서버 응답 후 | 422 응답 수신 | 해당 필드 Error Label + 다중 필드 시 누적 (§2.1) |

---

## 5. 키보드 / 접근성

- ESC: 모달 닫기 (dirty 시 Discard 경고 — §2.2 향후 도입)
- Tab / Shift+Tab: 모달 내부 focus trap (외부 페이지로 이동 금지)
- Enter: 단일 input 모달 OR primary CTA 위에 focus 시 Submit
- 첫 오픈 시 focus 위치: 첫 번째 input (또는 명시된 `autoFocus` 필드)
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby`(헤더 텍스트) + `aria-describedby`(설명 텍스트)
- 백드롭 클릭 닫기 허용 (dirty 시 §2.2 향후 Discard 경고)

---

## 6. 코드 매핑 (예정)

| 항목 | 코드 경로 |
| --- | --- |
| Base 컴포넌트 | `frontend/src/components/Modal/BaseModal.tsx` |
| 훅 (열기/닫기 + URL 동기화) | `frontend/src/hooks/useModal.ts` |
| Discard 경고 합성 | `frontend/src/hooks/useDirtyConfirm.ts` (예정, `?modal=...` 닫기 + dirty 시 ConfirmDialog) |
| 폼 통합 | `frontend/src/hooks/useForm.ts` (모달 내부 폼 표준) |
| z-index 토큰 | `--z-modal: 200` (frontend-coding-standard §6.2.2) |

---

## 7. 변경 이력

| 버전 | 일자 | 변경 |
| --- | --- | --- |
| v0.1 | 2026-06-08 | 초안. Figma frame 4개(`342:20737` Default / `342:20745` Filled / `342:20753` Focused / `342:20761` Error Label) State 매트릭스 등록. height delta 규칙 명시. TBD State 5종 식별 (Hover/Disabled/Loading/Success/Discard). i18n 매핑은 design-system §6 정본 참조. |
