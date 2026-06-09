# Button 컴포넌트 명세

| 항목 | 내용 |
| --- | --- |
| 문서명 | Button 컴포넌트 명세 |
| 문서 버전 | v0.2 |
| 최초 작성일 | 2026-06-08 |
| 최종 개정일 | 2026-06-09 |
| Figma master | [`342:13035`](https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=342-13035&t=GRqPvuntD2S5NKmP-4) (`Buttons/Button` — Component Property 기반) |
| 작성 주체 | Frontend 개발 에이전트 |
| 문서 등급 | L2 |
| 상위 문서 | `docs/design/figma-master.md` §7.2 / `docs/design/00_design_system_v3.md` §5 Button |
| 적용 범위 | 모든 액션 버튼 (CTA·확인·취소·인라인) |
| 코드 경로 (예정) | `frontend/src/components/Button/Button.tsx`, `IconButton.tsx` |

> 정본: `00_design_system_v3.md` §5 Button. 본 문서는 Figma matrix + 페어 패턴 + i18n 정합만.

---

## 1. Variant 매트릭스

> `00_design_system_v3.md` §5 정합. **Figma master 단일 노드** [`342:13035`](https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=342-13035&t=GRqPvuntD2S5NKmP-4) (`Buttons/Button`)이 Component Property로 Variant·Size·State·Icon 전 조합을 포함한다. 셀의 `Hierarchy=<value>`는 master Property 값.

| Variant | Figma Property | 용도 | bg | text | border |
| --- | --- | --- | --- | --- | --- |
| Primary | `Hierarchy=Primary` | 메인 CTA (저장·생성·확인) | `brand-600` | white | — |
| Secondary | `Hierarchy=Secondary color` | 브랜드 보조 액션 | `brand-50` | `brand-700` | — |
| Tertiary | `Hierarchy=Secondary gray` | 외곽선 보조 액션 (취소) | white | `neutral-700` | `slate-300` |
| Ghost | `Hierarchy=Tertiary color` | 인라인·약한 액션 | transparent | `brand-700` | — |
| Link | `Hierarchy=Link color` | 텍스트 하이퍼링크 형태 | transparent | `brand-700` | underline on hover |
| Destructive | `Hierarchy=Destructive` | 삭제·위험 액션 | `red-600` | white | — |

---

## 2. State (전 Variant 공통)

> master `342:13035`의 `State` Property 값. Figma에서 frame 별 분리 X — Property 토글로 dev mode 미리보기.

| State | Figma Property | 시각 |
| --- | --- | --- |
| Default | `State=Default` | base |
| Hover | `State=Hover` | bg 한 단계 진하게 (`brand-600` → `brand-700`) |
| Pressed | (Hover 적용 + active CSS) | 두 단계 진하게 (`brand-800`) |
| Focused | `State=Focused` | bg 유지 + `outline: 2px solid var(--border-focus); outline-offset: 2px` |
| Disabled | `State=Disabled` | `brand-200` (Primary) / `slate-200` border (Tertiary) / `cursor: not-allowed` |
| Loading | (코드 전용) | spinner 노출, label 숨김 또는 dim, 클릭 잠금 |

---

## 3. Size

| Size | Height | Padding X | Font | Icon | Radius |
| --- | --- | --- | --- | --- | --- |
| sm | 32–36px | 12px | 14px | 16px | 6px |
| **md** (기본) | 36–40px | 14px | 14–16px | 16–20px | 8px |
| lg | 40–44px | 16px | 16px | 20px | 8px |
| xl | 44px | 18px | 16px | 20px | 10px |

---

## 4. 아이콘 옵션

| 옵션 | 표기 | 비고 |
| --- | --- | --- |
| Leading | 아이콘 + 라벨 | `gap: 8px` |
| Trailing | 라벨 + 아이콘 | drop-down chevron, 외부 링크 등 |
| Icon-only | 아이콘만 | **`aria-label` 필수** (IconButton 컴포넌트로 별도 export 권장) |

`lucide-react` 사용, `currentColor` 상속.

---

## 5. 페어 패턴

| 패턴 | 좌측 | 우측 | 사용처 |
| --- | --- | --- | --- |
| `btn-action-pri` | Tertiary `[취소]` | Primary `[저장·생성·확인]` | 모달 푸터, 폼 푸터 |
| `btn-action-sec` | Tertiary `[복제]` | Secondary `[편집·수정]` | 드로어 헤더, 카드 액션 |
| `btn-confirm-destructive` | Tertiary `[취소]` | Destructive `[삭제·종료]` | ConfirmDialog (Destructive variant) |

ConfirmDialog focus 기본값: 좌측 `[취소]` (안전 기본값, `components/confirm-dialog.md` §4 정합).

---

## 6. i18n 매핑

CTA 라벨은 도메인별 `confirm.<domain>.<action>.cta` (예: `confirm.workspace.deactivate.cta` = "비활성") 또는 공용 `button.<action>` (예: `button.save`, `button.cancel`).
공용 라벨 정본 — `error-code-mapping.md` §7 (confirm.common.cancel 등). raw 문구 X.

---

## 7. 접근성

- 시맨틱 `<button type="button|submit">` 사용. `<a>` 남용 금지 (라우팅은 `Link` 컴포넌트).
- Icon-only: `aria-label` 필수.
- Loading 상태: `aria-busy="true"` + `disabled`.
- Destructive: 위험 액션은 시각만으로 부족 — ConfirmDialog 합성 권장.
- Keyboard: `Enter`/`Space` 활성. `Esc`는 닫기 컨텍스트에서 cancel 트리거 (모달 닫기 등).

---

## 8. 코드 매핑

| 항목 | 코드 경로 |
| --- | --- |
| Button | `frontend/src/components/Button/Button.tsx` |
| IconButton | `frontend/src/components/Button/IconButton.tsx` |

---

## 9. 변경 이력

| 버전 | 일자 | 변경 |
| --- | --- | --- |
| v0.1 | 2026-06-08 | 초안. Variant 6종 + State 6종 + Size 4종 + 페어 패턴 3종 + i18n 매핑 락. Figma node-id 전 TBD. |
| v0.2 | 2026-06-09 | Figma master node-id 락 — [`342:13035`](https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=342-13035) (`Buttons/Button`). Component Property(Hierarchy·Size·State·Icon) 기반 단일 master로 Variant 6종·State 6종·Size 4종 전 조합 커버. §1·§2 TBD → Property 값 치환. |
