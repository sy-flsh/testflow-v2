# TMS 디자인 시스템 v3

> 이 파일을 AI에게 가장 먼저 전달하세요. 모든 화면은 이 규칙을 기준으로 생성됩니다.

---

## 프로덕트

- **서비스**: TMS — 한국형 온프레미스 테스트 관리 도구 (Test Management System)
- **사용자**: QA팀 (IT 중견기업 / 금융권 / AI 서비스)
- **톤**: Refined Minimalism — Linear, Notion, Vercel 스타일. 신뢰감·효율·가독성 우선
- **언어**: 한국어 우선
- **기술 스택**: Tailwind CSS · shadcn/ui · lucide-react · Recharts · TanStack Table (UI 스택은 `docs/standards/frontend-coding-standard.md` §0 정본 참조 — React + TS + Vite + React Query 가정)

---

## 1. 컬러

### Primitive 팔레트

```css
:root {
  /* Brand (Purple) */
  --brand-50:  #F9F5FF;  --brand-100: #F4EBFF;  --brand-200: #E9D7FE;
  --brand-300: #D6BBFB;  --brand-400: #B692F6;  --brand-500: #9E77ED;
  --brand-600: #7F56D9;  --brand-700: #6941C6;  --brand-800: #53389E;
  --brand-900: #42307D;  --brand-950: #2C1C5F;

  /* Neutral */
  --neutral-50: #FAFAFA;  --neutral-100: #F5F5F5;  --neutral-200: #E5E5E5;
  --neutral-300: #D4D4D4; --neutral-400: #A3A3A3;  --neutral-500: #737373;
  --neutral-600: #525252; --neutral-700: #404040;  --neutral-800: #262626;
  --neutral-900: #171717;

  /* Slate */
  --slate-50: #F8FAFC;  --slate-100: #F1F5F9;  --slate-200: #E2E8F0;
  --slate-300: #CBD5E1; --slate-400: #94A3B8;  --slate-500: #64748B;
  --slate-600: #475569; --slate-700: #334155;  --slate-800: #1E293B;
  --slate-900: #0F172A;

  /* Semantic colors */
  --red-50: #FEF2F2;   --red-200: #FECACA;  --red-400: #F87171;
  --red-500: #EF4444;  --red-600: #DC2626;  --red-700: #B91C1C;

  --orange-400: #FB923C; --orange-500: #F97316;

  --yellow-50: #FEFCE8;  --yellow-200: #FEF08A;  --yellow-400: #FACC15;
  --yellow-500: #EAB308; --yellow-600: #CA8A04;  --yellow-700: #A16207;

  --green-50: #F0FDF4;  --green-200: #BBF7D0;  --green-400: #4ADE80;
  --green-500: #22C55E; --green-600: #16A34A;  --green-700: #15803D;

  --blue-50: #EFF6FF;  --blue-200: #BFDBFE;  --blue-600: #2563EB;
  --blue-700: #1D4ED8;
}
```

### Semantic 토큰

