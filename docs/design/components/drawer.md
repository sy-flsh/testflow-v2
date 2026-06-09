# Drawer 컴포넌트 명세 (BaseDrawer)

| 항목 | 내용 |
| --- | --- |
| 문서명 | Drawer 컴포넌트 명세 (BaseDrawer) |
| 문서 버전 | v0.1 |
| 최초 작성일 | 2026-06-08 |
| 최종 개정일 | 2026-06-08 |
| 작성 주체 | Frontend 개발 에이전트 |
| 문서 등급 | L2 (컴포넌트 단위 명세) |
| 상위 문서 | `docs/design/figma-master.md` §7.1 / `docs/design/00_design_system_v3.md` §5 Modal·Drawer·Toast / `docs/standards/frontend-coding-standard.md` §6.2.2 z-index · §8 UI 표현 패턴 |
| 적용 범위 | 사이드바(Drawer) 5종 — `?drawer=user` / `?drawer=run-tc` / `?drawer=run-history` / `?drawer=notifications` / `?drawer=user-detail` |
| 코드 경로 (예정) | `frontend/src/components/Drawer/BaseDrawer.tsx` + `frontend/src/hooks/useDrawer.ts` |

> `figma-master.md` §7.1 `BaseDrawer` 행은 본 문서로 링크만 유지. raw 문구 하드코딩 금지(i18n 키만 참조).

---

## 1. Figma 정본

| 항목 | 값 |
| --- | --- |
| File Key | `5G8kNWGjSSPaG3OepCfU55` |
| 컴포넌트 페이지 | TBD |
| Base frame (Default) | TBD-DRAWER-DEFAULT |

---

## 2. State 매트릭스

> 본문 dimming **없음** (컨텍스트 유지). Modal과 구별되는 핵심 차이.

| State | Figma node-id | 트리거 | 시각 차이 | 비고 |
| --- | --- | --- | --- | --- |
| Closed | (DOM 미마운트) | 초기·닫힘 | 미노출 | URL `?drawer=...` 부재 |
| Opening | TBD | 진입 애니메이션 | translateX 100% → 0%, 200ms ease-out | focus 이동 대기 |
| Open | TBD | 정상 노출 | 우측 고정, width 480px(기본) / 720px(wide), 좌측 그림자 | focus trap 활성 |
| Editing (dirty) | TBD | 폼 변경 | 헤더 우측 unsaved 인디케이터 (도트·라벨) | 닫기 시 Discard 경고 |
| Loading | TBD | 데이터 fetch 중 | Skeleton 본문, 헤더 액션 disabled | TC 상세·Run 이력 prefill |
| Error | TBD | fetch 실패 | EmptyState 본문 (재시도 CTA) | 토스트 병행 |
| Closing | TBD | 퇴장 애니메이션 | translateX 0% → 100%, 150ms ease-in | dirty 시 Discard 확인 통과 후만 |

### 2.1 너비 변형

| Variant | width | 사용처 |
| --- | --- | --- |
| **기본 (md)** | 480px | 회원관리 상세, 알림, Run TC 상세 |
| wide (lg) | 720px | Run 단계별 결과 + 첨부, 권한 매트릭스 |
| full | 100vw - 48px | 모바일 뷰포트 (≤768px) |

### 2.2 누락 State (TBD)

| State | 트리거 | 우선순위 |
| --- | --- | --- |
| Resize handle (사용자 drag) | 좌측 경계 hover · drag | low (Phase 2) |
| Pinned (페이지 고정) | TC 비교 모드 등 | low (Phase 2) |

---

## 3. 동작 규칙

- **본문 dimming X** — Modal과 핵심 차이. 백그라운드 페이지 클릭 가능, drawer 자동 닫힘 X (명시 닫기 액션만).
- **닫기 트리거**: ESC, 헤더 닫기 버튼 `[×]`, 다른 drawer 오픈, 라우트 변경.
- **dirty 닫기**: ConfirmDialog (`useDirtyConfirm`) → "변경사항을 버리시겠습니까?".
- **URL 동기화**: `?drawer=<kind>&id=<entityId>` (예: `?drawer=user-detail&id=u-123`). 새로고침/공유 시 동일 drawer 복원.
- **다중 drawer 금지**: 한 번에 1개만. 신규 drawer 오픈 시 이전 drawer는 dirty 검증 후 close.

---

## 4. z-index / 접근성

- `--z-drawer: 150` (frontend-coding-standard §6.2.2). `--z-modal: 200`보다 낮음 → drawer 위 모달 가능 (예: drawer 내부 삭제 확인 다이얼로그).
- `role="dialog"` + `aria-modal="false"` (dimming 없음) + `aria-labelledby` + focus trap (Tab/Shift+Tab drawer 내부 순환).
- ESC: 닫기 (dirty 시 Discard 경고).
- 첫 오픈 시 focus: 헤더 닫기 버튼 또는 첫 번째 인터랙티브 요소.

---

## 5. 검증 메시지 매핑 (i18n)

drawer 내부 폼 검증은 `components/modal.md` §3 i18n 매핑과 **동일 규칙**. raw 문구 X, `validation.<field>.<rule>` 키만.

---

## 6. 코드 매핑 (예정)

| 항목 | 코드 경로 |
| --- | --- |
| Base | `frontend/src/components/Drawer/BaseDrawer.tsx` |
| 훅 | `frontend/src/hooks/useDrawer.ts` (`?drawer=...` URL 동기화) |
| Discard 합성 | `frontend/src/hooks/useDirtyConfirm.ts` |
| z-index 토큰 | `--z-drawer: 150` |

---

## 7. 변경 이력

| 버전 | 일자 | 변경 |
| --- | --- | --- |
| v0.1 | 2026-06-08 | 초안. State 7종 식별 (Closed/Opening/Open/Editing/Loading/Error/Closing), 너비 변형 3종 (md/lg/full). Figma node-id 전 항목 TBD. 본문 dimming 미적용 규칙 락. |
