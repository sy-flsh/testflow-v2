# ConfirmDialog 컴포넌트 명세

| 항목 | 내용 |
| --- | --- |
| 문서명 | ConfirmDialog 컴포넌트 명세 |
| 문서 버전 | v0.1 |
| 최초 작성일 | 2026-06-08 |
| 최종 개정일 | 2026-06-08 |
| 작성 주체 | Frontend 개발 에이전트 |
| 문서 등급 | L2 |
| 상위 문서 | `docs/design/figma-master.md` §7.1 / `docs/design/00_design_system_v3.md` §5 Modal / `docs/standards/frontend-coding-standard.md` §6.2.2 z-index · §8 UI 표현 패턴 |
| 적용 범위 | `*-CONFIRM` 화면 (삭제·비활성·이관·Discard 등 파괴적/되돌리기 어려운 액션 확인) |
| 코드 경로 (예정) | `frontend/src/components/ConfirmDialog/ConfirmDialog.tsx` + `frontend/src/hooks/useConfirm.ts` |

> 일반 CRUD = BaseModal, 파괴적/되돌리기 어려운 액션 확인 = ConfirmDialog. 구분 락.
> raw 문구 X — `confirm.<domain>.<action>.{title,body,cta}` i18n 키만.

---

## 1. Figma 정본

| 항목 | 값 |
| --- | --- |
| File Key | `5G8kNWGjSSPaG3OepCfU55` |
| 컴포넌트 페이지 | TBD |
| Base frame (Destructive · Default) | [`415-14597`](https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=415-14597) — 빨간 위험 아이콘 + 좌`[취소]` 우`[삭제]` CTA |
| Base frame (Warning · Default) | TBD |
| Base frame (Discard · Default) | TBD |
| Base frame (Info · Default) | TBD |

---

## 2. Variant 매트릭스

| Variant | CTA Variant | 사용처 | 예 |
| --- | --- | --- | --- |
| **Destructive** | Button `Destructive` (red-600) | 삭제·탈퇴·비활성 | S-TS-DELETE-CONFIRM, S-WS-DEACTIVATE-CONFIRM, S-PROJ-MEMBER-REMOVE-CONFIRM |
| **Warning** | Button `Primary` (brand-600) | 이관·역할 강등 등 되돌리기 가능하지만 영향 큼 | S-WS-TRANSFER, S-USER-DEMOTE-CONFIRM |
| **Discard** | Button `Destructive` (red-600) | 변경 손실 확인 (모달/Drawer dirty 닫기) | `useDirtyConfirm` 호출 |
| **Info** | Button `Primary` (brand-600) | 단순 확인 (1회용 안내) | 임시 — Toast로 대체 가능 |

---

## 3. State 매트릭스

| State | Figma node-id | 트리거 | 시각 차이 | 비고 |
| --- | --- | --- | --- | --- |
| Default | `415-14597` (Destructive) | 오픈 직후 | 타이틀 + 본문 + 좌`[취소]` 우`[확인 CTA]` | 기본. Warning/Discard/Info node TBD |
| Loading (CTA 진행 중) | TBD | 확인 클릭 후 API 대기 | CTA spinner + 양 버튼 disabled, 백드롭 클릭 잠금 | API 호출 시점 |
| Error (CTA 실패) | TBD | API 422/500 | 본문 하단 inline error text (i18n 키), 양 버튼 재활성 | toast 병행 가능 |
| Success (자동 닫힘) | (트랜지션) | API 200 | dialog 닫기 + Toast 노출 | 100ms 내 닫힘 |

### 3.1 누락 State (TBD)

| State | 트리거 | 우선순위 |
| --- | --- | --- |
| 입력 확인 (강한 파괴) | "프로젝트명 입력 후 삭제" 패턴 | medium — F-PROJ/F-WS 삭제 도입 시 |
| 연쇄 영향 미리보기 | "이 작업으로 X개의 Y가 영향받음" | medium — TC Scope 변경, WS 비활성 등 |

---

## 4. 동작 규칙

- **백드롭 클릭 닫기 금지** (Modal과 차이). 명시적 `[취소]` 또는 ESC만 닫기.
- **Loading state 진입 후 ESC·취소 금지** (양 버튼 disabled 유지). API in-flight 안정성 확보.
- **focus 위치**: 오픈 시 `[취소]` 버튼에 focus (실수 Enter 방지). Destructive 액션의 안전 기본값.
- **다중 ConfirmDialog 금지**: 동시 1개만. Stacking 필요 시 설계 재검토.

---

## 5. i18n 키 패턴

```
confirm.<domain>.<action>.title   // 예: confirm.workspace.deactivate.title
confirm.<domain>.<action>.body    // 예: confirm.workspace.deactivate.body
confirm.<domain>.<action>.cta     // 예: confirm.workspace.deactivate.cta = "비활성"
confirm.<domain>.<action>.cancel  // optional — 기본값 "취소"
```

raw 문구는 `00_design_system_v3.md` §6 정본(또는 `confirm.*` 전용 정본 — 작성 예정)에서만 정의. 본 표는 키 패턴만 락.

---

## 6. z-index / 접근성

- `--z-overlay-on-modal: 250` (Modal/Drawer 위 ConfirmDialog 합성 시) > `--z-modal: 200`. 단독 ConfirmDialog는 `--z-modal` 사용.
- `role="alertdialog"` (alert 의도 명시) + `aria-modal="true"` + `aria-labelledby` + `aria-describedby`.
- focus trap 활성, Tab 순환.

---

## 7. 코드 매핑 (예정)

| 항목 | 코드 경로 |
| --- | --- |
| Base | `frontend/src/components/ConfirmDialog/ConfirmDialog.tsx` |
| 훅 (programmatic 호출) | `frontend/src/hooks/useConfirm.ts` — `const confirmed = await confirm({...})` |
| Discard 전용 훅 | `frontend/src/hooks/useDirtyConfirm.ts` |
| z-index 토큰 | `--z-modal: 200` / `--z-overlay-on-modal: 250` |

---

## 8. 변경 이력

| 버전 | 일자 | 변경 |
| --- | --- | --- |
| v0.1 | 2026-06-08 | 초안. Variant 4종 (Destructive/Warning/Discard/Info), State 4종 (Default/Loading/Error/Success), 백드롭 클릭 닫기 금지·focus 안전 기본값 락. i18n 키 패턴 `confirm.<domain>.<action>.{title,body,cta,cancel}`. Figma node-id 전 항목 TBD. |
| v0.2 | 2026-06-09 | Destructive Default Figma node `415-14597` 반영. §1 Figma 정본 (Variant별 행으로 분리, Destructive만 매핑) + §3 State Default 행. Warning/Discard/Info Default 노드는 TBD 유지. |