```css
:root {
  /* ─── 배경 ─── */
  --bg-base:          #FFFFFF;               /* 최하단 캔버스 */
  --bg-subtle:        var(--neutral-50);     /* 카드·패널 배경 */
  --bg-muted:         var(--neutral-100);    /* 사이드바·테이블 헤더 */
  --bg-emphasis:      var(--neutral-200);    /* 강조 영역 */
  --bg-hover:         var(--neutral-100);    /* 행·아이템 hover */
  --bg-active:        var(--neutral-200);    /* pressed 상태 */
  --bg-selected:      var(--brand-50);       /* 선택된 항목 (브랜드 틴트) */
  --bg-selected-hover:var(--brand-100);      /* 선택된 항목 hover */
  --bg-disabled:      var(--neutral-100);    /* 비활성 면 */
  --bg-overlay:       rgba(15,23,42,0.5);    /* 모달 backdrop */

  /* ─── 테두리 ─── */
  --border-subtle:    var(--neutral-100);    /* 미세한 구분선 */
  --border-default:   var(--neutral-200);    /* 기본 외곽선 */
  --border-strong:    var(--neutral-300);    /* 강조 외곽선 */
  --border-hover:     var(--neutral-400);    /* hover 시 외곽선 */
  --border-focus:     var(--brand-500);      /* 포커스 링 */
  --border-disabled:  var(--neutral-200);    /* 비활성 외곽선 */

  /* ─── 텍스트 ─── */
  --text-primary:     var(--neutral-700);    /* 본문·제목 */
  --text-secondary:   var(--slate-600);      /* 보조 텍스트 */
  --text-tertiary:    var(--slate-400);      /* 힌트·placeholder */
  --text-disabled:    var(--slate-400);      /* 비활성 텍스트 */

  /* ─── 피드백 (Alert·Toast·Inline) ─── */
  --feedback-success-bg:     var(--green-50);   --feedback-success-text: var(--green-700);   --feedback-success-border: var(--green-200);
  --feedback-warning-bg:     var(--yellow-50);  --feedback-warning-text: var(--yellow-700);  --feedback-warning-border: var(--yellow-200);
  --feedback-danger-bg:      var(--red-50);     --feedback-danger-text:  var(--red-700);     --feedback-danger-border:  var(--red-200);
  --feedback-info-bg:        var(--blue-50);    --feedback-info-text:    var(--blue-700);    --feedback-info-border:    var(--blue-200);
  --feedback-neutral-bg:     var(--slate-50);   --feedback-neutral-text: var(--slate-700);   --feedback-neutral-border: var(--slate-200);

  /* ─── 도메인 상태 (TestFlow 전용) ─── */
  /* 테스트 결과 */
  --status-pass:      var(--green-600);
  --status-fail:      var(--red-600);
  --status-block:     var(--yellow-600);
  --status-skip:      var(--neutral-600);
  --status-pending:   var(--slate-600);

  /* 결함 심각도 */
  --severity-critical: var(--red-400);
  --severity-major:    var(--orange-400);
  --severity-minor:    var(--yellow-400);
  --severity-trivial:  var(--green-400);

  /* 결함 상태 (Defect Status) */
  --defect-open:         var(--red-600);
  --defect-inprogress:   var(--blue-600);
  --defect-resolved:     var(--green-600);
  --defect-closed:       var(--neutral-600);

  /* 초대 멤버 상태 */
  --invite-pending:   var(--yellow-500);     /* 초대 중 (수락 대기) */
  --invite-active:    var(--green-600);      /* 활성 (가입 완료) */
  --invite-withdrawn: var(--neutral-400);    /* 탈퇴 */
  --invite-expired:   var(--red-500);        /* 초대 링크 만료 */
}
```

---

## 2. 타이포그래피

```css
:root {
  --font-sans: 'Pretendard', -apple-system, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;

  --font-regular:  400;
  --font-medium:   500;
  --font-semibold: 600;
  --font-bold:     700;

  /* Display (헤드라인) — letter-spacing: -0.02em 적용 */
  --text-display-2xl: 4.5rem/5.625rem;   /* 72/90 */
  --text-display-xl:  3.75rem/4.5rem;    /* 60/72 */
  --text-display-lg:  3rem/3.75rem;      /* 48/60 */
  --text-display-md:  2.25rem/2.75rem;   /* 36/44 */
  --text-display-sm:  1.875rem/2.375rem; /* 30/38 */
  --text-display-xs:  1.5rem/2rem;       /* 24/32 */

  /* Text (본문·UI) */
  --text-xl: 1.25rem/1.875rem;   /* 20/30 */
  --text-lg: 1.125rem/1.75rem;   /* 18/28 */
  --text-md: 1rem/1.5rem;        /* 16/24 */
  --text-sm: 0.875rem/1.25rem;   /* 14/20 */
  --text-xs: 0.75rem/1.125rem;   /* 12/18 */
}
```

**용도별 매핑**

