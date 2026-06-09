# Skeleton 컴포넌트 명세 (Skeleton · Spinner · ProgressBar)

| 항목 | 내용 |
| --- | --- |
| 문서명 | Skeleton 컴포넌트 명세 (Skeleton · Spinner · ProgressBar) |
| 문서 버전 | v0.1 |
| 최초 작성일 | 2026-06-08 |
| 최종 개정일 | 2026-06-08 |
| 작성 주체 | Frontend 개발 에이전트 |
| 문서 등급 | L2 |
| 상위 문서 | `docs/design/figma-master.md` §7.3 |
| 적용 범위 | 로딩 표시 — 사이드바·테이블·페이지·인라인 |
| 코드 경로 (예정) | `frontend/src/components/Loading/Skeleton.tsx`, `Spinner.tsx`, `ProgressBar.tsx` |

> Loading UX 락:
> - **첫 데이터 로딩** → Skeleton (컨텐츠 모양 미리 표시)
> - **인라인 작업·버튼 내부** → Spinner
> - **진행률 알 수 있는 작업** (업로드·import) → ProgressBar

---

## 1. Skeleton

### 1.1 Variant

| Variant | Figma node-id | 모양 |
| --- | --- | --- |
| text | TBD | 직사각형 (높이 16px, 너비 가변) |
| heading | TBD | 직사각형 (높이 24px) |
| circle | TBD | 원형 (Avatar 용) |
| rect | TBD | 직사각형 (이미지·카드 용) |
| row | TBD | DataTable 행 모양 (셀 N개) |

### 1.2 스타일

| 항목 | 값 |
| --- | --- |
| Background | `neutral-100` |
| Animation | shimmer (`neutral-100` → `neutral-50` → `neutral-100`) 1.5s 무한 |
| Border-radius | text/heading 4px, rect 8px, circle 50% |

```css
.skeleton {
  background: linear-gradient(90deg, var(--neutral-100) 0%, var(--neutral-50) 50%, var(--neutral-100) 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
```

### 1.3 합성 패턴

| 화면 | 패턴 |
| --- | --- |
| DataTable 로딩 | `row` × 5~10개 (전체 너비) |
| 사이드바 로딩 | `circle` (avatar) + `heading` + `text` × 3 |
| 카드 로딩 | `rect` (썸네일) + `heading` + `text` × 2 |
| 폼 로딩 (prefill 대기) | `text` × N (필드 수) |

---

## 2. Spinner

### 2.1 Size

| Size | px |
| --- | --- |
| xs | 12 |
| sm | 16 |
| md (기본) | 20 |
| lg | 32 |
| xl | 48 |

### 2.2 스타일

| 항목 | 값 |
| --- | --- |
| 색상 | `currentColor` (상위 텍스트 색 상속) |
| stroke-width | 2px (sm 이하) / 3px (md+) |
| animation | rotate 360° 0.8s linear infinite |

### 2.3 사용 위치

| 위치 | Size | 비고 |
| --- | --- | --- |
| 버튼 내부 (Loading state) | sm | label 숨김 또는 dim |
| 인라인 (텍스트 옆) | xs | "확인 중..." 등 |
| 페이지 중앙 (전체 로딩) | xl | EmptyState 또는 Skeleton 우선 권장 |
| Switch Loading state | xs | 토글 lock 동안 |

---

## 3. ProgressBar

### 3.1 Variant

| Variant | Figma node-id | 사용 |
| --- | --- | --- |
| Determinate | TBD | 0~100% 진행률 (파일 업로드, import) |
| Indeterminate | TBD | 진행률 미상 (페이지 전환, 무한 로딩) |

### 3.2 스타일

| 항목 | 값 |
| --- | --- |
| 높이 | 4px (sm) / 6px (md) / 8px (lg) |
| Track | `neutral-200` |
| Fill | `brand-600` |
| Border-radius | 999px (양 끝 둥글게) |
| Indeterminate animation | 좌→우 슬라이딩 1.5s ease-in-out infinite |

### 3.3 라벨

| 옵션 | 표기 |
| --- | --- |
| 퍼센트 | 우측 `45%` |
| 단계 텍스트 | "업로드 중... (3/10)" |
| ETA | "약 30초 남음" (선택) |

### 3.4 사용 위치

| 위치 | Variant | 비고 |
| --- | --- | --- |
| 파일 업로드 | Determinate | XHR `progress` event 기반 |
| 페이지 전환 | Indeterminate | 상단 고정 (라우터 인터셉트) |
| DataTable 페이지 전환 | Indeterminate | 테이블 상단 |
| Run 실행 진척률 | Determinate | (`completed / total * 100`) |

---

## 4. 접근성

| 컴포넌트 | role / aria |
| --- | --- |
| Skeleton | `aria-hidden="true"` (보조 콘텐츠) + 상위 영역에 `aria-busy="true"` |
| Spinner | `role="status"` + `aria-live="polite"` + `aria-label="로딩 중"` |
| ProgressBar | `role="progressbar"` + `aria-valuenow` / `aria-valuemin="0"` / `aria-valuemax="100"` + `aria-label` |

Indeterminate ProgressBar는 `aria-valuenow` 생략.

---

## 5. 코드 매핑

| 항목 | 코드 경로 |
| --- | --- |
| Skeleton | `frontend/src/components/Loading/Skeleton.tsx` |
| Spinner | `frontend/src/components/Loading/Spinner.tsx` |
| ProgressBar | `frontend/src/components/Loading/ProgressBar.tsx` |

---

## 6. 변경 이력

| 버전 | 일자 | 변경 |
| --- | --- | --- |
| v0.1 | 2026-06-08 | 초안. Skeleton 5종 + Spinner 5 size + ProgressBar 2 variant + 사용 위치 매트릭스 + 접근성 role 분리 락. Figma node-id 전 TBD. |
