# Switch 컴포넌트 명세

| 항목 | 내용 |
| --- | --- |
| 문서명 | Switch 컴포넌트 명세 |
| 문서 버전 | v0.1 |
| 최초 작성일 | 2026-06-08 |
| 최종 개정일 | 2026-06-08 |
| 작성 주체 | Frontend 개발 에이전트 |
| 문서 등급 | L2 |
| 상위 문서 | `docs/design/figma-master.md` §7.2 / `docs/design/00_design_system_v3.md` §5 |
| 적용 범위 | 활성/비활성 토글 (Workspace·Project·User active 상태, 알림 설정 등) |
| 코드 경로 (예정) | `frontend/src/components/Form/Switch.tsx` |

> 즉시 적용 토글에 사용. 폼 일부 토글(저장 버튼 필요)은 Checkbox 권장.

---

## 1. State 매트릭스

| State | Figma node-id | Track | Thumb | 비고 |
| --- | --- | --- | --- | --- |
| Off | TBD | `slate-300` | white | thumb left |
| Off Hover | TBD | `slate-400` | white | |
| On | TBD | `brand-600` | white | thumb right |
| On Hover | TBD | `brand-700` | white | |
| Focused | TBD | + ring `brand-100` 4px | — | |
| Disabled (Off) | TBD | `slate-200` | `slate-100` | `cursor: not-allowed` |
| Disabled (On) | TBD | `brand-200` | `slate-100` | |
| Loading | TBD | 현재 state 유지 | spinner overlay | API in-flight 동안 잠금 |

---

## 2. 크기

| Size | Track W × H | Thumb |
| --- | --- | --- |
| sm | 32 × 18 | 14 |
| **md** (기본) | 40 × 22 | 18 |
| lg | 48 × 26 | 22 |

- transition: `background .2s ease, transform .2s ease` (thumb 이동)

---

## 3. 즉시 적용 패턴 (낙관적 업데이트)

| 단계 | 동작 |
| --- | --- |
| 1. 클릭 | 즉시 시각 토글 + Loading state |
| 2. API 호출 | `?` POST `/users/{id}/deactivate` 등 |
| 3-a. 성공 | Loading 해제, Toast `success.common.updated` |
| 3-b. 실패 | 시각 원복 + Toast `error.*` |

비활성/탈퇴 등 **위험 토글**은 ConfirmDialog (`confirm.<domain>.deactivate`) 합성 — Switch 단독 사용 금지.

---

## 4. 키보드·접근성

- `Space` 또는 `Enter`: 토글
- `Tab`: 다음 폼 필드
- `role="switch"` + `aria-checked="true|false"` + `aria-label` 또는 인접 라벨
- 라벨은 좌측("활성/비활성") 또는 우측("알림 받기") 자유. 클릭 시 토글.
- Loading 중: `aria-busy="true"` + `disabled`

---

## 5. 코드 매핑

| 항목 | 코드 경로 |
| --- | --- |
| Switch | `frontend/src/components/Form/Switch.tsx` |
| 위험 토글 | `useDirtyConfirm` 또는 `useConfirm` 합성 |

---

## 6. 변경 이력

| 버전 | 일자 | 변경 |
| --- | --- | --- |
| v0.1 | 2026-06-08 | 초안. State 8종 (Loading 포함), 즉시 적용 패턴 + 위험 토글 ConfirmDialog 합성 룰 락. Figma node-id 전 TBD. |