| 용도 | 사이즈 | 웨이트 |
|---|---|---|
| 페이지 타이틀 H1 | Display xs (24px) | Semibold |
| 섹션 타이틀 H2 | Text xl (20px) | Semibold |
| 카드·모달 타이틀 H3 | Text lg (18px) | Semibold |
| 서브 타이틀 H4 | Text md (16px) | Semibold |
| 본문 | Text md (16px) | Regular |
| 보조 텍스트·테이블 셀 | Text sm (14px) | Regular |
| 캡션·메타·라벨 | Text xs (12px) | Regular / Medium |
| 버튼·인풋 텍스트 | Text sm (14px) | Medium / Regular |

---

## 3. 간격 (Spacing)

```css
:root {
  --gap-xs:  8px;   /* 라벨↔인풋, 아이콘↔텍스트, 칩 사이 */
  --gap-sm: 12px;   /* 카드 내부 요소, 같은 그룹 폼 필드 */
  --gap-md: 16px;   /* 폼 그룹 사이, 카드↔카드 */
  --gap-lg: 24px;   /* 섹션 분리, 페이지 헤더↔콘텐츠 */
}
```

---

## 4. 레이아웃

### 브레이크포인트

| 구분 | 범위 | 컬럼 | 거터 | 패딩 |
|---|---|---|---|---|
| mobile | < 768px | 4 | 16px | 16px |
| tablet | 768–1023px | 8 | 20px | 24px |
| desktop | 1024px~ | 12 | 24px | 32px |

- desktop max-width 제한 없음 — 뷰포트 폭 전체 활용
- mobile: 사이드바 숨김 + 햄버거 메뉴, 테이블 카드 뷰 전환, 모달은 전체 화면(full-screen sheet) 전환

```css
/* mobile-first: 기본은 mobile, min-width로 점진 확장 */
:root { --container-padding: 16px; --grid-columns: 4; --grid-gutter: 16px; }

@media (min-width: 768px)  { :root { --container-padding: 24px; --grid-columns: 8;  --grid-gutter: 20px; } }
@media (min-width: 1024px) { :root { --container-padding: 32px; --grid-columns: 12; --grid-gutter: 24px; } }

.container { width: 100%; padding-inline: var(--container-padding); }
.grid      { display: grid; grid-template-columns: repeat(var(--grid-columns), 1fr); gap: var(--grid-gutter); }
```

**Grid span 패턴** (desktop 12col 기준)
- 3열 카드 → `span 4` / 본문+사이드 → `span 8` + `span 4` / 전체 폼 → `span 12`

### Auto Layout 정렬 규칙

| 컨텍스트 | 정렬 |
|---|---|
| 폼 컨테이너 | `flex-direction: column; align-items: flex-start` |
| 페이지 헤더 (제목 + 액션) | `justify-content: space-between` |
| 모달 푸터·버튼 그룹 | `justify-content: flex-end` (항상 우측 정렬) |
| 툴바 | 좌측 필터 + 우측 액션 `space-between` |

- **Hug**: 버튼·배지·칩 → `flex: 0 0 auto`
- **Fill**: 인풋·검색바·본문 → `flex: 1`

### 앱 셸 (App Shell)

```
┌─────────────────────────────────────────────────────────┐
│ Header  56px  fixed  [로고] [네비] ──────── [알림][프로필] │
├──────────┬──────────────────────────────────────────────┤
│ Sidebar  │  Main (margin-left: 240px; margin-top: 56px) │
│  240px   │  1. Breadcrumb                               │
│  fixed   │  2. Page header (제목 + 액션 버튼)             │
│  top:56px│  ─────────────────────────────────────────── │
│          │  3. Content                                  │
│ [메뉴들]  │                                              │
│ ───────  │                                              │
│ [설정]   │                                              │
└──────────┴──────────────────────────────────────────────┘
```

**Sidebar 메뉴**

