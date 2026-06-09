# Prototype Shell (`_shell/`)

정적 HTML 목업 공통 골격. Header + Sidebar 고정, 페이지는 콘텐츠만 작성.

## 구성

| 파일 | 역할 |
|---|---|
| `shell.css` | 디자인 토큰 + Topbar + Sidebar + AppShell 그리드 + 반응형 |
| `header.html` | Topbar partial (로고/주메뉴/알림/아바타). `data-slot` 마커로 동적 치환 |
| `sidebar.html` | 메뉴 partial. `data-menu` 속성으로 항목 식별 |
| `shell.js` | partial fetch + inject + active 상태/슬롯 주입 + `tmsToast` / `tmsNotify` API |
| `menu-map.md` | `data-menu` ↔ 화면 ID ↔ 라우트 ↔ 권한 가시성 매핑 SoT |
| `components/` | `docs/design/components/*.md` 명세 기반 CSS 컴포넌트 lib. `README.md` 참조 |

## 신규 페이지 템플릿

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TMS — {화면명} ({SCREEN-ID})</title>
  <link rel="preconnect" href="https://rsms.me/" />
  <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
  <link rel="stylesheet" href="_shell/shell.css" />
  <style>/* 페이지 전용 스타일만 */</style>
</head>
<body>
  <div id="app-shell"
       data-top-nav="workspace"
       data-active-menu="ws-dashboard"
       data-mode="global"
       data-user-initial="이"
       data-user-name="이주환">
    <header class="app-header topbar"></header>
    <div class="app-shell">
      <aside class="app-sidebar sidebar"></aside>
      <main class="main">
        <!-- 콘텐츠 영역만 작성 — Figma 콘텐츠 노드 매핑 지점 -->
      </main>
    </div>
  </div>
  <script src="_shell/shell.js"></script>
</body>
</html>
```

## `#app-shell` data 속성

| 속성 | 값 | 효과 |
|---|---|---|
| `data-top-nav` | `workspace` / `project` / `admin` | 상단 메인 nav active 표시 |
| `data-active-menu` | sidebar.html 의 `data-menu` 값 | 좌측 메뉴 active 표시 |
| `data-mode` | `global` (기본) / `workspace` | workspace 모드 시 워크스페이스 스위처 + 루트 섹션 노출 |
| `data-workspace-name` | 문자열 | 로고 텍스트 + ws-select 라벨로 주입 (workspace 모드용) |
| `data-user-initial` | 1자 | 아바타 글자 |
| `data-user-name` | 문자열 | 아바타 `aria-label` |
| `data-role` | `Master` / `CO` / `WO` / `PO` / `Member` / `Viewer` | RBAC 분기 (예: `data-role!="CO"` → 통합관리 대메뉴 숨김). 미지정 시 전체 노출. menu-map.md §1.1 참조 |

## 활성 메뉴 식별자 (`data-menu`)

화면 ID / 라우트 / 도메인(feature) / 권한 가시성 포함 전체 매핑은 [`menu-map.md`](./menu-map.md) 참조.

신규 메뉴 추가 시: `sidebar.html` 항목 추가 → `menu-map.md` §1·§2 행 추가 → `figma-master.md` 화면 카탈로그 동기화.

## 로컬 실행

`fetch()` 가 `file://` 에서 차단됨. 반드시 로컬 서버로 실행:

```bash
# 프로젝트 루트
cd docs/design/prototypes
python3 -m http.server 8000
# → http://localhost:8000/s-ws-dashboard.html
```

대안: `npx serve .` / VS Code Live Server.

## Figma 노드 URL 매핑 규약

- **인증 후 화면**: Figma 노드 URL은 **콘텐츠 영역(`<main>` 내부)** 만 매핑. Header/Sidebar 노드는 제외.
- **로그인/공개 화면**: `#app-shell` 미사용. 단독 HTML.
- **모달/Drawer/Toast**: 별도 노드 URL 필요. shell 위에 떠야 하므로 페이지별 추가.
- Figma 콘텐츠 프레임 폭은 사이드바(260px) 차감한 실 콘텐츠 폭과 일치해야 어긋남 없음.

## 마이그레이션 현황

