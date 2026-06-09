# DataTable 컴포넌트 명세

| 항목 | 내용 |
| --- | --- |
| 문서명 | DataTable 컴포넌트 명세 |
| 문서 버전 | v0.2 |
| 최초 작성일 | 2026-06-08 |
| 최종 개정일 | 2026-06-09 |
| Figma base frame (소량 sample) | [`342:19294`](https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=342-19294&t=GRqPvuntD2S5NKmP-4) (`Body` — Row 1개 + Data 3 cell sample) |
| Figma full frame (대량 데이터) | [`351:13302`](https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=351-13302&t=GRqPvuntD2S5NKmP-4) (`Table` — Card header + 5 Column × 10 Row + Pagination) |
| 작성 주체 | Frontend 개발 에이전트 |
| 문서 등급 | L2 |
| 상위 문서 | `docs/design/figma-master.md` §7.3 / `docs/design/00_design_system_v3.md` §5 Table |
| 적용 범위 | 모든 `*-LIST` 화면 (25개+) — Company/WS/Project/Suite/TC/Plan/Run/Defect/User 목록 |
| 코드 경로 (예정) | `frontend/src/components/DataTable/DataTable.tsx` + `frontend/src/hooks/useTable.ts` + `frontend/src/hooks/usePagination.ts` |

> raw 문구 X — 빈 상태·에러·로딩 메시지는 i18n 키. EmptyState 합성.

---

## 1. Figma 정본

| 항목 | 값 |
| --- | --- |
| File Key | `5G8kNWGjSSPaG3OepCfU55` |
| 컴포넌트 페이지 | TBD (디자이너 확인 필요) |
| Base frame (소량 sample) | [`342:19294`](https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=342-19294&t=GRqPvuntD2S5NKmP-4) — `Body` (Row 1개 + Data 3 cell, R&D 개발팀 예시) |
| Full table (대량 데이터 sample) | [`351:13302`](https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=351-13302&t=GRqPvuntD2S5NKmP-4) — `Table` (1628×899): Card header(badge) + 5 Column × 10 Row + Pagination |
| Table header cell (instance) | `351:13310` (Column 1) — header 기준 |
| Table cell (instance) | `351:13311` (Column 1, Row 1) — Default row 기준 |
| Pagination (instance) | `351:13403` — `Pagination` (§5 참조) |
| ⋮ 행 액션 컬럼 | `351:13357` (50px 폭 Column, `more-vertical` icon) |
| Empty state frame | [`342:19094`](https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=342-19094&t=GRqPvuntD2S5NKmP-4) (`Empty state` 1628×160 — Text + Supporting text + `_Modal actions` CTA) |

> **주의** — `342:19294`·`351:13302` 모두 **usage sample frame**. Component Property 기반 master 아님. State별(Header/Hover/Selected/Disabled 등) Property는 `Table cell` master instance에 있을 수 있음(디자이너 확인 필요). Hover/Selected/Focused/Highlighted variant frame은 §2 TBD 셀 — 디자이너 추가 요청 필요.

---

## 2. 행 State 매트릭스

> 정본: `00_design_system_v3.md` §5 Table.

| State | Figma node-id | Background | 텍스트 | 비고 |
| --- | --- | --- | --- | --- |
| Header | `351:13310` (Table header cell, Column 1) | `bg-muted` | Text sm / Semibold / `neutral-700` | sticky 옵션. `351:13302` 내 5개 Column 각 row 1 위치 |
| Default row | `342:19294` (Body) / `351:13311` (Table cell, Row 1) | white | `neutral-800` | 소량=`342:19294`, 대량=`351:13311` |
| Hover row | TBD | `bg-hover` | `neutral-800` | `cursor: pointer` (클릭 가능 시) |
| Selected row | TBD | `bg-selected` | `neutral-800` | 좌측 checkbox 선택 시 |
| Focused row (키보드) | TBD | `bg-hover` + outline | `neutral-800` | `↑↓` 이동 시 |
| Disabled row | TBD | `slate-50` | `slate-400` | 비활성 엔티티 (예: 비활성 WS) |
| Highlighted row | TBD | `yellow-50` | `neutral-800` | 검색 결과 강조 (optional) |

> TBD State는 디자이너에 **`Table cell` master Component Property `State=Hover/Selected/Focused/Disabled/Highlighted`** 추가 요청. Property 단일화 시 `351:13311`이 master로 승격 → 전 State 1 node-id로 통합.

---

## 3. 컬럼 기능 매트릭스

| 기능 | 표기 | 비고 |
| --- | --- | --- |
| 정렬 가능 | 헤더 우측 ↕ 아이콘 / 적용 시 ↑ 또는 ↓ | 단일 컬럼 정렬 기본 (다중 정렬 Phase 2) |
| 필터 가능 | 헤더 우측 ▼ 아이콘 | 드롭다운 또는 다이얼로그 |
| 너비 조정 | 우측 경계 drag | optional (Phase 2) |
| 고정 (sticky) | 좌측 N개 컬럼 sticky | 체크박스·ID 컬럼 권장 |
| 숨김/표시 토글 | 우상단 ⚙ 컬럼 선택 메뉴 | optional (운영 페이지) |

---

## 4. 선택 모드

| 모드 | 트리거 | 비고 |
| --- | --- | --- |
| None (기본) | 행 클릭 = 상세 진입 (라우트 or drawer) | `S-USER-LIST` → drawer, `S-TC-LIST-PROJ` → drawer |
| Single | radio | 드물게 사용 |
| Multi | 좌측 checkbox + 헤더 전체 선택 | 일괄 액션 (다중 초대·이관 등) |

### 4.1 일괄 액션 바

