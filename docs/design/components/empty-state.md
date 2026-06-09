# EmptyState 컴포넌트 명세

| 항목 | 내용 |
| --- | --- |
| 문서명 | EmptyState 컴포넌트 명세 |
| 문서 버전 | v0.1 |
| 최초 작성일 | 2026-06-08 |
| 최종 개정일 | 2026-06-08 |
| 작성 주체 | Frontend 개발 에이전트 |
| 문서 등급 | L2 |
| 상위 문서 | `docs/design/figma-master.md` §7.3 / `docs/design/components/data-table.md` §6 |
| 적용 범위 | 목록 0건, 필터 결과 0건, 검색 결과 0건, API 에러 fallback |
| 코드 경로 (예정) | `frontend/src/components/EmptyState/EmptyState.tsx` |

---

## 1. Variant

| Variant | Figma node-id | 사용 |
| --- | --- | --- |
| no-data | TBD | 신규 도메인, 데이터 0건 — 생성 CTA 권장 |
| no-results | TBD | 필터/검색 결과 0건 — 필터 초기화 CTA |
| no-permission | TBD | 권한 부족 — 권한 요청 안내 |
| error | TBD | API 실패 — 재시도 CTA |
| placeholder | TBD | 일시 noticeable — Phase 2 기능 안내 |

---

## 2. 레이아웃

| 영역 | 콘텐츠 | 비고 |
| --- | --- | --- |
| 일러스트/아이콘 | 64–96px (md) / 120–160px (lg) | 일러스트 또는 `lucide-react` 아이콘 (slate-400) |
| 헤드라인 | Text lg / Semibold / `neutral-800` | "결과가 없습니다", "프로젝트가 없습니다" 등 |
| 본문 | Text sm / Regular / `slate-600` | 1~2줄 설명 |
| Primary CTA | Button Primary | 옵션 |
| Secondary CTA | Button Tertiary 또는 Link | 옵션 |
| 중앙 정렬, padding 48px (md) / 64px (lg) |  | 컨테이너 너비 기반 자동 |

---

## 3. Size

| Size | 사용 |
| --- | --- |
| sm | 카드 내부, 사이드바, 작은 영역 |
| md (기본) | 테이블, 메인 콘텐츠 영역 |
| lg | 페이지 전체 (목록 0건 신규 도메인) |

---

## 4. i18n 패턴

```
table.empty.<domain>       // 예: table.empty.testCases = "테스트 케이스가 없습니다"
table.empty.<domain>.body  // 부연 설명
table.empty.<domain>.cta   // CTA 라벨
table.empty.filtered       // 필터 결과 0건 공용
table.empty.searched       // 검색 결과 0건 공용
table.error                // API 실패 공용
table.error.cta            // "다시 시도"
```

> 정본 — `00_design_system_v3.md` §6 또는 `error-code-mapping.md` (현재 미정의, 추가 PR 필요).

---

## 5. Variant별 콘텐츠 매트릭스 (가이드)

| Variant | 헤드라인 | 본문 | Primary CTA |
| --- | --- | --- | --- |
| no-data | "{도메인}이 없습니다" | "첫 번째 {도메인}을 만들어보세요" | `+ {도메인} 만들기` (권한 있을 때만) |
| no-results | "결과가 없습니다" | "다른 조건으로 검색해보세요" | `필터 초기화` (필터 있을 때만) |
| no-permission | "권한이 없습니다" | "접근 권한이 필요합니다. 관리자에게 문의하세요." | `CO 권한 요청` (Phase 2) |
| error | "데이터를 불러올 수 없습니다" | "잠시 후 다시 시도해주세요" | `다시 시도` |
| placeholder | "준비 중입니다" | "이 기능은 Phase 2에 제공될 예정입니다" | — |

---

## 6. 접근성

- `role="status"` (no-data/no-results/placeholder) — 스크린리더 자동 알림
- `role="alert"` (error/no-permission) — 즉시 알림
- 일러스트는 `aria-hidden="true"` (정보성 없음)
- CTA는 시맨틱 `<button>` 또는 `<a>` (라우팅)

---

## 7. 코드 매핑

| 항목 | 코드 경로 |
| --- | --- |
| EmptyState | `frontend/src/components/EmptyState/EmptyState.tsx` |
| 일러스트 | `frontend/src/assets/empty-state/*.svg` (예정) |

---

## 8. 변경 이력

| 버전 | 일자 | 변경 |
| --- | --- | --- |
| v0.1 | 2026-06-08 | 초안. Variant 5종 (no-data/no-results/no-permission/error/placeholder) + 레이아웃 5영역 + Size 3종 + Variant별 콘텐츠 매트릭스 + i18n 키 패턴 락. Figma node-id 전 TBD. `table.*` i18n 키 정본 추가 필요. |