| 메뉴 | 아이콘 | 라우트 |
|---|---|---|
| 프로젝트 | FolderKanban | `/projects` |
| 테스트 케이스 | FileText | `/projects/:id/testcases` |
| 테스트 계획 | ClipboardList | `/projects/:id/plans` |
| 테스트 실행 | Play | `/projects/:id/runs` |
| 결함 | Bug | `/projects/:id/defects` |
| 대시보드 | LayoutDashboard | `/dashboard` |
| 보고서 | BarChart3 | `/projects/:id/reports` |
| 워크스페이스 설정 (하단) | Settings | `/settings` |

- 모든 메뉴는 상시 활성화(enabled). 프로젝트는 항상 선택된 상태 전제.

### 인증 페이지 레이아웃 (Auth Layout)

로그인·회원가입·아이디 찾기 등 사이드바 없는 단독 페이지 전용.

```
배경: neutral-50
  ↓
[로고 40px] + 서비스명 (Display xs / Semibold)
서브타이틀 (Text sm / Regular / slate-600)
  ↓  gap 24px
┌─ 폼 카드 (max-width: 400px, padding: 32px, border: slate-200, radius: 12px) ─┐
│  필드들  gap: 16px                                                            │
│  [Primary CTA — width: 100%, height: 44px]                                   │
└──────────────────────────────────────────────────────────────────────────────┘
  ↓  gap 16px
"이미 계정이 있으신가요? 로그인" (Text sm, slate-600, brand-700 링크)
```

**화면별 타이틀·서브타이틀**

| 화면 | 타이틀 | 서브타이틀 |
|---|---|---|
| 로그인 | 다시 만나서 반갑습니다 | 계정에 로그인하세요. |
| 회원가입 | 계정 만들기 | 30일 무료 체험을 시작하세요. |
| 아이디 찾기 | 아이디 찾기 | 가입 시 등록한 이메일로 찾을 수 있습니다. |
| 비밀번호 재설정 | 비밀번호 재설정 | 새로운 비밀번호를 설정하세요. |
| 이메일 인증 | 이메일을 확인해주세요 | 인증 코드를 발송했습니다. |

---

## 5. 컴포넌트

### 공통 사이즈 토큰 (Input · Select · Button 공유)

| Size | Height | Padding X | Font | Icon | Radius |
|---|---|---|---|---|---|
| sm | 32–36px | 12px | 14px | 16px | 6px |
| **md** (기본) | 36–40px | 14px | 14–16px | 16–20px | 8px |
| lg | 40–44px | 16px | 16px | 20px | 8px |
| xl | 44px | 18px | 16px | 20px | 10px |

### Button

**6가지 Variant**

| Variant | 용도 | bg | text | border |
|---|---|---|---|---|
| Primary | 메인 CTA (저장·생성·확인) | `brand-600` | white | — |
| Secondary | 브랜드 보조 액션 | `brand-50` | `brand-700` | — |
| Tertiary | 외곽선 보조 액션 | white | `neutral-700` | `slate-300` |
| Ghost | 인라인·약한 액션 | transparent | `brand-700` | — |
| Link | 텍스트 하이퍼링크 형태 | transparent | `brand-700` | — |
| Destructive | 삭제·위험 액션 | `red-600` | white | — |

**State 규칙** (모든 Variant 공통)

- Hover: bg 한 단계 진하게 (예: `brand-600` → `brand-700`)
- Pressed: 두 단계 진하게 (`brand-800`)
- Focused: 현재 bg 유지 + `outline: 2px solid var(--border-focus); outline-offset: 2px`
- Disabled: `brand-200` (Primary) / `slate-200` border (Tertiary) / `cursor: not-allowed`

**버튼 페어 패턴**

| 패턴 | 좌측 | 우측 | 사용처 |
|---|---|---|---|
| `btn-action-pri` | Tertiary `[취소]` | Primary `[저장·생성·확인]` | 모달 푸터, 폼 푸터 |
| `btn-action-sec` | Tertiary `[복제]` | Secondary `[편집·수정]` | 드로어 헤더, 카드 액션 |