다중 선택 시 테이블 상단 또는 하단에 액션 바 노출. 선택 N개 + 액션 버튼(`삭제`·`이관`·`상태 변경` 등).

---

## 5. 페이지네이션

> Figma 정본: `351:13403` (`Pagination` instance, `351:13302` 내 하단 1628×68).

| 항목 | 값 |
| --- | --- |
| 기본 페이지 크기 | 25 |
| 옵션 | 10 / 25 / 50 / 100 |
| 표시 | 좌측 `1-25 / 총 357개`, 우측 페이지 번호 + `[< 이전][다음 >]` |
| URL 동기화 | `?page=N&size=M&sort=col,asc&filter=...` |
| 첫/끝 페이지 | `[<<]` / `[>>]` 옵션 (50+ 페이지 시) |
| Figma instance | `351:13403` |

---

## 6. State 매트릭스 (테이블 전체)

| State | Figma node-id | 트리거 | 표시 |
| --- | --- | --- | --- |
| Loading (초기) | TBD | API in-flight | Skeleton 행 5~10개 |
| Loading (페이지 전환) | TBD | 페이지·정렬·필터 변경 | 기존 데이터 dim + 상단 progress bar |
| Empty (필터 결과 0건) | `342:19094` | 결과 없음 | EmptyState (필터 초기화 CTA) — i18n 키 `table.empty.filtered` |
| Empty (데이터 0건) | `342:19094` | 신규 도메인 | EmptyState + 생성 CTA — i18n 키 `table.empty.<domain>` |
| Error | TBD (Empty state frame 재활용 가능) | API 실패 | EmptyState (재시도 CTA) — i18n 키 `table.error` |
| Default (rows) | `351:13302` (대량) / `342:19294` (소량) | 정상 노출 | rows |

> Empty state frame `342:19094` 구조: `Text`(타이틀) + `Supporting text`(서브 설명) + `_Modal actions`(CTA). 필터·도메인별 카피·CTA는 i18n 키로 분기, frame 구조는 공통 재사용.

---

## 7. 키보드

- `↑↓`: 행 이동
- `Enter`: 행 선택/진입
- `Space`: checkbox 토글 (Multi 모드)
- `Tab`: 헤더 액션 → 행 → 페이지네이션 순환
- `Esc`: 일괄 선택 해제

---

## 8. 접근성

- `<table>` + `<thead>`/`<tbody>` 시맨틱
- 정렬 컬럼: `aria-sort="ascending|descending|none"`
- 선택 행: `aria-selected="true"`
- 일괄 선택 헤더 checkbox: `aria-label="모두 선택"` + indeterminate 상태 지원
- 로딩: `aria-busy="true"` (테이블 컨테이너)
- 빈/에러 상태: `role="status"` (스크린리더 알림)

---

## 9. 합성 컴포넌트

| 컴포넌트 | 역할 |
| --- | --- |
| `EmptyState` | Empty·Error state 본문 |
| `Pagination` | 페이지 컨트롤 |
| `StatusBadge` / `RoleBadge` / `PriorityBadge` | 상태 컬럼 |
| `UserAvatar` | 담당자·생성자 컬럼 |
| `Tag` | 태그 컬럼 |

---

## 10. 코드 매핑 (예정)

| 항목 | 코드 경로 |
| --- | --- |
| Base | `frontend/src/components/DataTable/DataTable.tsx` |
| 훅 (상태 + 정렬·필터·선택) | `frontend/src/hooks/useTable.ts` |
| 훅 (페이지네이션 + URL 동기화) | `frontend/src/hooks/usePagination.ts` |
| EmptyState | `frontend/src/components/EmptyState/EmptyState.tsx` |
| Pagination | `frontend/src/components/Pagination/Pagination.tsx` |

---

## 11. 변경 이력

| 버전 | 일자 | 변경 |
| --- | --- | --- |
| v0.1 | 2026-06-08 | 초안. 행 State 7종 (Header/Default/Hover/Selected/Focused/Disabled/Highlighted), 테이블 State 6종 (Loading×2/Empty×2/Error/Default), 컬럼 기능 5종, 선택 모드 3종 (None/Single/Multi), 페이지네이션 룰 락. Figma node-id 전 항목 TBD. |
| v0.2 | 2026-06-09 | Figma base frame node-id 락 — [`342:19294`](https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=342-19294) (`Body` — Row 1개 + Data 3 cell). §1·§2 Default row에 적용. **잔존 TBD**: Header/Hover/Selected/Focused/Disabled/Highlighted 6종 State별 frame — 디자이너 추가 요청 필요 (master Component Property 승격 권장). |
| v0.2.1 | 2026-06-09 | 대량 데이터 sample frame 추가 — [`351:13302`](https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=351-13302) (`Table` — Card header + 5 Column × 10 Row + Pagination). §1 Full table·Table header cell(`351:13310`)·Table cell(`351:13311`)·⋮ 행 액션 컬럼(`351:13357`)·Pagination(`351:13403`) instance node-id 매핑. §2 Header→`351:13310`, Default row 대량=`351:13311` 추가. §5 Pagination에 `351:13403` 정본 표기. **잔존 TBD**: Hover/Selected/Focused/Disabled/Highlighted 5종 — `Table cell` master Component Property 추가 요청 필요. |
| v0.2.2 | 2026-06-09 | Empty state frame 추가 — [`342:19094`](https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=342-19094) (`Empty state` 1628×160 — Text + Supporting text + `_Modal actions` CTA). §1·§6 Empty(필터 결과 0건/데이터 0건)에 매핑. Error도 동일 frame 재활용 가능(카피만 i18n 분기). §6 표에 `Figma node-id` 컬럼 추가. |
