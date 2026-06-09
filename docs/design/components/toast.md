# Toast 컴포넌트 명세

| 항목 | 내용 |
| --- | --- |
| 문서명 | Toast 컴포넌트 명세 |
| 문서 버전 | v0.1 |
| 최초 작성일 | 2026-06-08 |
| 최종 개정일 | 2026-06-08 |
| 작성 주체 | Frontend 개발 에이전트 |
| 문서 등급 | L2 |
| 상위 문서 | `docs/design/figma-master.md` §7.1 / `docs/design/00_design_system_v3.md` §5 Modal·Drawer·Toast / `docs/integration/error-code-mapping.md` §8 |
| 적용 범위 | 전역 피드백 (성공·실패·정보·경고). 모달/드로어와 별도 z-index 최상위 |
| 코드 경로 (예정) | `frontend/src/components/Toast/Toast.tsx`, `ToastContainer.tsx` + `frontend/src/hooks/useToast.ts` |

---

## 1. Variant

| Variant | Figma node-id | bg | accent | 아이콘 | 사용 |
| --- | --- | --- | --- | --- | --- |
| success | [`415-14604`](https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=415-14604) | white | `green-600` | ✓ | 저장·생성·완료 |
| error | TBD | white | `red-600` | ⓘ | API 실패, 검증 실패 (페이지 단위) |
| warning | TBD | white | `yellow-600` | ⚠ | 임박 만료, 부분 실패 |
| info | TBD | white | `brand-600` | ⓘ | 일반 알림, 복사 완료 |

좌측 accent bar 4px + 아이콘. 우측 `[×]` 닫기.

---

## 2. State

| State | Figma node-id | 비고 |
| --- | --- | --- |
| Entering | TBD | translateX 100% → 0%, 200ms ease-out |
| Visible | `415-14604` (success) | 정상 노출, auto-dismiss 타이머 진행 중 |
| Hover-paused | TBD | 마우스 hover 시 타이머 일시정지 |
| Leaving | TBD | translateX 0% → 100% + opacity 1 → 0, 150ms ease-in |

---

## 3. 동작 규칙

| 항목 | 값 |
| --- | --- |
| 위치 | 우측 상단 (16px gap from edge) |
| Stack | 신규는 아래로 쌓임, 최대 동시 노출 5개 |
| 초과 시 | 가장 오래된 toast 자동 제거 |
| auto-dismiss | success/info 3초, warning 5초, error **자동 닫힘 X** (사용자 명시 닫기 필요) |
| 닫기 | `[×]` 클릭, ESC (focus 시), 액션 버튼 클릭 |
| Hover 일시정지 | success/info/warning. 마우스 leave 시 타이머 재개 |
| 키보드 focus | 진입 시 자동 focus X (인터럽트 방지). Tab으로 진입 가능 |

---

## 4. 액션 버튼 (선택)

| 패턴 | 표기 | 사용 |
| --- | --- | --- |
| 단일 액션 | 우측 텍스트 버튼 (`brand-600`) | "되돌리기", "재시도", "보기" |
| 액션 + 닫기 | 단일 액션 + `[×]` | 위와 동일 |

액션 클릭 = toast 즉시 닫힘.

---

## 5. i18n 메시지

> 정본: `docs/integration/error-code-mapping.md` §6 (`error.*`) / §8 (`success.*`).

| 시나리오 | Variant | i18n 키 예 |
| --- | --- | --- |
| 저장 성공 | success | `success.common.saved` |
| 생성 성공 | success | `success.common.created` |
| 삭제 성공 | success | `success.common.deleted` |
| API 실패 (일반) | error | `error.common.internal` |
| 권한 부족 | error | `error.auth.forbidden` |
| 복사 완료 | info | `success.common.copied` |

raw 문구 X.

---

## 6. 접근성

- `role="status"` (success/info) 또는 `role="alert"` (error/warning) — 스크린리더 자동 알림
- `aria-live="polite"` (status) / `aria-live="assertive"` (alert)
- 닫기 버튼: `aria-label` 필수 ("알림 닫기")
- 키보드 focus: Tab으로만 진입, 자동 focus X (모드별 라우터 워크플로우 보호)

---

## 7. z-index

- `--z-toast: 300` (`frontend-coding-standard.md` §6.2.2 정본)
- Modal(200)·Drawer(150) 위 — 항상 최상위. 단, ConfirmDialog 위에서도 alert 표시 가능

---

## 8. 코드 매핑

| 항목 | 코드 경로 |
| --- | --- |
| Toast | `frontend/src/components/Toast/Toast.tsx` |
| ToastContainer (글로벌) | `frontend/src/components/Toast/ToastContainer.tsx` |
| useToast | `frontend/src/hooks/useToast.ts` — `toast.success(...)`, `toast.error(...)` |

---

## 9. 변경 이력

| 버전 | 일자 | 변경 |
| --- | --- | --- |
| v0.1 | 2026-06-08 | 초안. Variant 4종 + State 4종 + 동작 규칙 (auto-dismiss 차등, error 수동 닫기), 액션 버튼 패턴, 접근성 role 분리 락. Figma node-id 전 TBD. |
| v0.2 | 2026-06-09 | success variant Figma node-id `415-14604` 반영. §1 Variant 표 + §2 State Visible 행. error/warning/info variant 노드는 TBD 유지. |