**아이콘 옵션**: Leading / Trailing / Icon-only (Icon-only는 `aria-label` 필수). `lucide-react` 사용, `currentColor` 상속.

### Input

**States × 컬러**

| State | Border | Background | Value | Placeholder |
|---|---|---|---|---|
| Default (empty) | `slate-300` | white | — | `slate-400` |
| Filled | `slate-300` | white | `neutral-800` | — |
| Hover | `slate-400` | white | — | `slate-400` |
| Focused | `brand-500` + ring `brand-100` 4px | white | `neutral-800` | `slate-400` |
| Disabled | `slate-200` | `slate-50` | `slate-400` | `slate-400` |
| Read-only | `slate-200` | `slate-50` | `neutral-700` | — |
| Error | `red-500` + ring `red-100` 4px | white | `neutral-800` | `slate-400` |
| Success | `green-500` | white | `neutral-800` | — |

- Focus ring: `box-shadow: 0 0 0 4px var(--brand-100)` (에러 시 `var(--red-100)`)
- Label: Text sm / Medium / `neutral-700`, `margin-bottom: 6px`. 필수 `*` → `red-600`, 선택 `(선택)` → `slate-500`
- Helper text: Text sm / `slate-600`, `margin-top: 6px`
- Error text: Text sm / `red-600` + ⓘ 아이콘 (에러 시 helper 숨김)
- Success text: Text sm / `green-600` + ✓ 아이콘

**Trailing·Leading 아이콘**: `lucide-react`, `slate-500` (기본) / `red-500` (에러) / `green-500` (성공)

**Textarea**: `min-height: 80px`, `resize: vertical`

**Password**: 우측 눈(👁) 토글 아이콘 필수

### Select

Input과 동일한 사이즈·State 체계 공유. 아래 항목만 추가.

- Trigger 우측: chevron ▼ / 열리면 ▲ (`transform: rotate(180deg)`, 150ms)
- Dropdown panel: 트리거 하단 4px gap, 동일 너비, `max-height: 320px` 내부 스크롤, `border: slate-200`, `border-radius: 8px`, `z-index: 60`
- Option item: padding `8px 12px`, radius `6px`. Hover → `bg-muted`. 선택됨 → `bg-subtle` + 우측 `brand-600` ✓
- 키보드: `↑↓` 이동 · `Enter` 선택 · `Esc` 닫기 · `Tab` 다음 필드

### Checkbox

| State | Border | Background | Check Icon |
|---|---|---|---|
| Unchecked | `slate-300` | white | — |
| Unchecked Hover | `brand-500` | white | — |
| Checked | `brand-600` | `brand-600` | white ✓ |
| Checked Hover | `brand-700` | `brand-700` | white ✓ |
| Indeterminate | `brand-600` | `brand-600` | white — |
| Focused | `brand-500` + ring `brand-100` 4px | — | — |
| Disabled | `slate-200` | `slate-50` / `slate-100` | `slate-400` ✓ |
| Error | `red-500` | white | — |

```css
.checkbox {
  width: 16px; height: 16px;              /* 기본 크기 */
  border: 1.5px solid var(--slate-300);   /* 기본 테두리 */
  border-radius: 4px;                     /* 살짝 둥근 모서리 */
  appearance: none;                       /* 브라우저 기본 스타일 제거 */
  flex-shrink: 0;                         /* 라벨이 길어도 크기 유지 */
  cursor: pointer;
  transition: border-color .15s, background .15s;
}
.checkbox:hover               { border-color: var(--brand-500); }
.checkbox:checked             { background: var(--brand-600); border-color: var(--brand-600); }
.checkbox:focus-visible       { box-shadow: 0 0 0 4px var(--brand-100); outline: none; }
.checkbox:disabled            { background: var(--slate-50); border-color: var(--slate-200); cursor: not-allowed; }

.checkbox-group  { display: flex; flex-direction: column; gap: var(--gap-xs); }
.checkbox-item   { display: flex; align-items: flex-start; gap: 8px; cursor: pointer; }
.checkbox-label  { font-size: var(--text-sm); color: var(--neutral-700); line-height: 1.5; }
```