| 파일 | 상태 | 비고 |
|---|---|---|
| `s-ws-dashboard.html` | ✅ shell 전환 완료 | 콘텐츠 placeholder만 |
| `s-ws-list.html` | ✅ shell 전환 완료 | workspace 모드, 페이지 CSS 인라인 (테이블/페이지네이션) |
| `s-ws-create.html` | ✅ shell 전환 완료 | workspace 모드, 백그라운드(list 콘텐츠) + 모달 + 스크립트 인라인 |
| `s-ws-deactivate-confirm.html` | ✅ shell 전환 완료 | workspace 모드, 위험 confirm 모달 + 성공 시 `tmsToast`+`tmsNotify` 호출 |
| `s-auth-login.html` | ✅ 신규 + components/ 마이그 완료 | 새 화면, public header + 중앙 카드. Figma 342:12913. `btn.css`/`text-input.css`/`checkbox.css` 사용 |
| `s-auth-signup-co.html` | ✅ 신규 + components/ 마이그 완료 | 새 화면, Figma 342:12836. `btn.css`/`text-input.css`/`checkbox.css`/`select.css` 사용. ⚠ role select 정합 이슈 — permissions.md ★1 (셀프 가입 = CO 자동) vs Figma select. PM 확정 대기 |
| `s-auth-find-username.html` | ✅ 결과 페이지 분리 갱신 | 새 화면, Figma 295:7469 (요청). 탭 UI + 이메일 입력. 성공 시 결과 페이지로 이동(인플레이스 결과 제거). `btn.css`/`text-input.css` 사용 |
| `s-auth-find-username-result.html` | ✅ Figma 정합 검증 완료 | 새 화면, Figma 342:13056. 회색 결과 카드 (좌측 정렬, 확인된 아이디 + 가입일). Primary `로그인` CTA + footer 비밀번호 찾기 link. URL 쿼리 `?u=<masked>&joined=<YYYY-MM>` |
| `s-auth-forgot-password.html` | ✅ 재작성 | 새 화면, Figma 285:9766 (Find-PW 1). 탭 UI · 아이디+이메일 · 본인인증 CTA · 결과 모달 342:13221 (AC-17 존재 은닉). `btn.css`/`text-input.css` 사용 |
| `s-ws-create.html` | ✅ components/ 마이그 완료 | 백그라운드(list 콘텐츠) + 모달. `btn.css`/`text-input.css`/`modal.css size-xl` 사용. 테이블/페이지네이션/검색 인라인 잔존 (data-table.css/search-box.css 미수록) |
| `s-ws-list.html` | ✅ components/ 마이그 완료 | `btn.css`/`data-table.css`/`pagination.css` 사용. title-bar 영역만 인라인 |
| `s-ws-deactivate-confirm.html` | 🟡 components/ 미마이그 (인라인 CSS 잔존) | 차후 `modal.css` + confirm-dialog.css 추출 후 적용 |

페이지별 CSS는 인라인 유지. shell 은 Header/Sidebar/AppShell/토큰만 담당. 페이지에서 토큰(`--brand-600`, `--neutral-*` 등) 그대로 사용 가능.

## Toast + Notification API

`shell.js` 가 전역에 두 API를 노출. Figma 노드 매핑: toast = `342:20324` (success variant).

### `window.tmsToast(opts)`

우상단 스택 토스트. auto-dismiss.

```js
window.tmsToast({
  variant: 'success',           // 'success' | 'error' | 'info' (기본 success)
  title: '워크스페이스가 비활성화되었습니다',
  desc:  '멤버 접근이 차단됩니다.',
  duration: 4500,               // ms. 0 = 영구 (수동 닫기)
});
```

- 컨테이너 `.tms-toast-container` 는 `<body>` 직속, `z-index: var(--z-toast)` (300).
- 닫기 버튼 / `duration` 만료 시 fade-out 후 DOM 제거.
- 동시 다발 호출 시 세로 스택.

### `window.tmsNotify(payload)`

알림센터(헤더 종 버튼)에 항목 push. `localStorage['tms.notifications']` 저장 (최대 50건, FIFO).

```js
window.tmsNotify({
  type: 'success',              // 'success' | 'error' | 'info'
  title: '워크스페이스가 비활성화되었습니다',
  desc:  '멤버 접근이 차단됩니다.',
  ts:    Date.now(),            // 선택. 기본 now
});
```

- 종 버튼 우상단 unread 배지 자동 갱신.
- 종 버튼 클릭 → dropdown open → 최신순 리스트.
- "모두 읽음 처리" 버튼 → 배지 0.
- Esc / 외부 클릭으로 dropdown 닫기.

### 사용 패턴 (성공 처리 후)

```js
// 비활성화 API 호출 성공 → 두 API 동시 호출 (토스트 + 알림센터 동기화)
window.tmsToast({ variant:'success', title, desc });
window.tmsNotify({ type:'success',  title, desc });
```

> 추후 백엔드 연동 시 `tmsNotify` 는 SSE/웹훅 payload 어댑터로 대체. 프로토타입에서는 localStorage 영구 저장.
