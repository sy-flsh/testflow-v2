# Menu Map (`_shell/menu-map.md`)

`_shell/sidebar.html` 의 `data-menu` 키를 화면 ID / 라우트 / 도메인(feature) / 권한 가시성에 매핑한 SoT(Single source of truth) 표.

- **sidebar.html 의 `data-menu` 키가 SoT**. 본 표는 그 키 기준 매핑.
- 권한 정의·세부 조건(★ 번호)은 [`docs/permissions.md`](../../../permissions.md) 정본 참조. 본 표 가시성 컬럼은 **요약**.
- 화면 ID·노드 URL·라우트 정본은 [`docs/design/figma-master.md`](../figma-master.md) §2 참조.
- 본 파일 수정 시: `sidebar.html` 변경 → 본 표 동기화 → 프론트엔드 에이전트 규칙(`figma-master.md` 또는 별도 지시서) 반영.

---

## 1.1 헤더 대메뉴 (Top-nav) RBAC

헤더의 `data-nav` 링크. 로그인 직후 노출 결정. Figma 정합: CO=[`342:18799`](https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=342-18799) / non-CO=[`342:14803`](https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=342-14803).

| `data-nav` | 라벨 | Master | CO | WO | PO | Member | Viewer |
|---|---|---|---|---|---|---|---|
| `workspace` | 워크스페이스 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `project` | 프로젝트 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `admin` | 통합관리 | - | ✓ | - | - | - | - |

**정합 규칙**:
- **CO 로그인** → `워크스페이스 / 프로젝트 / 통합관리` 3개 표시
- **CO 외 로그인** (WO/PO/Member/Viewer) → `워크스페이스 / 프로젝트` 2개 표시 (통합관리 숨김)
- **Master** → 별도 Master 콘솔 흐름 (본 shell 비대상)

> ⚠ Figma `342:14803` 검증 — 통합관리 자리에 더미 `-` 텍스트 link 잔여. 본 표 결정 = **완전 숨김**(`display:none`). 디자이너 placeholder 정리 필요(figma frame 갱신 권고).

**구현 (shell.css)**:
```css
#app-shell[data-role]:not([data-role="CO"]) .topbar-nav-link[data-nav="admin"] { display: none; }
```

페이지에서 `<div id="app-shell" data-role="CO" ...>` 와 같이 명시. `data-role` 미지정 시 전체 노출(데모/기본).

---

## 1.2 로그인 후 최초 진입 페이지 (Landing)

| Role | 최초 화면 ID | 라우트 | shell `data-mode` | sidebar active | Figma 노드 | 비고 |
|---|---|---|---|---|---|---|
| CO | `S-WS-DASHBOARD` (Company-wide variant) | `/dashboard` 또는 `/workspaces` | `global` | `ws-dashboard` | [`342:18799`](https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=342-18799) | Company 전체 통계 위젯 (회원수·외부연결·문의·WS 관리 테이블). 사용자 인사 표시 |
| WO/PO/Member/Viewer | `S-WS-LIST` (empty/listing variant) | `/workspaces?view=list` | `workspace` | (없음 — ws-root 자체) | [`342:14803`](https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=342-14803) | 본인 멤버 WS 목록. 없으면 empty state + 생성 CTA(WO 한정, ★ 검증) |
| Master | 별도 Master 콘솔 | (TBD) | — | — | — | 본 shell 비대상 |

**구분 포인트**:
- CO: `data-mode="global"` — 사이드바 ws-root(워크스페이스 스위처) 숨김. 헤더 로고 = Qrit 브랜드명. 콘텐츠 = Company-wide 대시보드.
- non-CO: `data-mode="workspace"` — 사이드바 ws-root 노출(WS 미선택 시 "워크스페이스가 없습니다" placeholder). 헤더 로고 = (선택 WS명 / 없으면 Qrit). 콘텐츠 = WS 목록 + 선택 가이드.

⚠ **검증 필요** (Figma `342:14803`):
- non-CO empty state 의 "워크스페이스 생성" CTA 가시성. `permissions.md` §4.2 = WS 생성은 **WO 한정**. Member/Viewer 에는 CTA 숨겨야 정합. 디자이너 확인 후 본 표 갱신.

---

## 1. 메뉴 ↔ 화면 매핑

