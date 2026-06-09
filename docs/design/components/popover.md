# Popover 컴포넌트 명세 (Popover · ContextMenu)

| 항목 | 내용 |
| --- | --- |
| 문서명 | Popover 컴포넌트 명세 (Popover · ContextMenu) |
| 문서 버전 | v0.1 |
| 최초 작성일 | 2026-06-08 |
| 최종 개정일 | 2026-06-08 |
| 작성 주체 | Frontend 개발 에이전트 |
| 문서 등급 | L2 |
| 상위 문서 | `docs/design/figma-master.md` §7.1 |
| 적용 범위 | 헤더 사용자 메뉴, 더보기 `[⋯]` 액션, 인라인 액션 메뉴, Quick filter |
| 코드 경로 (예정) | `frontend/src/components/Popover/Popover.tsx`, `ContextMenu.tsx` |

> Tooltip = 비인터랙티브 정보 (`components/tooltip.md`).
> Popover = 인터랙티브 콘텐츠 (메뉴·미니폼).
> Modal/Drawer = 큰 인터랙티브 콘텐츠.

---

## 1. State

| State | Figma node-id | 비고 |
| --- | --- | --- |
| Closed | (DOM 미마운트) | 초기 |
| Opening | TBD | opacity 0→1 + translateY -4→0, 150ms |
| Open | TBD | 정상 노출 |
| Closing | TBD | opacity 1→0, 100ms |

---

## 2. 위치 (placement)

| 옵션 | 기본값 | 비고 |
| --- | --- | --- |
| side | `bottom` | `top` / `right` / `left` / `bottom` |
| align | `start` | `start` / `center` / `end` |
| offset | 4px | trigger 와 panel 거리 |
| collision | viewport 경계 충돌 시 자동 flip | floating-ui 사용 권장 |

---

## 3. Panel 스타일

| 항목 | 값 |
| --- | --- |
| 너비 | 콘텐츠 기반 (min 160px, max 320px) |
| border | `slate-200` |
| border-radius | 8px |
| shadow | medium elevation 토큰 |
| padding | 4px (메뉴) / 12px (미니폼) |
| z-index | `--z-popover: 60` |

---

## 4. ContextMenu (메뉴 아이템)

| 항목 | 값 |
| --- | --- |
| item 레이아웃 | `flex`, leading icon + label + trailing (`shortcut` / chevron) |
| 패딩 | `8px 12px` |
| radius | 6px |
| Hover | `bg-muted` |
| Selected (다중 선택용) | `bg-subtle` + 우측 ✓ |
| Disabled | `text-slate-400`, hover 무효 |
| Divider | 1px `slate-200`, 양쪽 4px gap |
| Destructive item | `red-600` 텍스트, hover `red-50` bg |
| 그룹 헤더 (선택) | 12px, semibold, `slate-500` |

### 4.1 키보드

- `↑↓`: 아이템 이동
- `Enter`: 선택
- `Esc`: 닫기
- `Tab`: 닫고 다음 폼 필드

---

## 5. 동작 규칙

| 항목 | 값 |
| --- | --- |
| 닫기 트리거 | 외부 클릭, ESC, 아이템 선택, 라우트 변경 |
| Trigger 동작 | 클릭 또는 우클릭 (ContextMenu) |
| 다중 popover | 동시 1개만 (신규 열기 시 이전 닫힘) |
| Focus 이동 | 오픈 시 첫 메뉴 아이템 focus (ContextMenu) / 첫 인터랙티브 요소 (Popover) |
| Focus 복귀 | 닫힘 시 trigger 로 복귀 |

---

## 6. 접근성

- ContextMenu: `role="menu"` + 아이템 `role="menuitem"` + Trigger `aria-haspopup="menu"` + `aria-expanded`
- Popover (일반): `role="dialog"` + `aria-modal="false"`
- Destructive item: `aria-label` 강조 + ConfirmDialog 합성 (직접 실행 금지)

---

## 7. 코드 매핑

| 항목 | 코드 경로 |
| --- | --- |
| Popover | `frontend/src/components/Popover/Popover.tsx` |
| ContextMenu | `frontend/src/components/Popover/ContextMenu.tsx` |
| positioning lib | `@floating-ui/react` (예정) |

---

## 8. 변경 이력

| 버전 | 일자 | 변경 |
| --- | --- | --- |
| v0.1 | 2026-06-08 | 초안. State 4종 + placement 옵션 + ContextMenu 아이템 규격 + 키보드 룰 + Destructive item ConfirmDialog 합성 락. Figma node-id 전 TBD. |