**약관 동의 패턴** (회원가입): 약관 링크는 `brand-700` + underline. 필수 항목 미동의 시 CTA 버튼 Disabled 유지.

### Table

- 헤더: `bg-muted`, Text sm / Semibold / `neutral-700`
- 행 hover: `bg-hover`
- 클릭 가능 행: `cursor: pointer`
- 선택된 행: `bg-selected`
- 정렬·필터·페이지네이션 지원

### Status Badge

> 모든 도메인 상태/코드는 **metadata-service** 정본 (`docs/integration/codes.md`). 색상은 본 §1 토큰 + 각 코드의 `data.color` 메타로 결정. 신규 코드 추가/미사용은 Admin UI에서 즉시 반영.

**테스트 결과** (`tms.execution_result`, 6종 활성): Pass(green) / Fail(red) / Block(yellow) / Skip(neutral) / Untested(slate) / **Pending(slate)**
**결함 상태** (`tms.defect_status`, 4종): Open(red) / In Progress(blue) / Resolved(green) / Closed(neutral)
**결함 심각도** (`tms.defect_severity`, 4종): Critical(red) / Major(orange) / Minor(yellow) / Trivial(green)
**우선순위** (`tms.priority`, 3종): High(red) / Medium(yellow) / Low(green)
**초대 멤버** (`tms.invite_status`, derived 4종): 초대 중(yellow) / 활성(green) / 탈퇴(neutral) / 만료(red)

### Modal · Drawer · Toast

> **z-index 토큰 정본**: [`docs/standards/frontend-coding-standard.md`](../standards/frontend-coding-standard.md) §6.2.2 — `--z-modal`(200) / `--z-drawer`(150) / `--z-toast`(300) / `--z-popover`(60) / `--z-app-shell`(100) / `--z-overlay-on-modal`(250).
> **표현 패턴 락 매트릭스 정본**: [`docs/design/figma-master.md`](./figma-master.md) §8.

- **Modal**: 중앙 정렬, 백드롭 `bg-overlay`, ESC·외부 클릭으로 닫기
- **Drawer**: 우측 슬라이드인 (TC·결함 상세용), 본문 dimming 없음(컨텍스트 유지)
- **Toast**: 우측 상단, 4가지 피드백 색상 (`feedback-*` 토큰), 3초 자동 닫힘

---

## 6. 폼 유효성 검사

### 에러 메시지 표준 문구 (i18n 정본)

> 본 §6은 폼 유효성 메시지의 **i18n 정본**이다. 모든 raw 문구는 본 표에서만 정의하며, 코드·컴포넌트 명세·Toast·다이얼로그 등 외부에서는 **i18n 키만 참조**한다. raw 문구 하드코딩 금지(frontend-coding-standard §12.7 정합).
>
> i18n 키 패턴: `validation.<field>.<rule>` (`success.*`도 동일 패턴). locale JSON 파일(`locales/ko.json`·`locales/en.json`)은 본 표에서 자동 추출(`scripts/sync-i18n-from-design.ts` 예정) — drift 0건 CI 게이트.
>
> **정본 분리 락**:
> - `validation.*` / `success.*` (필드 단위 폼 검증·성공) → 본 §6 (디자이너 정본)
> - `error.*` / `confirm.*` / Toast `success.*` (페이지/모달/액션 단위) → [`docs/integration/error-code-mapping.md`](../integration/error-code-mapping.md) §6~§8 (FE·BE 정합 정본)
> - BE ErrorCode ↔ FE i18n 키 매핑 → 위 동일 문서 §2~§5