| `data-menu` | 라벨 (sidebar) | 화면 ID | 라우트 | 도메인(feature) | 활성화 규칙 (URL prefix) |
|---|---|---|---|---|---|
| `ws-dashboard` | 대시보드 | `S-WS-DASHBOARD` | `/workspaces` 또는 `/dashboard` | F-WS | `/workspaces`(exact) / `/dashboard` |
| `ws-profile` | 계정 및 프로필 | `S-USER-PROFILE-ME` | `/me` | F-USER | `/me*` |
| `ws-members` | 회원관리 | `S-WS-MEMBER-LIST` | `/workspaces/:wsId/members` | F-WS | `/workspaces/:wsId/members*` |
| `ws-roles` | 권한관리 | `TBD-S-WS-ROLES` | `TBD` | F-WS | `TBD` |
| `settings-notify` | 알림설정 | `TBD-S-SETTINGS-NOTIFY` | `TBD` | F-SETTINGS (TBD) | `TBD` |
| `settings-integration` | 외부 연결 | `TBD-S-SETTINGS-INTEGRATION` | `TBD` | F-SETTINGS (TBD) | `TBD` |
| `support-notice` | 공지사항 | `TBD-S-SUPPORT-NOTICE` | `TBD` | F-SUPPORT (TBD) | `TBD` |
| `support-faq` | 자주하는질문 | `TBD-S-SUPPORT-FAQ` | `TBD` | F-SUPPORT (TBD) | `TBD` |

> `TBD` 항목은 figma-master.md 화면 카탈로그 미등재. 디자이너 frame 확정 시 본 표·figma-master.md 양쪽 갱신.

### 1.A 컨텍스트별 화면 분기

같은 sidebar 항목이라도 shell `data-mode` / `data-role` 에 따라 가리키는 화면이 다르다. Figma `342:18799`(CO global) vs `342:14803`(non-CO workspace) 정합.

| `data-menu` | CO + `data-mode="global"` | non-CO + `data-mode="workspace"` |
|---|---|---|
| `ws-dashboard` | `S-WS-DASHBOARD` (Company-wide 위젯) | `S-WS-DASHBOARD` (WS-scoped 위젯) — 동일 ID, variant 분기 |
| `ws-members` | `S-USER-LIST` (`/company/users` — Company 회원관리) | `S-WS-MEMBER-LIST` (`/workspaces/:wsId/members` — WS 멤버관리) |
| `ws-roles` | `S-USER-MATRIX` (`/company/users?drawer=user&tab=matrix` — Company-wide Role 매트릭스) | `TBD-S-WS-ROLES` — non-CO 노출 X (§2 가시성) |
| `settings-integration` | Company 단위 외부 연동 (TBD) | WS 단위 외부 연동 (TBD) — WO ★5 한정 |

> 라우팅 가드 구현 시 `data-menu` 클릭 핸들러는 현재 컨텍스트(`data-role` + `data-mode`)에 따라 위 표대로 분기. menu key 는 단일, 라우트는 분기.

---

## 2. 권한별 메뉴 가시성

각 셀: `✓` = 메뉴 표시, `-` = 숨김, `★N` = 조건부(`permissions.md` §5 참조).

**Workspace 컨텍스트** (`data-mode="workspace"` shell):

| `data-menu` | Master | CO | WO | PO ★22 | Member(WS) | Viewer(WS) | Member(Proj) ★22 | 비고 |
|---|---|---|---|---|---|---|---|---|
| `ws-dashboard` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 진입자 전원 (★4·★22) |
| `ws-profile` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 본인 프로필. 로그인 사용자 전원 |
| `ws-members` | - | ✓ | ✓ | - | ✓ ★22 | ✓ ★22 | - | WS Scope 보유자만. 본인 멤버 목록 read |
| `ws-roles` | - | ✓ | - | - | - | - | - | Role 부여는 CO만 (`permissions.md` §1) |
| `settings-notify` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 본인 알림 환경설정 (전원) |
| `settings-integration` | - | ✓ | ✓ ★5 | - | - | - | - | WS 단위 외부 연동 (WO 본인 소유 WS) |
| `support-notice` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 공지 read (전원) |
| `support-faq` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAQ read (전원) |

