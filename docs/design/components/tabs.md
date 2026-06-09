# Tabs 컴포넌트 명세

| 항목 | 내용 |
| --- | --- |
| 문서명 | Tabs 컴포넌트 명세 |
| 문서 버전 | v0.1 |
| 최초 작성일 | 2026-06-08 |
| 최종 개정일 | 2026-06-08 |
| 작성 주체 | Frontend 개발 에이전트 |
| 문서 등급 | L2 |
| 상위 문서 | `docs/design/figma-master.md` §7.3 |
| 적용 범위 | 사이드바 내부 탭 (S-USER-DETAIL ↔ S-USER-MATRIX), 페이지 내 섹션 전환 |
| 코드 경로 (예정) | `frontend/src/components/Tabs/Tabs.tsx`, `TabPanel.tsx` |

---

## 1. Variant

| Variant | Figma node-id | 표기 | 사용 |
| --- | --- | --- | --- |
| Underline (기본) | TBD | 활성 탭 하단 `brand-600` 2px 밑줄 | 사이드바·페이지 섹션 |
| Pill | TBD | 활성 탭 `bg-subtle` + radius | 필터 토글, 상태 전환 |
| Segmented | TBD | 그룹 전체 border + 활성 fill | 좁은 영역, 모드 전환 (2~3 옵션) |

---

## 2. Tab 아이템 State

| State | Background | Text | 하단 indicator (Underline) |
| --- | --- | --- | --- |
| Default | transparent | `slate-600` | none |
| Hover | `bg-hover` | `neutral-800` | none |
| Active | transparent | `brand-700` | `brand-600` 2px |
| Focused | + outline ring | `neutral-800` | (Active 유지) |
| Disabled | transparent | `slate-400` | none, `cursor: not-allowed` |

---

## 3. 레이아웃

| 항목 | 값 |
| --- | --- |
| Tab list 정렬 | 좌측 정렬 기본, 가운데/우측 옵션 |
| Tab 패딩 | `8px 16px` (md), `6px 12px` (sm) |
| Tab 간격 | `gap: 4px` (Pill) / `gap: 24px` (Underline) |
| Tab list 하단 구분선 | 1px `slate-200` (Underline variant만) |
| 스크롤 | 폭 초과 시 좌우 스크롤 + 끝 페이드 그라데이션 (optional) |
| Tab 라벨 길이 | 8자 이하 권장. 긴 라벨은 Tooltip 보충 |
| Badge / Count | 라벨 우측 작은 숫자 (예: `결함 (12)`) |

---

## 4. URL 동기화

| 패턴 | 예 |
| --- | --- |
| `?tab=<key>` | `/users?selected=u-1&tab=role` (S-USER-MATRIX 진입) |
| Deep link 복원 | 새로고침 시 활성 탭 유지 |
| 미지정 시 | 첫 번째 탭 활성 (default) |

---

## 5. 키보드

- `←→`: 탭 이동 (자동 활성 — Underline/Pill 기본)
- `Home/End`: 첫/마지막 탭
- `Tab`: tab list → panel 콘텐츠로 진입
- `Enter/Space`: (manual activation 모드 시) 명시 활성

---

## 6. 접근성

- Tab list: `role="tablist"`
- Tab 아이템: `role="tab"` + `aria-selected` + `aria-controls`(panel id) + `tabindex` (활성=0, 비활성=-1)
- Panel: `role="tabpanel"` + `aria-labelledby`(tab id) + `tabindex="0"`
- 키보드 활성화 모드는 콘텐츠 비용에 따라:
  - 자동 (focus = active): 콘텐츠가 가벼움
  - 수동 (focus → Enter = active): 콘텐츠가 무거움 (API 호출 등)

---

## 7. 코드 매핑

| 항목 | 코드 경로 |
| --- | --- |
| Tabs | `frontend/src/components/Tabs/Tabs.tsx` |
| TabPanel | `frontend/src/components/Tabs/TabPanel.tsx` |
| URL 동기화 | `frontend/src/hooks/useUrlQueryState.ts` |

---

## 8. 변경 이력

| 버전 | 일자 | 변경 |
| --- | --- | --- |
| v0.1 | 2026-06-08 | 초안. Variant 3종 + Item State 5종 + URL `?tab=` 동기화 + 키보드 자동/수동 활성 모드 락. Figma node-id 전 TBD. |