| 필드 | 조건 | i18n 키 | 메시지 (ko) | 메시지 (en) |
|---|---|---|---|---|
| 성명 | 미입력 | `validation.name.required` | 성명을 입력해주세요. | Please enter your name. |
| 이메일 | 미입력 | `validation.email.required` | 이메일을 입력해주세요. | Please enter your email. |
| 이메일 | 형식 오류 | `validation.email.format` | 올바른 이메일 형식으로 입력해주세요. | Please enter a valid email address. |
| 이메일 | 중복 | `validation.email.duplicate` | 이미 사용 중인 이메일입니다. | This email is already in use. |
| 아이디 | 미입력 | `validation.username.required` | 아이디를 입력해주세요. | Please enter your username. |
| 아이디 | 형식 오류 (한글 등) | `validation.username.format` | 아이디가 올바르지 않습니다. 다시 확인해주세요. | Invalid username. Please check again. |
| 아이디 | 중복 | `validation.username.duplicate` | 이미 사용 중인 아이디입니다. | This username is already in use. |
| 아이디 | 규칙 안내 | `validation.username.hint` | 영문, 숫자 조합 4~20자로 입력해주세요. | Use 4–20 letters or digits. |
| 비밀번호 | 형식 오류 | `validation.password.format` | 영문, 숫자, 특수문자를 포함한 8자 이상이어야 합니다. | Must be 8+ chars with letters, digits, and symbols. |
| 비밀번호 확인 | 불일치 | `validation.passwordConfirm.mismatch` | 비밀번호가 일치하지 않습니다. 다시 확인해주세요. | Passwords do not match. Please check again. |
| 비밀번호 확인 | 일치 (성공) | `success.passwordConfirm.match` | 비밀번호가 일치합니다. (`green-600` + ✓) | Passwords match. |
| 역할 | 미선택 | `validation.role.required` | 역할을 선택해주세요. | Please select a role. |
| 워크스페이스명 | 미입력 | `validation.workspace.name.required` | 워크스페이스명을 입력해주세요. | Please enter a workspace name. |
| 워크스페이스명 | 중복 | `validation.workspace.name.duplicate` | 이미 사용 중인 워크스페이스명입니다. | This workspace name is already in use. |
| 워크스페이스명 | 길이 초과 (50자) | `validation.workspace.name.maxLength` | 워크스페이스명은 50자 이내로 입력해주세요. | Workspace name must be 50 characters or fewer. |
| 약관 | 미동의 | — (메시지 없음) | CTA Disabled로만 처리 | Disable CTA only |

> 메시지 변경/추가 절차: 본 표 PR → locale JSON 자동 추출 + drift 검증 → BE ErrorCode 매핑 표(컴포넌트 명세) 동기화 → 머지. raw 문구는 본 표 외 어디서도 변경 금지.

### 유효성 검사 타이밍

| 방식 | 시점 | 적용 필드 |
|---|---|---|
| On Blur | 포커스 이탈 시 | 형식 오류, 필수값 미입력 |
| On Change | 실시간 입력 중 | 비밀번호 확인 일치, 비밀번호 강도 |
| On Submit | CTA 클릭 시 | 전체 일괄 검사 → 첫 번째 에러 필드로 스크롤 |

### 비밀번호 강도 인디케이터

인풋 하단, 4칸 바 형태. 입력 전에는 표시하지 않음.

| 단계 | 조건 | 색상 | 라벨 |
|---|---|---|---|
| 1 — 매우 약함 | 8자 미만 또는 단일 유형 | `red-400` | 매우 약함 |
| 2 — 약함 | 8자 이상 + 2가지 유형 | `orange-400` | 약함 |
| 3 — 보통 | 8자 이상 + 3가지 유형 | `yellow-500` | 보통 |
| 4 — 강함 | 12자 이상 + 3가지 유형 이상 | `green-600` | 강함 |

```css
.password-strength-bar      { display: flex; gap: 4px; margin-top: 6px; }
.password-strength-bar span { flex: 1; height: 3px; border-radius: 2px; background: var(--neutral-200); transition: background .2s; }
.password-strength-label    { font-size: var(--text-xs); margin-top: 4px; }
```