> 조건 ★ 번호는 `permissions.md` §5 정의. 본 표 갱신 시 cross-check 필수.

**Global 컨텍스트** (`data-mode="global"` shell, CO 로그인 기본 / 워크스페이스 미선택):
- ws-root 섹션(워크스페이스 스위처) 자동 숨김 (shell.css `:not([data-mode="workspace"]) .nav-section.ws-root { display: none; }`).
- 메뉴 자체 가시성은 동일 (sidebar.html SoT). 단 §1.A 분기로 같은 메뉴가 다른 화면(예: `ws-members` → `/company/users`) 가리킴.
- Figma 정합: `342:18799` (CO 로그인 첫 페이지).

**non-CO 첫 페이지 정합** (Figma `342:14803`):
- `data-mode="workspace"` + WS 미선택 상태 = ws-root 에 "워크스페이스가 없습니다" placeholder + 콘텐츠 영역 = S-WS-LIST empty.
- 사이드바 메뉴는 모두 표시되지만 클릭 시 라우팅 가드가 "WS 미선택 → WS 선택 강제" 인터셉트.

---

## 3. Active 메뉴 결정 규칙

페이지에서 `#app-shell data-active-menu="<key>"` 로 지정. 규칙:

1. **페이지 라우트 매칭**: URL prefix(§1 활성화 규칙 컬럼)와 일치하는 `data-menu` 1개 선택.
2. **모달/Drawer 오버레이**: 백그라운드 페이지의 `data-menu` 그대로 유지 (모달은 active 영향 X).
3. **다중 매칭 시 가장 깊은 prefix**: 예: `/workspaces/:wsId/members/:userId` → `ws-members`.
4. **매칭 없음**: `data-active-menu` 미설정. 어느 항목도 active 안 됨 (예: S-WS-LIST 같이 메뉴 외부 화면).

---

## 4. 확장 가이드

신규 메뉴 추가 시:

1. `_shell/sidebar.html` 에 `<a class="nav-item" data-menu="<new-key>">` 추가. 키 네이밍: `<도메인>-<역할>` (예: `proj-list`, `tc-library`).
2. 본 표 §1·§2 행 추가.
3. 화면 ID·라우트·노드 URL 은 `figma-master.md` §2 동시 갱신.
4. 권한 가시성 조건 추가 시 `permissions.md` 정본과 ★ 번호 일치 검증.

**향후 도메인 확장 예정 메뉴** (sidebar.html 미등재, figma-master.md 노드 확정 시 추가):

| 도메인 | 예상 `data-menu` | 후보 화면 ID |
|---|---|---|
| F-PROJ | `proj-list`, `proj-detail`, `proj-members`, `proj-settings` | S-PROJ-LIST / S-PROJ-DETAIL / S-PROJ-MEMBER-LIST / S-PROJ-SETTINGS |
| F-TS | `ts-tree` | S-TS-TREE |
| F-TC | `tc-list-proj`, `tc-library-ws`, `tc-library-global` | S-TC-LIST-PROJ / S-TC-LIST-WS / S-TC-LIST-GLOBAL |
| F-PLAN | `plan-list` | S-PLAN-LIST |
| F-RUN | `run-list` | S-RUN-LIST |
| F-DEFECT | `defect-list` | (figma-master.md §2.11+ 확정 시) |
| F-USER (CO) | `co-user-list` | S-USER-LIST |

---

## 5. 프론트엔드 에이전트 규약

본 표는 프론트엔드 에이전트 작업 시 다음 용도:

- 페이지 구현 시: 라우트 → §1 표에서 `data-menu` 키 lookup → `#app-shell data-active-menu` 세팅.
- 로그인 직후 리다이렉트: §1.2 Landing 표 기준 분기 (`data-role="CO"` → `/dashboard`, 그 외 → `/workspaces?view=list`).
- 같은 sidebar 클릭이라도 §1.A 컨텍스트별 분기로 라우트 결정.
- 라우팅 가드 구현 시: §2 가시성 표 + `permissions.md` 조건 결합 → 메뉴 렌더링 분기 + 라우트 접근 제어.
- 메뉴 항목 비활성/숨김 분기는 **하드코딩** (memory: `Menu RBAC hardcoded` — 온프레미스, 설정 UI 없음).
