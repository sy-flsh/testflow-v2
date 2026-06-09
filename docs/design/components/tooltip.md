# Tooltip 컴포넌트 명세

| 항목 | 내용 |
| --- | --- |
| 문서명 | Tooltip 컴포넌트 명세 |
| 문서 버전 | v0.1 |
| 최초 작성일 | 2026-06-08 |
| 최종 개정일 | 2026-06-08 |
| 작성 주체 | Frontend 개발 에이전트 |
| 문서 등급 | L2 |
| 상위 문서 | `docs/design/figma-master.md` §7.1 |
| 적용 범위 | 폼 필드 도움말, IconButton 라벨 보충, truncated 텍스트 전체 표시 |
| 코드 경로 (예정) | `frontend/src/components/Tooltip/Tooltip.tsx` |

> Tooltip = **비인터랙티브 정보**. 클릭 가능한 콘텐츠가 필요하면 Popover 사용.
> 텍스트 12자 미만 권장. 긴 안내는 Helper text 또는 Popover.

---

## 1. State

| State | Figma node-id | 비고 |
| --- | --- | --- |
| Closed | (DOM 미마운트) | 기본 |
| Opening | TBD | opacity 0→1, 100ms after delay |
| Open | TBD | 정상 노출 |
| Closing | TBD | opacity 1→0, 75ms |

---

## 2. 스타일

| 항목 | 값 |
| --- | --- |
| Background | `neutral-800` |
| Text | white, Text xs / Regular |
| Padding | `6px 10px` |
| Border-radius | 6px |
| Shadow | small elevation |
| Max width | 240px (자동 줄바꿈) |
| Arrow | 6px 삼각형, bg 동일 |
| z-index | `--z-popover: 60` (Popover와 공유) |

---

## 3. 위치

| 옵션 | 기본값 |
| --- | --- |
| side | `top` |
| align | `center` |
| offset | 6px (arrow 포함) |
| collision | viewport 경계 충돌 시 자동 flip |

---

## 4. 동작 규칙

| 항목 | 값 |
| --- | --- |
| Show 트리거 | hover (마우스) / focus (키보드) |
| Hide 트리거 | mouseleave / blur / ESC |
| 진입 delay | 500ms (마우스 hover 시) — flash 방지 |
| 퇴장 delay | 0ms |
| 모바일 (터치) | 표시 X (긴 콘텐츠는 다른 UI 사용) — 또는 long-press 시 표시 (옵션) |
| 다중 Tooltip | 동시 1개만 |

---

## 5. 접근성

- `role="tooltip"` + Trigger `aria-describedby="<tooltip-id>"`
- 키보드 focus 시 자동 노출 (hover 전용 금지)
- ESC로 닫기 가능
- 인터랙티브 요소 포함 금지 (Popover로 전환)

---

## 6. 사용 가이드

| 사용 ✅ | 사용 X |
| --- | --- |
| IconButton 라벨 보충 ("새로고침") | 폼 검증 에러 (→ FormField error text) |
| 폼 필드 도움말 (필요 시) | 긴 안내 (→ Helper text 또는 모달) |
| Truncated 텍스트 전체 표시 | 클릭 가능 콘텐츠 (→ Popover) |
| 비활성 버튼 사유 ("권한 없음") | 모바일 핵심 UI |

---

## 7. 코드 매핑

| 항목 | 코드 경로 |
| --- | --- |
| Tooltip | `frontend/src/components/Tooltip/Tooltip.tsx` |
| positioning lib | `@floating-ui/react` (예정) |

---

## 8. 변경 이력

| 버전 | 일자 | 변경 |
| --- | --- | --- |
| v0.1 | 2026-06-08 | 초안. State 4종 + 진입 delay 500ms 락 + 모바일 표시 X 룰 + 인터랙티브 콘텐츠 금지 (→ Popover 전환) 룰. Figma node-id 전 TBD. |
