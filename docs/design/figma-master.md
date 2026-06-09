# TMS Figma 마스터 매핑 표 (Figma Master Mapping)

| 항목 | 내용 |
| --- | --- |
| 문서명 | TMS Figma 마스터 매핑 표 (Figma Master Mapping) |
| 문서 버전 | v0.2 (P1 정본 초안) |
| 최초 작성일 | 2026-06-08 |
| 최종 개정일 | 2026-06-08 |
| 작성 주체 | Frontend 개발 에이전트 |
| 문서 등급 | L1 (영역별 세부 정의서, Figma ↔ 화면 ↔ 라우트 ↔ 표현 패턴 매핑 정본) |
| 상위 문서 | `docs/srs.md` §5.0 디자인 정본 / `docs/standards/frontend-coding-standard.md` §UI 표현 패턴 |
| 적용 범위 | TMS 전 화면(MVP 12기능 + 부속 UX) ↔ Figma 마스터 파일 frame node 매핑 |

> 본 문서는 **Figma 디자인 정본**과 **기능 명세 / 프론트엔드 라우트 / 표현 패턴 / 공통 컴포넌트**의 양방향 매핑을 관리하는 단일 진입점이다.
>
> - 디자인-명세 충돌 시 SRS §5.0 우선순위 규칙(권한·격리·에러·AC는 명세 우선 / 시각·인터랙션·레이아웃은 Figma 우선)을 따른다.
> - 각 기능 명세 `§1 메타` 표의 **Figma** 행과 본 문서의 `Figma 노드 URL`은 **항상 동기화**되어야 한다 (불일치 시 본 문서가 정본).
> - 표현 패턴(`새 화면` / `페이지` / `모달` / `사이드바`)은 `frontend-coding-standard.md` §8 UI 표현 패턴 및 `srs.md` §6.3.1과 **락 정합**한다.

---

## 0. Figma 마스터 파일 정보

| 항목 | 값 |
| --- | --- |
| 파일 URL | https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=0-1&p=f&m=dev |
| File Key | `5G8kNWGjSSPaG3OepCfU55` |
| 기본 진입 node | `0-1` |
| 브랜치 | `main` (마스터 브랜치 단일 운영, 분기 도입 시 본 표 갱신) |
| 소유자 | PM (정본 책임) / 디자이너 (제작) — 데모 단계 디자이너 미배정 시 PM 대리 |
| 최종 갱신일 | 2026-06-08 |
| 디자인 토큰 페이지 | TBD-TOKENS (token / variable 페이지 node-id 미정) |
| 컴포넌트 라이브러리 페이지 | TBD-COMPONENTS (component 페이지 node-id 미정) |

### 0.1 공통 Shell 노드 (인증 후 베이스)

모든 **인증된 페이지(새 화면·페이지 표현 패턴)** 는 단일 Shell 위에 콘텐츠 영역만 합성한다. `§1·§2` 화면 매핑 표의 `Figma 노드 URL` 컬럼은 **콘텐츠 영역 노드만** 가리키며, 화면 렌더 시 본 표의 Shell 노드와 합성한다.

| Shell 종류 | Figma 노드 | 진입 조건 | 비고 |
| --- | --- | --- | --- |
| **인증 후 Shell (기본)** | [`402-3089`](https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=402-3089&m=dev) | 로그인 완료 + 워크스페이스/프로젝트/통합관리 탭 진입 | Header (로고·메인 네비 3탭·알림·아바타) + Sidebar (워크스페이스 설정·일반 설정·고객센터) |
| 인증 전 Shell (Auth Layout) | TBD-SHELL-AUTH | `/login`·`/signup`·`/forgot-password` 등 새 화면 인증 흐름 | 디자이너 §4 인증 페이지 레이아웃 정합 |

### 0.2 화면 합성 워크플로 (필수)

1. **콘텐츠 노드 fetch**: `mcp__figma__get_screenshot` + `get_design_context`로 페이지 매핑 표의 콘텐츠 노드 확인.
2. **Shell 노드 fetch**: 위 §0.1의 진입 조건에 맞는 Shell 노드 확인 (이미 캐시되어 있다면 재사용).
3. **합성**: Shell 그대로 + Header 메인 네비 active 매핑 + Sidebar nav-item active 매핑 + 콘텐츠 영역에 페이지 콘텐츠 삽입.
4. **검증**: Shell + 콘텐츠의 라우트가 §1·§2 매핑 표와 일치.
5. **Auth Layout 적용 예외**: 미인증 흐름(`/login` 등 새 화면)은 인증 후 Shell 사용 금지 → Auth Shell 사용.

> URL 규칙: `https://www.figma.com/design/{FILE_KEY}/TMS?node-id={NODE_ID}&m=dev` — `node-id`는 본 표의 `:` 표기를 `-`로 치환하여 사용한다.
> 미작성 frame은 `Figma 노드 URL` 컬럼에 `TBD-<화면ID>` placeholder를 둔다. 실제 frame 작성 후 `<file_key>` 기반 URL로 치환한다.
> **매핑 노드 범위 (락 v2.4 보강)**: 본 표의 `Figma 노드 URL`은 **콘텐츠 영역 노드만** 가리킨다(Shell 제외). 디자이너가 전체 페이지 frame만 작성한 기존 행(예: `S-WS-LIST=342-13892`)은 Shell + 콘텐츠 통합이므로 합성 워크플로 §0.2 5단계에서 검증 시 콘텐츠 영역만 추출하여 사용.

---

## 1. 화면 매핑 표 (정본)

### 1.1 명명 규칙

- **화면 ID**: `S-<도메인>-<액션>` 형식 (예: `S-AUTH-LOGIN`, `S-TC-DETAIL`).
- **도메인**: `AUTH`, `MASTER`, `COMPANY`, `WS`, `USER`, `PROJ`, `TS`, `TC`, `PLAN`, `RUN`, `DEF`, `ATTACH`, `REPORT`, `GLOBAL` (SRS §7.1 DOMAIN 표준값 정합).
- **액션 예시**: `LIST`, `DETAIL`, `CREATE`, `EDIT`, `DELETE-CONFIRM`, `INVITE`, `FORGOT`, `RESET`, `EXECUTE`, `TRANSFER`, `MATRIX`, `TREE`, `MOVE`, `RENAME`, `ACCEPT-INVITE`, `VERIFY-EMAIL`, `FIRST-CHANGE`, `DASHBOARD`.

### 1.2 표현 패턴

`frontend-coding-standard.md` §8 + SRS §6.3.1 락:

| 표현 패턴 | 정의 | 적용 사례 |
| --- | --- | --- |
| **새 화면** | 미인증 흐름. 전체 페이지 라우팅 | `/login`·`/signup`·`/forgot-password`·`/reset-password`·`/accept-invite`·`/verify-email` 등 인증 컨텍스트 부재 |
| **페이지** | 인증된 메인 페이지. 라우트 1:1 매핑 | 대시보드·목록·실행 화면 등 |
| **모달** | 일반 CRUD 팝업. 백그라운드 페이지 유지. `?modal=...` 쿼리 동기화 | Project/WS/Plan/TC/Defect 생성·수정·확인 |
| **사이드바** | 우측 슬라이드인 Drawer. 본문 dimming 없음. `?drawer=...` 쿼리 동기화 | TestRun TC 상세 / 회원관리 상세 / 알림 |

추가 룰:
- 모달은 편집 모드 닫기 시 **변경 손실 경고**.
- 사이드바 폭 480~640px, 본문 dimming 없음(컨텍스트 유지).
- **모달·사이드바 동시 열림 금지**(스택 X). 새 모달 열리면 기존 사이드바·모달은 닫힘.
- 키보드: `Esc` 닫기, 포커스 트랩.
- URL 직접 진입 호환 (새로고침 시 복원).

### 1.3 컬럼 정의

| 컬럼 | 의미 |
| --- | --- |
| 화면 ID | `S-<도메인>-<액션>` 형식 |
| 화면명 | 한국어 화면 명 |
| 소속 feature | `F-<도메인>` 또는 `GLOBAL` |
| Figma 노드 URL | Figma frame URL (`https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=XXXX&m=dev`) 또는 `TBD-<화면ID>` |
| 표현 패턴 | `새 화면` / `페이지` / `모달` / `사이드바` |
| 라우트 경로 | React Router path 또는 `?modal=...` / `?drawer=...` 쿼리 |
| 비고 | 관련 ★ 룰·UX 명세·참조 |

---

## 2. 화면 매핑 표 (도메인별)

### 2.1 인증 (F-AUTH, 미인증 흐름)

> 표현 패턴 락: **새 화면 6개 + 임시비번 강제 변경 1개**. 모달·사이드바 불가 (인증 컨텍스트 부재).

| 화면 ID | 화면명 | 소속 feature | Figma 노드 URL | 표현 패턴 | 라우트 경로 | 비고 |
| --- | --- | --- | --- | --- | --- | --- |
| S-AUTH-LOGIN | 로그인 | F-AUTH | https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=342-12913&t=7NRyxK9NVc512tu0-4 | 새 화면 | `/login` | Master + 일반 사용자 공용 |
| S-AUTH-SIGNUP-CO | 셀프 회원가입 (CO) | F-AUTH | https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=342-12836&t=7NRyxK9NVc512tu0-4 | 새 화면 | `/signup` | 경로 B, 회사명·이메일·비밀번호 입력 |
| S-AUTH-VERIFY-EMAIL | 이메일 인증 처리 | F-AUTH | TBD-S-AUTH-VERIFY-EMAIL | 새 화면 | `/verify-email?token=...` | 토큰 검증 결과 + 로그인 안내 |
| S-AUTH-ACCEPT-INVITE | 초대 수락 (비번 설정) | F-AUTH | TBD-S-AUTH-ACCEPT-INVITE | 새 화면 | `/accept-invite?token=...` | 경로 C, 자동 로그인 후 진입 |
| S-AUTH-FIND-USERNAME | 아이디 찾기 | F-AUTH | https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=342-13027&t=GRqPvuntD2S5NKmP-4 | 새 화면 | `/find-username` | 이메일 입력 → 마스킹 아이디 노출 (요청+결과 단일 화면 state, result node `298-7851`). 미가입 이메일도 동일 응답 (존재 은닉) |
| S-AUTH-FORGOT | 비밀번호 찾기 요청 | F-AUTH | https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=285-9766&t=7NRyxK9NVc512tu0-4 | 새 화면 | `/forgot-password` | 아이디+이메일 → 본인인증 메일 발송. 미가입도 동일 결과 모달 (존재 은닉, AC-17). 결과 모달 node `342-13221` |
| S-AUTH-RESET | 비밀번호 재설정 | F-AUTH | TBD-S-AUTH-RESET | 새 화면 | `/reset-password?token=...` | 1회용 토큰 |
| S-AUTH-FIRST-CHANGE | 임시비번 강제 변경 | F-AUTH | TBD-S-AUTH-FIRST-CHANGE | 새 화면 | `/change-password?first=1` | Master 등록 경로 후 첫 로그인 (`mustChangePassword=true`) |

### 2.2 Master 영역 (F-COMPANY, Master 전용)

> 표현 패턴 락: 목록은 **페이지**, 생성·비활성/활성 확인은 **모달**.

| 화면 ID | 화면명 | 소속 feature | Figma 노드 URL | 표현 패턴 | 라우트 경로 | 비고 |
| --- | --- | --- | --- | --- | --- | --- |
| S-MASTER-COMPANY-LIST | Company 목록 (Master) | F-COMPANY | TBD-S-MASTER-COMPANY-LIST | 페이지 | `/master/companies` | 검색·필터·페이지네이션 |
| S-MASTER-COMPANY-DETAIL | Company 상세 (Master) | F-COMPANY | TBD-S-MASTER-COMPANY-DETAIL | 페이지 | `/master/companies/:companyId` | 활성/비활성 토글 진입점 |
| S-MASTER-COMPANY-CREATE | Company + 첫 CO 생성 | F-COMPANY | TBD-S-MASTER-COMPANY-CREATE | 모달 | `/master/companies?modal=create-company` | 회사명·slug·CO 이메일·CO 이름 |
| S-MASTER-COMPANY-DEACTIVATE-CONFIRM | Company 비활성 확인 | F-COMPANY | TBD-S-MASTER-COMPANY-DEACTIVATE-CONFIRM | 모달 | `?modal=deactivate-company&id=...` | 확인 다이얼로그 (SRS §6.3) |

### 2.3 Company 관리 (CO 영역, F-COMPANY)

| 화면 ID | 화면명 | 소속 feature | Figma 노드 URL | 표현 패턴 | 라우트 경로 | 비고 |
| --- | --- | --- | --- | --- | --- | --- |
| S-COMPANY-SETTINGS | 회사 정보 설정 (CO) | F-COMPANY | TBD-S-COMPANY-SETTINGS | 페이지 | `/company/settings` | 이름 수정 + 이관/CO 부여 진입점 |
| S-COMPANY-TRANSFER-OWNER | 소유자 이관 확인 | F-COMPANY | TBD-S-COMPANY-TRANSFER-OWNER | 모달 | `/company/settings?modal=transfer-owner` | 대상 CO 검색·확인 |
| S-COMPANY-GRANT-CO-CONFIRM | CO 권한 부여 확인 | F-COMPANY | TBD-S-COMPANY-GRANT-CO-CONFIRM | 모달 | `?modal=grant-co&userId=...` | 회원 사이드바 액션에서도 진입 가능 |

### 2.4 회원 관리 (CO 영역, F-USER + _ux-user-detail + _ux-role-matrix)

> `_ux-user-detail.md` / `_ux-role-matrix.md` 명세 정본 정합. 회원 상세는 **사이드바 Drawer**, 초대는 **모달**, Role 매트릭스는 사이드바 내부 **탭 전환**.

| 화면 ID | 화면명 | 소속 feature | Figma 노드 URL | 표현 패턴 | 라우트 경로 | 비고 |
| --- | --- | --- | --- | --- | --- | --- |
| S-USER-LIST | Company 회원 목록 | F-USER | https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=282-14722&m=dev | 페이지 | `/company/users` | 검색·필터(`q`/`isActive`/`role`)·정렬 |
| S-USER-DETAIL | 회원 상세 (프로필 탭) | F-USER | TBD-S-USER-DETAIL | 사이드바 | `/company/users?drawer=user&id=:userId` | `_ux-user-detail.md` §3 |
| S-USER-MATRIX | Role 매트릭스 탭 | F-USER | TBD-S-USER-MATRIX | 사이드바 | `/company/users?drawer=user&id=:userId&tab=matrix` | `_ux-role-matrix.md` 정본 |
| S-USER-INVITE | 회원 초대 모달 | F-USER | TBD-S-USER-INVITE | 모달 | `/company/users?modal=invite` | 사전 Role 부여 옵션 포함 |
| S-USER-INVITE-RESEND | 활성 초대 재발송/취소 | F-USER | TBD-S-USER-INVITE-RESEND | 모달 | `?modal=invite&resendId=...` | 미만료 토큰 처리 (UX §4.3) |
| S-USER-RESET-PW-CONFIRM | 비밀번호 리셋 확인 | F-USER | TBD-S-USER-RESET-PW-CONFIRM | 모달 | `?modal=reset-pw&userId=...` | 사이드바 액션 진입 |
| S-USER-DEACTIVATE-CONFIRM | 회원 비활성/활성 확인 | F-USER | TBD-S-USER-DEACTIVATE-CONFIRM | 모달 | `?modal=deactivate-user&userId=...` | 본인 차단 가드 |
| S-USER-WITHDRAW-CONFIRM | 회원 탈퇴 확인 | F-USER | TBD-S-USER-WITHDRAW-CONFIRM | 모달 | `?modal=withdraw-user&userId=...` | 이메일 타이핑 확인 (UX §5.3) |
| S-USER-PROFILE-ME | 본인 프로필 | F-USER | TBD-S-USER-PROFILE-ME | 페이지 | `/me` | 본인 이름 수정 + 비번 변경 진입 |
| S-USER-CHANGE-PW | 본인 비밀번호 변경 | F-USER | TBD-S-USER-CHANGE-PW | 모달 | `/me?modal=change-password` | F-AUTH §5.7 연계 |

### 2.5 Workspace (F-WS)

| 화면 ID | 화면명 | 소속 feature | Figma 노드 URL | 표현 패턴 | 라우트 경로 | 비고 |
| --- | --- | --- | --- | --- | --- | --- |
| S-WS-DASHBOARD | Workspace 대시보드 (인증 후 첫 진입) | F-WS | https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=342-19757&t=7NRyxK9NVc512tu0-4 | 페이지 | `/workspaces` 또는 `/dashboard` | 로그인 직후 진입점. 사이드바 §1 "대시보드" active. WS 미선택/단일 WS 케이스 모두 대응 |
| S-WS-LIST | Workspace 목록 | F-WS | https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=342-19271&t=7NRyxK9NVc512tu0-4 | 페이지 | `/workspaces?view=list` | CO=전체, 일반=본인 멤버만. (현 frame은 Shell+콘텐츠 통합 — §0.2 합성 워크플로로 콘텐츠만 추출) |
| S-WS-CREATE | Workspace 생성 (WO) | F-WS | https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=284-6852&m=dev | 모달 | `/workspaces?modal=create-ws` | 이름·설명 |
| S-WS-SETTINGS | Workspace 정보 설정 | F-WS | TBD-S-WS-SETTINGS | 페이지 | `/workspaces/:workspaceId/settings` | 수정·이관·비활성 진입점 |
| S-WS-EDIT | Workspace 정보 수정 | F-WS | TBD-S-WS-EDIT | 모달 | `?modal=edit-ws&id=...` | 이름·설명 수정 |
| S-WS-TRANSFER | WS 소유자 이관 (CO) | F-WS | https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=351-12191&t=7NRyxK9NVc512tu0-4 | 모달 | `?modal=transfer-ws&id=...` | 대상 WO 검색 |
| S-WS-DEACTIVATE-CONFIRM | WS 비활성/활성 확인 | F-WS | https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=342-20308&t=7NRyxK9NVc512tu0-4 | 모달 | `?modal=deactivate-ws&id=...` | 성공 시 toast(success) `node-id=342-20324` 우상단 표출 + 알림센터(`tms.notifications`) push |
| S-WS-MEMBER-LIST | WS 멤버 목록 | F-WS | TBD-S-WS-MEMBER-LIST | 페이지 | `/workspaces/:workspaceId/members` | |
| S-WS-MEMBER-INVITE | WS 멤버 초대 (WO) | F-WS | TBD-S-WS-MEMBER-INVITE | 모달 | `?modal=invite-ws-member` | 같은 Company 사용자만 |
| S-WS-MEMBER-REMOVE-CONFIRM | WS 멤버 제거 확인 | F-WS | TBD-S-WS-MEMBER-REMOVE-CONFIRM | 모달 | `?modal=remove-ws-member&userId=...` | 마지막 WO 보호 |

### 2.6 Project (F-PROJ)

| 화면 ID | 화면명 | 소속 feature | Figma 노드 URL | 표현 패턴 | 라우트 경로 | 비고 |
| --- | --- | --- | --- | --- | --- | --- |
| S-PROJ-LIST | Project 목록 | F-PROJ | TBD-S-PROJ-LIST | 페이지 | `/workspaces/:workspaceId/projects` | Role 기반 가시 필터 |
| S-PROJ-CREATE | Project 생성 | F-PROJ | TBD-S-PROJ-CREATE | 모달 | `?modal=create-project` | WO/PO/Member 가능 (★15) + `code` 자동 제안 |
| S-PROJ-DETAIL | Project 상세/대시보드 | F-PROJ | TBD-S-PROJ-DETAIL | 페이지 | `/projects/:projectId` | Suite/TC/Plan/Run/Defect/Report 진입점 |
| S-PROJ-SETTINGS | Project 정보 설정 | F-PROJ | TBD-S-PROJ-SETTINGS | 페이지 | `/projects/:projectId/settings` | 이름·설명 (code 불변) |
| S-PROJ-EDIT | Project 정보 수정 | F-PROJ | TBD-S-PROJ-EDIT | 모달 | `?modal=edit-project` | 이름·설명만 |
| S-PROJ-DEACTIVATE-CONFIRM | Project 비활성/활성 확인 | F-PROJ | TBD-S-PROJ-DEACTIVATE-CONFIRM | 모달 | `?modal=deactivate-project&id=...` | |
| S-PROJ-MEMBER-LIST | Project 멤버 목록 | F-PROJ | TBD-S-PROJ-MEMBER-LIST | 페이지 | `/projects/:projectId/members` | |
| S-PROJ-MEMBER-INVITE | Project 멤버 초대 (PO) | F-PROJ | TBD-S-PROJ-MEMBER-INVITE | 모달 | `?modal=invite-project-member` | 같은 WS 멤버만 |
| S-PROJ-MEMBER-REMOVE-CONFIRM | Project 멤버 제거 확인 | F-PROJ | TBD-S-PROJ-MEMBER-REMOVE-CONFIRM | 모달 | `?modal=remove-project-member&userId=...` | 마지막 PO 보호 |

### 2.7 TestSuite (F-TS, 폴더 트리)

| 화면 ID | 화면명 | 소속 feature | Figma 노드 URL | 표현 패턴 | 라우트 경로 | 비고 |
| --- | --- | --- | --- | --- | --- | --- |
| S-TS-TREE | Suite 트리 + TC 리스트 | F-TS | TBD-S-TS-TREE | 페이지 | `/projects/:projectId/suites` | 좌측 트리 + 우측 TC 영역 |
| S-TS-CREATE | Suite 생성 | F-TS | TBD-S-TS-CREATE | 모달 | `?modal=create-suite&parentId=...` | parent 지정 |
| S-TS-RENAME | Suite 이름변경 | F-TS | TBD-S-TS-RENAME | 모달 | `?modal=rename-suite&id=...` | |
| S-TS-MOVE | Suite 이동 (드래그 외 수동) | F-TS | TBD-S-TS-MOVE | 모달 | `?modal=move-suite&id=...` | 순환 방지 검증 |
| S-TS-DELETE-CONFIRM | Suite 삭제 확인 (작성자 ★16) | F-TS | TBD-S-TS-DELETE-CONFIRM | 모달 | `?modal=delete-suite&id=...` | 빈 Suite만 |

### 2.8 TestCase (F-TC, Scope 3종)

> Scope별 진입 경로 분리. Project Scope 기본 + WS Scope + Global Scope.

| 화면 ID | 화면명 | 소속 feature | Figma 노드 URL | 표현 패턴 | 라우트 경로 | 비고 |
| --- | --- | --- | --- | --- | --- | --- |
| S-TC-LIST-PROJ | TC 목록 (Project Scope) | F-TC | TBD-S-TC-LIST-PROJ | 페이지 | `/projects/:projectId/test-cases` | `?scope=PROJECT\|WORKSPACE\|GLOBAL\|ALL` 합본 |
| S-TC-LIST-WS | TC 라이브러리 (WS Scope) | F-TC | TBD-S-TC-LIST-WS | 페이지 | `/workspaces/:workspaceId/test-cases` | WS + Global 합본 |
| S-TC-LIST-GLOBAL | TC 라이브러리 (Company Global) | F-TC | TBD-S-TC-LIST-GLOBAL | 페이지 | `/company/test-cases` | Global Scope만 |
| S-TC-DETAIL | TC 상세 조회 | F-TC | TBD-S-TC-DETAIL | 모달 | `?modal=tc-detail&id=...` | TC + steps + tags |
| S-TC-CREATE | TC 생성 (Scope 분기) | F-TC | TBD-S-TC-CREATE | 모달 | `?modal=create-tc&scope=PROJECT&suiteId=...` | Scope/SuiteId 쿼리로 분기 |
| S-TC-EDIT | TC 수정 | F-TC | TBD-S-TC-EDIT | 모달 | `?modal=edit-tc&id=...` | steps 전체 교체 모델 + 변경 트리거 안내 |
| S-TC-MOVE | TC Suite 이동 (Project Scope) | F-TC | TBD-S-TC-MOVE | 모달 | `?modal=move-tc&id=...` | Project Scope만 |
| S-TC-DELETE-CONFIRM | TC 삭제 확인 (작성자 ★16) | F-TC | TBD-S-TC-DELETE-CONFIRM | 모달 | `?modal=delete-tc&id=...` | PlanItem 참조 시 `TC_IN_USE` |

### 2.9 TestPlan (F-PLAN)

| 화면 ID | 화면명 | 소속 feature | Figma 노드 URL | 표현 패턴 | 라우트 경로 | 비고 |
| --- | --- | --- | --- | --- | --- | --- |
| S-PLAN-LIST | Plan 목록 | F-PLAN | TBD-S-PLAN-LIST | 페이지 | `/projects/:projectId/plans` | 진척률·통과율 요약 |
| S-PLAN-DETAIL | Plan 상세 (PlanItem 목록) | F-PLAN | TBD-S-PLAN-DETAIL | 페이지 | `/projects/:projectId/plans/:planId` | Run 진입점 |
| S-PLAN-CREATE | Plan 생성 | F-PLAN | TBD-S-PLAN-CREATE | 모달 | `?modal=create-plan` | name·milestone·일정 |
| S-PLAN-EDIT | Plan 수정 | F-PLAN | TBD-S-PLAN-EDIT | 모달 | `?modal=edit-plan&id=...` | 상태 전이 분리 |
| S-PLAN-STATUS-CONFIRM | Plan 상태 전이 확인 (PO) | F-PLAN | TBD-S-PLAN-STATUS-CONFIRM | 모달 | `?modal=plan-status&id=...&target=...` | DRAFT→IN_PROGRESS→CLOSED 역행 금지 |
| S-PLAN-ITEM-ADD | PlanItem 추가 (TC 선택) | F-PLAN | TBD-S-PLAN-ITEM-ADD | 모달 | `?modal=add-plan-item&planId=...` | 다중 TC 선택 |
| S-PLAN-ITEM-ASSIGN | PlanItem 담당자 할당 (PO) | F-PLAN | TBD-S-PLAN-ITEM-ASSIGN | 모달 | `?modal=assign-plan-item&itemId=...` | Project 멤버만 |
| S-PLAN-ITEM-REMOVE-CONFIRM | PlanItem 제거 확인 | F-PLAN | TBD-S-PLAN-ITEM-REMOVE-CONFIRM | 모달 | `?modal=remove-plan-item&itemId=...` | Run 보유 시 거부 |
| S-PLAN-DELETE-CONFIRM | Plan 삭제 확인 (작성자 ★16) | F-PLAN | TBD-S-PLAN-DELETE-CONFIRM | 모달 | `?modal=delete-plan&id=...` | 빈 Plan만 |

### 2.10 TestRun (F-RUN, 실행 화면)

> 실행 화면은 **페이지 (좌측 PlanItem 리스트 + 우측 단계 입력)**. TC 상세 참조·인라인 수정은 **사이드바**(Drawer)로 컨텍스트 유지.

| 화면 ID | 화면명 | 소속 feature | Figma 노드 URL | 표현 패턴 | 라우트 경로 | 비고 |
| --- | --- | --- | --- | --- | --- | --- |
| S-RUN-LIST | Run 이력 목록 (Project) | F-RUN | TBD-S-RUN-LIST | 페이지 | `/projects/:projectId/runs` | 시간 역순 |
| S-RUN-EXECUTE | Run 실행 화면 (단계 입력) | F-RUN | TBD-S-RUN-EXECUTE | 페이지 | `/projects/:projectId/runs/:runId/execute` | 좌측 PlanItem + 우측 step 입력 (Rule 2 자동 종료) |
| S-RUN-DETAIL | Run 결과 상세 | F-RUN | TBD-S-RUN-DETAIL | 페이지 | `/projects/:projectId/runs/:runId` | 종료된 Run 결과·소요시간·집계 |
| S-RUN-TC-DETAIL | 실행 중 TC 상세 (사이드바) | F-RUN | TBD-S-RUN-TC-DETAIL | 사이드바 | `?drawer=run-tc&id=...` | 실행 화면 컨텍스트 유지 (락 정합) |
| S-RUN-START-CONFIRM | Run 시작 확인 | F-RUN | TBD-S-RUN-START-CONFIRM | 모달 | `?modal=start-run&itemId=...` | 환경 입력 |
| S-RUN-STEP-HISTORY | TC 변경 step 이력 | F-RUN | TBD-S-RUN-STEP-HISTORY | 사이드바 | `?drawer=run-history&id=...` | `test_run_step_history` 조회 (Rule 4·5) |
| S-RUN-DELETE-CONFIRM | Run 삭제 확인 (작성자 ★16) | F-RUN | TBD-S-RUN-DELETE-CONFIRM | 모달 | `?modal=delete-run&id=...` | |
| S-RUN-LINK-DEFECT | Fail step에서 결함 등록 진입 | F-RUN | TBD-S-RUN-LINK-DEFECT | 모달 | `?modal=create-defect&runId=...&stepId=...` | F-DEF S-DEF-CREATE와 연계 |

### 2.11 Defect (F-DEF)

| 화면 ID | 화면명 | 소속 feature | Figma 노드 URL | 표현 패턴 | 라우트 경로 | 비고 |
| --- | --- | --- | --- | --- | --- | --- |
| S-DEF-LIST | 결함 목록 | F-DEF | TBD-S-DEF-LIST | 페이지 | `/projects/:projectId/defects` | 상태·심각도·우선순위 필터 |
| S-DEF-CREATE | 결함 등록 (독립/연결) | F-DEF | TBD-S-DEF-CREATE | 모달 | `?modal=create-defect` | testRunId 선택 시 자동 매핑 |
| S-DEF-DETAIL | 결함 상세 | F-DEF | TBD-S-DEF-DETAIL | 모달 | `?modal=defect-detail&id=...` | 첨부·연결 Run 요약 |
| S-DEF-EDIT | 결함 수정 | F-DEF | TBD-S-DEF-EDIT | 모달 | `?modal=edit-defect&id=...` | 권한 분기(PO/Member ★11) |
| S-DEF-STATUS-CONFIRM | 결함 상태 전이 확인 | F-DEF | TBD-S-DEF-STATUS-CONFIRM | 모달 | `?modal=defect-status&id=...&target=...` | DAG 4종 |
| S-DEF-ASSIGN | 담당자 지정/변경 (PO) | F-DEF | TBD-S-DEF-ASSIGN | 모달 | `?modal=assign-defect&id=...` | Project 멤버만 |
| S-DEF-DELETE-CONFIRM | 결함 삭제 확인 (작성자 ★16) | F-DEF | TBD-S-DEF-DELETE-CONFIRM | 모달 | `?modal=delete-defect&id=...` | |

### 2.12 Attachment (F-ATTACH)

> 첨부는 **부속 컴포넌트** 성격. 단독 페이지 없음, TestRun/Defect 상세 내 업로드/리스트 영역으로 결합.

| 화면 ID | 화면명 | 소속 feature | Figma 노드 URL | 표현 패턴 | 라우트 경로 | 비고 |
| --- | --- | --- | --- | --- | --- | --- |
| S-ATTACH-UPLOAD | 첨부 업로드 영역 | F-ATTACH | TBD-S-ATTACH-UPLOAD | 모달 | `?modal=upload-attachment&ownerType=...&ownerId=...` | 단일 파일, 10MB 이하 |
| S-ATTACH-LIST | 첨부 목록 (상세 내 인라인) | F-ATTACH | TBD-S-ATTACH-LIST | 페이지 | (TestRun/Defect 상세 영역 내) | 별도 라우트 없음 |
| S-ATTACH-DELETE-CONFIRM | 첨부 삭제 확인 (작성자 ★16) | F-ATTACH | TBD-S-ATTACH-DELETE-CONFIRM | 모달 | `?modal=delete-attachment&id=...` | |

### 2.13 Report (F-REPORT)

| 화면 ID | 화면명 | 소속 feature | Figma 노드 URL | 표현 패턴 | 라우트 경로 | 비고 |
| --- | --- | --- | --- | --- | --- | --- |
| S-REPORT-DASHBOARD | Project 리포트 대시보드 | F-REPORT | TBD-S-REPORT-DASHBOARD | 페이지 | `/projects/:projectId/report` | Plan별 Pass율 + 결함 상태 카운트 + totals |

### 2.14 글로벌 / 공통 (GLOBAL)

| 화면 ID | 화면명 | 소속 feature | Figma 노드 URL | 표현 패턴 | 라우트 경로 | 비고 |
| --- | --- | --- | --- | --- | --- | --- |
| S-GLOBAL-DASHBOARD | 대시보드 (Workspace 진입) | GLOBAL | TBD-S-GLOBAL-DASHBOARD | 페이지 | `/` | 인증 후 첫 진입, WS 리스트 + 리포트 요약 |
| S-GLOBAL-APP-SHELL | 앱 셸 (헤더 + 좌측 사이드 네비) | GLOBAL | TBD-S-GLOBAL-APP-SHELL | 페이지 | (모든 인증 페이지 wrapper) | 3단 셀렉터 + 사용자 메뉴 + 알림 아이콘 |
| S-GLOBAL-CONTEXT-SWITCHER | Company/WS/Project 3단 셀렉터 | GLOBAL | TBD-S-GLOBAL-CONTEXT-SWITCHER | 페이지 | (헤더 드롭다운) | SRS §3.4·§5.3 |
| S-GLOBAL-NOTIFICATION | 알림 사이드바 | GLOBAL | TBD-S-GLOBAL-NOTIFICATION | 사이드바 | `?drawer=notifications` | 헤더 알림 아이콘 → 우측 슬라이드인 (MVP placeholder, F-NOTIFY Phase 2) |
| S-GLOBAL-USER-MENU | 사용자 메뉴 (헤더 우측) | GLOBAL | TBD-S-GLOBAL-USER-MENU | 페이지 | (헤더 팝오버) | 프로필/로그아웃/CO·Master 진입 |
| S-GLOBAL-CONFIRM-DELETE | 공용 삭제 확인 다이얼로그 | GLOBAL | TBD-S-GLOBAL-CONFIRM-DELETE | 모달 | `?modal=confirm-delete&...` | 단순 결정 다이얼로그 (SRS §6.3) |
| S-GLOBAL-CONFIRM-DISCARD | 변경 손실 경고 다이얼로그 | GLOBAL | TBD-S-GLOBAL-CONFIRM-DISCARD | 모달 | (모달/사이드바 닫기 인터럽트) | 편집 모드 중 닫기 시 (락 정합) |
| S-GLOBAL-ERROR-403 | 403 권한 부족 | GLOBAL | TBD-S-GLOBAL-ERROR-403 | 페이지 | `*` | 토스트 + 상위 안전 경로 리다이렉트 |
| S-GLOBAL-ERROR-404 | 404 미존재/은닉 | GLOBAL | TBD-S-GLOBAL-ERROR-404 | 페이지 | `*` | 격리 위반 시 은닉 |
| S-GLOBAL-ERROR-500 | 500 서버 오류 | GLOBAL | TBD-S-GLOBAL-ERROR-500 | 페이지 | `*` | Error Boundary 폴백 |

---

## 3. 사이트맵 정합 (SRS §5.1 매핑)

> SRS §5.1 사이트맵 트리에 화면 ID를 1:1 매핑. 새 화면 추가 시 본 표와 SRS §5.1을 동반 갱신.

```
공개(미인증)
├─ /login                          → S-AUTH-LOGIN
├─ /signup                         → S-AUTH-SIGNUP-CO
├─ /verify-email?token=...         → S-AUTH-VERIFY-EMAIL
├─ /accept-invite?token=...        → S-AUTH-ACCEPT-INVITE
├─ /find-username                  → S-AUTH-FIND-USERNAME
├─ /forgot-password                → S-AUTH-FORGOT
└─ /reset-password?token=...       → S-AUTH-RESET
   (Master 등록 경로 임시비번 첫 로그인 → S-AUTH-FIRST-CHANGE)

Master 전용
└─ /master
   ├─ /companies                   → S-MASTER-COMPANY-LIST
   │  └─ ?modal=create-company     → S-MASTER-COMPANY-CREATE
   │  └─ ?modal=deactivate-company → S-MASTER-COMPANY-DEACTIVATE-CONFIRM
   └─ /companies/:companyId        → S-MASTER-COMPANY-DETAIL

인증 후 (Company 컨텍스트, GLOBAL S-GLOBAL-APP-SHELL wrapper)
├─ /                               → S-GLOBAL-DASHBOARD
│   └─ ?drawer=notifications       → S-GLOBAL-NOTIFICATION
├─ /workspaces                     → S-WS-LIST
│  └─ ?modal=create-ws             → S-WS-CREATE
│  └─ /workspaces/:wsId
│     ├─ /settings                 → S-WS-SETTINGS
│     │  └─ ?modal=edit-ws         → S-WS-EDIT
│     │  └─ ?modal=transfer-ws     → S-WS-TRANSFER
│     │  └─ ?modal=deactivate-ws   → S-WS-DEACTIVATE-CONFIRM
│     ├─ /members                  → S-WS-MEMBER-LIST
│     │  └─ ?modal=invite-ws-member        → S-WS-MEMBER-INVITE
│     │  └─ ?modal=remove-ws-member        → S-WS-MEMBER-REMOVE-CONFIRM
│     ├─ /projects                 → S-PROJ-LIST
│     │  └─ ?modal=create-project  → S-PROJ-CREATE
│     │  └─ /projects/:projId      → S-PROJ-DETAIL
│     │     ├─ /settings           → S-PROJ-SETTINGS
│     │     │  └─ ?modal=edit-project              → S-PROJ-EDIT
│     │     │  └─ ?modal=deactivate-project        → S-PROJ-DEACTIVATE-CONFIRM
│     │     ├─ /members            → S-PROJ-MEMBER-LIST
│     │     │  └─ ?modal=invite-project-member     → S-PROJ-MEMBER-INVITE
│     │     │  └─ ?modal=remove-project-member     → S-PROJ-MEMBER-REMOVE-CONFIRM
│     │     ├─ /suites             → S-TS-TREE
│     │     │  └─ ?modal=create-suite              → S-TS-CREATE
│     │     │  └─ ?modal=rename-suite              → S-TS-RENAME
│     │     │  └─ ?modal=move-suite                → S-TS-MOVE
│     │     │  └─ ?modal=delete-suite              → S-TS-DELETE-CONFIRM
│     │     ├─ /test-cases         → S-TC-LIST-PROJ
│     │     │  └─ ?modal=tc-detail                 → S-TC-DETAIL
│     │     │  └─ ?modal=create-tc                 → S-TC-CREATE
│     │     │  └─ ?modal=edit-tc                   → S-TC-EDIT
│     │     │  └─ ?modal=move-tc                   → S-TC-MOVE
│     │     │  └─ ?modal=delete-tc                 → S-TC-DELETE-CONFIRM
│     │     ├─ /plans              → S-PLAN-LIST
│     │     │  └─ ?modal=create-plan               → S-PLAN-CREATE
│     │     │  └─ /plans/:planId   → S-PLAN-DETAIL
│     │     │     ├─ ?modal=edit-plan              → S-PLAN-EDIT
│     │     │     ├─ ?modal=plan-status            → S-PLAN-STATUS-CONFIRM
│     │     │     ├─ ?modal=add-plan-item          → S-PLAN-ITEM-ADD
│     │     │     ├─ ?modal=assign-plan-item       → S-PLAN-ITEM-ASSIGN
│     │     │     ├─ ?modal=remove-plan-item       → S-PLAN-ITEM-REMOVE-CONFIRM
│     │     │     └─ ?modal=delete-plan            → S-PLAN-DELETE-CONFIRM
│     │     ├─ /runs               → S-RUN-LIST
│     │     │  ├─ ?modal=start-run                 → S-RUN-START-CONFIRM
│     │     │  └─ /runs/:runId/execute             → S-RUN-EXECUTE
│     │     │     ├─ ?drawer=run-tc                → S-RUN-TC-DETAIL
│     │     │     ├─ ?drawer=run-history           → S-RUN-STEP-HISTORY
│     │     │     ├─ ?modal=delete-run             → S-RUN-DELETE-CONFIRM
│     │     │     └─ ?modal=create-defect          → S-RUN-LINK-DEFECT (→ S-DEF-CREATE 진입)
│     │     │  └─ /runs/:runId     → S-RUN-DETAIL
│     │     ├─ /defects            → S-DEF-LIST
│     │     │  └─ ?modal=create-defect             → S-DEF-CREATE
│     │     │  └─ ?modal=defect-detail             → S-DEF-DETAIL
│     │     │  └─ ?modal=edit-defect               → S-DEF-EDIT
│     │     │  └─ ?modal=defect-status             → S-DEF-STATUS-CONFIRM
│     │     │  └─ ?modal=assign-defect             → S-DEF-ASSIGN
│     │     │  └─ ?modal=delete-defect             → S-DEF-DELETE-CONFIRM
│     │     └─ /report             → S-REPORT-DASHBOARD
│     └─ /workspaces/:wsId/test-cases               → S-TC-LIST-WS
├─ /company
│  ├─ /users                       → S-USER-LIST
│  │  └─ ?drawer=user              → S-USER-DETAIL
│  │  │  └─ &tab=matrix            → S-USER-MATRIX
│  │  └─ ?modal=invite             → S-USER-INVITE
│  │  └─ ?modal=reset-pw           → S-USER-RESET-PW-CONFIRM
│  │  └─ ?modal=deactivate-user    → S-USER-DEACTIVATE-CONFIRM
│  │  └─ ?modal=withdraw-user      → S-USER-WITHDRAW-CONFIRM
│  ├─ /test-cases                  → S-TC-LIST-GLOBAL
│  └─ /settings                    → S-COMPANY-SETTINGS
│     └─ ?modal=transfer-owner     → S-COMPANY-TRANSFER-OWNER
│     └─ ?modal=grant-co           → S-COMPANY-GRANT-CO-CONFIRM
└─ /me                             → S-USER-PROFILE-ME
   └─ ?modal=change-password       → S-USER-CHANGE-PW
```

> 모든 인증 페이지는 `S-GLOBAL-APP-SHELL` 래퍼 아래. `S-GLOBAL-NOTIFICATION` / `S-GLOBAL-USER-MENU` / `S-GLOBAL-CONTEXT-SWITCHER`는 헤더 영역으로 전 페이지 공통.
> 에러 페이지 (`S-GLOBAL-ERROR-403/404/500`)는 라우트 매칭 실패·권한 실패·런타임 예외 시 폴백.

---

## 4. 화면 ↔ 기능 매핑 (SRS §5.2 정합)

SRS §5.2 화면 ↔ 기능 매핑을 화면 ID 기반으로 재정렬한다.

| SRS §5.2 화면 | 화면 ID | 주요 기능 | 접근 Role |
| --- | --- | --- | --- |
| /login, /signup, /verify-email, /accept-invite, /find-username, /forgot-password, /reset-password | S-AUTH-* (8개) | F-AUTH | 미인증 |
| /master/companies (+ 상세·생성) | S-MASTER-COMPANY-* (4개) | F-COMPANY | Master |
| / (대시보드) | S-GLOBAL-DASHBOARD | F-WS(요약) + F-REPORT(요약) | 인증 모든 Role |
| /workspaces | S-WS-LIST, S-WS-CREATE | F-WS | CO(목록), WO(생성) |
| /workspaces/:id/members | S-WS-MEMBER-* | F-USER (WS 멤버 초대) | WO |
| /workspaces/:id/projects | S-PROJ-LIST, S-PROJ-CREATE | F-PROJ | WO·PO·Member(생성), 그 외(목록) |
| /projects/:id/suites | S-TS-* | F-TS | PO/Member(편집), Viewer(read) |
| /projects/:id/test-cases | S-TC-LIST-PROJ, S-TC-DETAIL/CREATE/EDIT/MOVE/DELETE-CONFIRM | F-TC | PO/Member(편집), Viewer(read) |
| /workspaces/:id/test-cases | S-TC-LIST-WS | F-TC (WS Scope) | WS 멤버 |
| /company/test-cases | S-TC-LIST-GLOBAL | F-TC (Global Scope) | Company 모든 사용자 (★18) |
| /projects/:id/plans | S-PLAN-* | F-PLAN | PO(생성·할당), Member(생성), Viewer(read) |
| /projects/:id/runs/:runId | S-RUN-EXECUTE, S-RUN-DETAIL, S-RUN-TC-DETAIL, S-RUN-STEP-HISTORY | F-RUN, F-ATTACH | PO/Member(기록), Viewer(read) |
| /projects/:id/defects | S-DEF-* | F-DEF, F-ATTACH | PO/Member(등록·수정), Viewer(read) |
| /projects/:id/report | S-REPORT-DASHBOARD | F-REPORT | 인증 모든 Role |
| /projects/:id/members | S-PROJ-MEMBER-* | F-USER (Project 멤버 Role) | PO |
| /company/users | S-USER-LIST, S-USER-DETAIL, S-USER-MATRIX, S-USER-INVITE 등 | F-USER (Company 사용자 + Scope×Role 매트릭스) | CO |
| /company/settings | S-COMPANY-SETTINGS, S-COMPANY-TRANSFER-OWNER, S-COMPANY-GRANT-CO-CONFIRM | F-COMPANY | CO |
| /me | S-USER-PROFILE-ME, S-USER-CHANGE-PW | F-USER (본인 프로필·비번) | 인증된 모든 Role |
| (헤더 알림) | S-GLOBAL-NOTIFICATION | (F-NOTIFY Phase 2 placeholder) | 인증 모든 Role |

---

## 5. Feature × 화면 커버리지

| Feature ID | Feature 명 | 등록 화면 수 | 화면 ID 목록 |
| --- | --- | --- | --- |
| F-COMPANY | 회사 관리 | 7 | S-MASTER-COMPANY-LIST, S-MASTER-COMPANY-DETAIL, S-MASTER-COMPANY-CREATE, S-MASTER-COMPANY-DEACTIVATE-CONFIRM, S-COMPANY-SETTINGS, S-COMPANY-TRANSFER-OWNER, S-COMPANY-GRANT-CO-CONFIRM |
| F-WS | 워크스페이스 관리 | 9 | S-WS-LIST, S-WS-CREATE, S-WS-SETTINGS, S-WS-EDIT, S-WS-TRANSFER, S-WS-DEACTIVATE-CONFIRM, S-WS-MEMBER-LIST, S-WS-MEMBER-INVITE, S-WS-MEMBER-REMOVE-CONFIRM |
| F-AUTH | 인증 | 8 | S-AUTH-LOGIN, S-AUTH-SIGNUP-CO, S-AUTH-VERIFY-EMAIL, S-AUTH-ACCEPT-INVITE, S-AUTH-FIND-USERNAME, S-AUTH-FORGOT, S-AUTH-RESET, S-AUTH-FIRST-CHANGE |
| F-USER | 사용자 + Role 매트릭스 | 10 | S-USER-LIST, S-USER-DETAIL, S-USER-MATRIX, S-USER-INVITE, S-USER-INVITE-RESEND, S-USER-RESET-PW-CONFIRM, S-USER-DEACTIVATE-CONFIRM, S-USER-WITHDRAW-CONFIRM, S-USER-PROFILE-ME, S-USER-CHANGE-PW |
| F-PROJ | 프로젝트 관리 | 9 | S-PROJ-LIST, S-PROJ-CREATE, S-PROJ-DETAIL, S-PROJ-SETTINGS, S-PROJ-EDIT, S-PROJ-DEACTIVATE-CONFIRM, S-PROJ-MEMBER-LIST, S-PROJ-MEMBER-INVITE, S-PROJ-MEMBER-REMOVE-CONFIRM |
| F-TS | 테스트 스위트 | 5 | S-TS-TREE, S-TS-CREATE, S-TS-RENAME, S-TS-MOVE, S-TS-DELETE-CONFIRM |
| F-TC | 테스트 케이스 (Scope 3종) | 8 | S-TC-LIST-PROJ, S-TC-LIST-WS, S-TC-LIST-GLOBAL, S-TC-DETAIL, S-TC-CREATE, S-TC-EDIT, S-TC-MOVE, S-TC-DELETE-CONFIRM |
| F-PLAN | 테스트 계획 | 9 | S-PLAN-LIST, S-PLAN-DETAIL, S-PLAN-CREATE, S-PLAN-EDIT, S-PLAN-STATUS-CONFIRM, S-PLAN-ITEM-ADD, S-PLAN-ITEM-ASSIGN, S-PLAN-ITEM-REMOVE-CONFIRM, S-PLAN-DELETE-CONFIRM |
| F-RUN | 테스트 실행 | 8 | S-RUN-LIST, S-RUN-EXECUTE, S-RUN-DETAIL, S-RUN-TC-DETAIL, S-RUN-START-CONFIRM, S-RUN-STEP-HISTORY, S-RUN-DELETE-CONFIRM, S-RUN-LINK-DEFECT |
| F-DEF | 결함 관리 | 7 | S-DEF-LIST, S-DEF-CREATE, S-DEF-DETAIL, S-DEF-EDIT, S-DEF-STATUS-CONFIRM, S-DEF-ASSIGN, S-DEF-DELETE-CONFIRM |
| F-ATTACH | 첨부 | 3 | S-ATTACH-UPLOAD, S-ATTACH-LIST, S-ATTACH-DELETE-CONFIRM |
| F-REPORT | 리포트 | 1 | S-REPORT-DASHBOARD |
| GLOBAL | 공용/글로벌 | 10 | S-GLOBAL-DASHBOARD, S-GLOBAL-APP-SHELL, S-GLOBAL-CONTEXT-SWITCHER, S-GLOBAL-NOTIFICATION, S-GLOBAL-USER-MENU, S-GLOBAL-CONFIRM-DELETE, S-GLOBAL-CONFIRM-DISCARD, S-GLOBAL-ERROR-403, S-GLOBAL-ERROR-404, S-GLOBAL-ERROR-500 |
| **합계** | **12 MVP feature + GLOBAL** | **94** | |

> 12 MVP feature 모두 1개 이상 화면 등록 확인 — **검증 통과**.

---

## 6. 표현 패턴별 화면 수 통계

| 표현 패턴 | 화면 수 | 비율 |
| --- | --- | --- |
| 새 화면 | 8 | 8.5% |
| 페이지 | 25 | 26.6% |
| 모달 | 56 | 59.6% |
| 사이드바 | 5 | 5.3% |
| **합계** | **94** | **100%** |

> **사이드바 5개**: S-USER-DETAIL, S-USER-MATRIX (회원관리), S-RUN-TC-DETAIL, S-RUN-STEP-HISTORY (테스트 실행), S-GLOBAL-NOTIFICATION (알림) — 락 정합 (frontend-standard §8).
> **새 화면 8개**: 모두 F-AUTH 인증 흐름 (미인증 컨텍스트). `S-AUTH-FIRST-CHANGE`는 인증 직후이지만 모달 진입 전 강제 변경 게이트로 새 화면 유지.
> **모달 56개**: 일반 CRUD + 확인 다이얼로그 (`*-CONFIRM`). SRS §6.3 확인 다이얼로그(삭제·비활성화·리셋·실행 종료·소유자 이관)가 ~20개 차지.

---

## 7. 컴포넌트 매핑 (수요 기반, 화면 → 공통 컴포넌트)

> `frontend-coding-standard.md` 컴포넌트 카탈로그(오버레이/폼/데이터 표시/레이아웃/도메인 공통) 기반. 화면 구현 시 본 매핑을 1차 참조.
>
> **컴포넌트 State / 메시지 정본 정합 (락 v2.4)**:
> - **State 변형** (Default/Hover/Focus/Error/Success/Disabled): 디자이너 정본 `docs/design/00_design_system_v3.md` §5 (Input·Select·Button·Checkbox States × 컬러 표). 본 §7 표에는 base 컴포넌트 1행만, State 별 row 분할 X.
> - **Figma node-id 추적 (State 별)**: 복잡 컴포넌트(TextInput·Select·DataTable·Modal·Drawer·ConfirmDialog 등)는 별도 컴포넌트 명세 파일 `docs/design/components/<comp>.md` 신설하여 State 매트릭스 정리. 본 §7에 링크.
> - **메시지 정본** (폼 유효성·성공·에러 raw 문구): 디자이너 §6 — i18n 키 정본 (`validation.<field>.<rule>` / `success.<field>.<rule>`). 본 표·컴포넌트 명세·코드는 i18n 키만 참조 (frontend-coding-standard §12.7 정합). raw 문구 하드코딩 금지.
> - **BE ErrorCode 매핑**: `backend-coding-standard §5.2` ErrorCode → i18n 키 매핑은 [`docs/integration/error-code-mapping.md`](../integration/error-code-mapping.md) 정본 (§2~§5). `confirm.*` / `error.*` / Toast `success.*` raw 문구도 동일 문서 §6~§8 정본.
> - **API 계약 정본**: [`docs/integration/openapi.yaml`](../integration/openapi.yaml) (OpenAPI 3.0.3). FE mock·계약 테스트의 단일 소스.

### 7.1 오버레이

| 화면 ID 패턴 | 공통 컴포넌트 |
| --- | --- |
| `*-MODAL`, `?modal=...` (모든 모달 56개) | `BaseModal` + `useModal` — State 매트릭스: [`components/modal.md`](./components/modal.md) |
| `?drawer=user`, `?drawer=run-tc`, `?drawer=run-history`, `?drawer=notifications` (사이드바 5개) | `BaseDrawer` + `useDrawer` — State 매트릭스: [`components/drawer.md`](./components/drawer.md) |
| `*-CONFIRM`, S-GLOBAL-CONFIRM-DELETE, S-GLOBAL-CONFIRM-DISCARD | `ConfirmDialog` + `useConfirm` — State 매트릭스: [`components/confirm-dialog.md`](./components/confirm-dialog.md) |
| 성공·실패 토스트 (전역) | `Toast` + `useToast` — State 매트릭스: [`components/toast.md`](./components/toast.md) |
| 헤더 사용자 메뉴, 더보기 `[⋯]` | `Popover` / `ContextMenu` — State 매트릭스: [`components/popover.md`](./components/popover.md) |
| 폼 필드 도움말 | `Tooltip` — State 매트릭스: [`components/tooltip.md`](./components/tooltip.md) |

### 7.2 폼

| 화면 ID 패턴 | 공통 컴포넌트 |
| --- | --- |
| 모든 모달의 입력 필드 | `FormField` + `FormGroup` + `useForm` |
| 텍스트 입력 (이름·설명·title 등) | `TextInput`, `Textarea` — State 매트릭스: [`components/text-input.md`](./components/text-input.md) |
| 드롭다운 (status·role·priority) | `Select` — State 매트릭스: [`components/select.md`](./components/select.md) |
| 멤버/TC 검색 (다중 선택) | `Combobox`, `SearchBox` — [`components/select.md`](./components/select.md) §4–§6 |
| 체크박스 (Role 매트릭스, 회원 목록 선택) | `Checkbox` — State 매트릭스: [`components/checkbox.md`](./components/checkbox.md) |
| 라디오 (Run step 결과, Role 매트릭스 Project Role) | `Radio` — State 매트릭스: [`components/radio.md`](./components/radio.md) |
| 활성/비활성 토글 | `Switch` — State 매트릭스: [`components/switch.md`](./components/switch.md) |
| Plan 일정 입력 | `DatePicker` — State 매트릭스: [`components/date-picker.md`](./components/date-picker.md) |
| 첨부 업로드 (S-ATTACH-UPLOAD) | `FileUpload` — State 매트릭스: [`components/file-upload.md`](./components/file-upload.md) |
| 액션 버튼 (CTA·확인·취소) | `Button`, `IconButton` — State 매트릭스: [`components/button.md`](./components/button.md) |

### 7.3 데이터 표시

| 화면 ID 패턴 | 공통 컴포넌트 |
| --- | --- |
| 모든 `*-LIST` 화면 (25개+) | `DataTable` + `Pagination` + `useTable` + `usePagination` — State 매트릭스: [`components/data-table.md`](./components/data-table.md) |
| 사이드바 탭 (S-USER-DETAIL ↔ S-USER-MATRIX) | `Tabs` — State 매트릭스: [`components/tabs.md`](./components/tabs.md) |
| 상태 표시 (DefectStatus·PlanStatus·RunStatus·Role) | `StatusBadge`, `RoleBadge`, `PriorityBadge` — State 매트릭스: [`components/badge.md`](./components/badge.md) |
| 태그 (TC, 분류) | `Tag` — [`components/badge.md`](./components/badge.md) §6 |
| 사용자 표시 (담당자·생성자) | `UserAvatar`, `Avatar` — State 매트릭스: [`components/avatar.md`](./components/avatar.md) |
| 리포트 카드 (Pass율·결함 카운트) | `Card` |
| 빈 상태 (목록 0건, 멤버 0건 등) | `EmptyState` — State 매트릭스: [`components/empty-state.md`](./components/empty-state.md) |
| 로딩 (사이드바·테이블) | `Skeleton`, `Spinner` — State 매트릭스: [`components/skeleton.md`](./components/skeleton.md) |
| Run 진척률 | `ProgressBar` — [`components/skeleton.md`](./components/skeleton.md) §3 |
| Plan 상태 전이 진행 표시 | `Stepper` (선택) |
| 컨텍스트 네비게이션 (Company > WS > Project > 영역) | `Breadcrumb` |

### 7.4 레이아웃

| 화면 ID 패턴 | 공통 컴포넌트 |
| --- | --- |
| S-GLOBAL-APP-SHELL | `SidebarLayout` (좌측 네비 + 본문) |
| 전 페이지 헤더 (`*-LIST` / `*-CREATE` / `*-DETAIL` / `*-SETTINGS` / `*-DASHBOARD`) | `PageHeader` — 2026-06-09 amend: 전 페이지로 확대 (이전 `*-DETAIL`/`*-SETTINGS` 한정 → 일관성 강화). `size-sm`(compact LIST/CREATE) / `is-settings`(SETTINGS sub-page) variant 지원. 프로토타입 CSS: `_shell/components/page-header.css` |
| S-TS-TREE (좌측 트리 + 우측 TC) / S-RUN-EXECUTE (좌측 PlanItem + 우측 step) | `SplitPane` |
| 그리드형 리포트 위젯 | `Grid` |
| 폼 내부 수직 정렬 | `Stack` |
| 섹션 그룹화 (사이드바 프로필 / 매트릭스) | `Section` |

### 7.5 도메인 공통

| 화면 ID 패턴 | 도메인 공통 컴포넌트 |
| --- | --- |
| S-USER-MATRIX, _ux-role-matrix.md | `PermissionMatrix` |
| Defect/Run 첨부 영역 | `AttachmentList` (+ `FileUpload`) |
| F-COMMON Phase 2 도입 시 댓글 | `CommentThread` (Phase 2) |

### 7.6 공통 훅

| 화면 ID 패턴 | 공통 훅 |
| --- | --- |
| 모달/사이드바 상태 + URL 동기화 (`?modal=...`/`?drawer=...`) | `useUrlQueryState`, `useModal`, `useDrawer` |
| 권한 가드 (메뉴/버튼 숨김) | `usePermission` |
| 검색·필터 디바운스 | `useDebounce` |
| 폼 제출/검증 | `useForm` |
| 확인 다이얼로그 | `useConfirm` |
| 토스트 알림 | `useToast` |

> **수요 기반 구현 원칙** (frontend-standard §2 카탈로그): 사전 일괄 구현 X. 화면 수요 시점에 Rule of Three(3회 + 80% 유사) 또는 UI 프리미티브 우선 원칙으로 추출.

---

## 8. UI 표현 패턴 락 (참조 매트릭스)

> SRS §6.3.1 + frontend-standard §8 동일 락. 본 표는 매핑 시 패턴 분류 기준으로만 사용.

| 액션 | 표현 방식 | 적용 기능 (예) | 정합 화면 ID 예 |
| --- | --- | --- | --- |
| 일반 CRUD (생성·상세·수정·삭제 확인) | **모달 팝업** | F-COMPANY/WS/PROJ/PLAN/TC/DEF/ATTACH | S-PROJ-CREATE, S-TC-DETAIL, S-DEF-EDIT, S-WS-DEACTIVATE-CONFIRM |
| 테스트 실행 화면의 TC 상세·수정 / TC 변경 이력 | **사이드바(Drawer, 우측 슬라이드인)** | F-RUN | S-RUN-TC-DETAIL, S-RUN-STEP-HISTORY |
| 회원가입 / 아이디 찾기 / 비밀번호 찾기·재설정 / 초대 수락 / 이메일 인증 / 임시비번 강제 변경 | **새 화면(전체 페이지 라우팅)** | F-AUTH | S-AUTH-LOGIN, S-AUTH-SIGNUP-CO, S-AUTH-FIND-USERNAME, S-AUTH-FORGOT, S-AUTH-RESET, S-AUTH-ACCEPT-INVITE, S-AUTH-VERIFY-EMAIL, S-AUTH-FIRST-CHANGE |
| 회원관리(CO) — 회원 상세·수정·권한 매트릭스 | **사이드바(Drawer)** | F-USER | S-USER-DETAIL, S-USER-MATRIX (사이드바 내부 탭 전환) |
| 알림(알람) 내역 조회 | **사이드바(Drawer)** | GLOBAL (Phase 2 F-NOTIFY 도입 전 placeholder) | S-GLOBAL-NOTIFICATION |

### 8.1 충돌 검증 (락 위반 0건)

| 화면 ID | 표현 패턴 | 락 정합 여부 |
| --- | --- | --- |
| 모든 `S-AUTH-*` (8개) | 새 화면 | ✓ 정합 (미인증 컨텍스트, 모달 불가) |
| 모든 `S-USER-DETAIL`·`S-USER-MATRIX` | 사이드바 | ✓ 정합 (`_ux-user-detail.md` §3, `_ux-role-matrix.md` §1) |
| `S-RUN-TC-DETAIL`·`S-RUN-STEP-HISTORY` | 사이드바 | ✓ 정합 (실행 화면 컨텍스트 유지) |
| `S-GLOBAL-NOTIFICATION` | 사이드바 | ✓ 정합 (헤더 알림 아이콘) |
| 모든 `S-*-CREATE`·`S-*-EDIT`·`S-*-CONFIRM` (모달 56개) | 모달 | ✓ 정합 (일반 CRUD + 확인 다이얼로그) |
| `S-RUN-EXECUTE` (실행 화면) | 페이지 | ✓ 정합 (좌측 PlanItem + 우측 step, 새 화면 X / 모달 X) |
| `S-PROJ-DETAIL` 등 도메인 페이지 | 페이지 | ✓ 정합 (인증 후 메인 페이지) |

> **모달·사이드바 동시 열림 금지** 룰(락): 본 매핑 표에서 동일 라우트 내 `?modal=...`과 `?drawer=...`가 동시에 활성화되는 화면 ID 조합은 **없음**. 새 모달 열림 시 기존 사이드바 닫힘 처리는 `useModal`/`useDrawer` 훅 구현에서 강제.

---

## 9. 변경 절차

### 9.1 Figma frame 추가/변경 시

1. Figma에서 frame 작성/이름 확정 → `node-id` 확인.
2. 본 문서 표의 `Figma 노드 URL` 컬럼을 `TBD-<화면ID>` → 실제 URL로 치환하는 PR 작성.
3. 동일 PR에서 해당 기능 명세 `§1 메타` 표의 **Figma** 행도 갱신 (불일치 머지 금지).
4. 디자인-명세 충돌 시 SRS §5.0 우선순위 적용 (권한·격리·에러·AC = 명세 우선 / 시각·인터랙션·레이아웃 = Figma 우선).

### 9.2 새 화면 추가 시

1. **PM 승인** 후 해당 feature 명세에 화면 흐름 추가.
2. 본 문서 표에 신규 행 추가 — 화면 ID(`S-<도메인>-<액션>`) + 표현 패턴 + 라우트 + Figma 노드 URL.
3. SRS §5.1 사이트맵 + §5.2 화면 ↔ 기능 매핑 동반 갱신.
4. §5 Feature × 화면 커버리지 표 + §6 표현 패턴별 통계 재계산.

### 9.3 표현 패턴 변경 시

1. `frontend-coding-standard.md` §8 + `srs.md` §6.3.1 락 갱신 PR을 먼저 제출 (PM·Frontend·Backend 합의 필요).
2. 본 문서의 §8 충돌 검증 매트릭스 + 해당 화면 ID 행을 동일 PR에 동반 갱신.

### 9.4 화면 삭제 시

1. 본 문서에서 해당 행 제거.
2. 관련 기능 명세 §5 흐름·§9 AC에서 해당 화면 참조 제거.
3. SRS §5.1·§5.2 동반 갱신.

---

## 10. 검증 체크리스트 (P1 산출물 요구사항 정합)

| 검증 항목 | 결과 | 근거 |
| --- | --- | --- |
| 12 feature 모두 1개 이상 화면 등록 | **PASS** | §5 Feature × 화면 커버리지 — F-COMPANY 7, F-WS 9, F-AUTH 8, F-USER 10, F-PROJ 9, F-TS 5, F-TC 8, F-PLAN 9, F-RUN 8, F-DEF 7, F-ATTACH 3, F-REPORT 1 (12개 feature 합 84 + GLOBAL 10 = 94) |
| 표현 패턴 락 위반 0건 | **PASS** | §8.1 충돌 검증 매트릭스 — 모든 화면이 락 정합. 새 화면=인증 8개, 사이드바=회원관리 2 + 실행 화면 2 + 알림 1 = 5개. 모달·페이지 분류 정합. |
| SRS §5.2 화면 ↔ 기능 매핑과 정합 | **PASS** | §4 화면 ↔ 기능 매핑 — SRS §5.2 표를 화면 ID 기반으로 1:1 재정렬. 누락 없음. |
| 모든 Figma 노드 URL TBD 시 명시적 placeholder | **PASS (조건부)** | TBD 화면 91건 — 모두 `TBD-S-<도메인>-<액션>` 형식 placeholder. 실제 URL 채워야 할 수 = **91건**. (현재 매핑 완료 2건: S-USER-LIST=`282-14722`, S-WS-LIST=`342-13892`) |

### 10.1 추가 도메인 락 정합 (README v2.3 + frontend-standard 락)

| 락 항목 | 정합 화면 ID | 검증 |
| --- | --- | --- |
| 회원가입 2경로 + 인증 6개 새 화면 | S-AUTH-SIGNUP-CO, S-AUTH-FIND-USERNAME, S-AUTH-FORGOT, S-AUTH-RESET, S-AUTH-ACCEPT-INVITE, S-AUTH-VERIFY-EMAIL (+ S-AUTH-LOGIN, S-AUTH-FIRST-CHANGE) | 새 화면 8개 모두 인증 흐름 정합 |
| 회원관리 사이드바 + Role 매트릭스 탭 | S-USER-DETAIL (사이드바) + S-USER-MATRIX (사이드바 내부 탭 전환) | `_ux-user-detail.md` §3 + `_ux-role-matrix.md` §1 정합 |
| TestRun 실행 화면 컨텍스트 유지 + TC 상세 사이드바 | S-RUN-EXECUTE (페이지) + S-RUN-TC-DETAIL (사이드바) | 좌측 PlanItem + 우측 step + 사이드바 TC 상세 |
| 알림 사이드바 (헤더 알림 아이콘) | S-GLOBAL-NOTIFICATION (사이드바) | MVP placeholder, F-NOTIFY Phase 2 |
| 모달·사이드바 동시 열림 금지 | §8 충돌 검증 매트릭스 | 라우트 내 `?modal=...`과 `?drawer=...` 동시 활성 화면 없음 |

---

## 11. 운영 메모

1. **node-id 추가/변경은 본 문서 PR과 함께** — 기능 명세 `§1 메타` 표의 `Figma` 행도 동일 PR에서 갱신.
2. **MCP 사용**: Figma MCP `mcp__figma__get_design_context` / `mcp__figma__get_screenshot` 호출 시 본 표의 Figma 노드 URL을 입력으로 사용.
3. **화면 생성 워크플로 (필수)**: 본 표의 Figma 노드 URL로 화면을 그릴 때(HTML/React 프로토타입 포함)는 반드시 `mcp__figma__get_screenshot`으로 실제 프레임을 먼저 확인한 뒤 작업한다 (디자인 임의 추측 금지). 인증 후 페이지는 §0.1 공통 Shell + 콘텐츠 노드 **합성 (§0.2)** 절차를 따른다.
4. **URL 동기화 규칙**: 딥링크/공유/새로고침 복원이 필요한 모달·사이드바만 URL 쿼리 동기화. 일회성 확인 다이얼로그 일부는 로컬 state로 충분 — 본 표의 `?modal=...`/`?drawer=...` 표기는 권장 규칙이며 구현 시 `frontend-standard.md` §2.4 모달/드로어 URL 동기화 원칙 적용.
5. **다음 갱신 후보**:
   - 디자이너 배정 시 §0 소유자 갱신 + 91건 TBD 노드 URL 채움.
   - Figma 컴포넌트 라이브러리 page node-id 확정 → §0 디자인 토큰/컴포넌트 라이브러리 페이지 갱신.
   - Phase 2 F-NOTIFY 도입 시 S-GLOBAL-NOTIFICATION 구조 정식화.

---

## 부록. 변경 이력

| 버전 | 일자 | 변경 |
| --- | --- | --- |
| v0.1 | 2026-06-08 | 스켈레톤 초기화. MVP 12기능 + 부속 UX 2건 + 공용/글로벌 + 토큰/컴포넌트 + 패턴 락 참조. 기존 node-id 2건 반영 (`278-4656`, `282-14722`). 나머지 전 행 `TBD`. |
| v0.2 | 2026-06-08 | S-WS-LIST node-id 갱신 `278-4656` → **`342-13892`** (디자이너 frame 재구성: 헤더 로고를 WS 셀렉터로 통합, 사이드바 "고객센터" 그룹 추가, 데이터 더미 "R&D 개발팀"). HTML 프로토타입 `docs/design/prototypes/s-ws-list.html` 정합. |
| v0.2 | 2026-06-08 | **P1 정본 초안**. ① 화면 ID 명명 규칙 `S-<도메인>-<액션>` 확정. ② 화면 매핑 표를 도메인별 14개 섹션으로 재구조화(93개 화면 등록). ③ 표현 패턴 락 4종(`새 화면`/`페이지`/`모달`/`사이드바`) 분류 + §8 충돌 검증 매트릭스. ④ SRS §5.1 사이트맵 트리 화면 ID 매핑. ⑤ SRS §5.2 화면 ↔ 기능 매핑 정합. ⑥ Feature × 화면 커버리지 표(12 feature + GLOBAL 모두 1개 이상). ⑦ 표현 패턴별 통계(새 화면 7 / 페이지 25 / 모달 56 / 사이드바 5). ⑧ 화면 → 공통 컴포넌트 매핑(frontend-standard §2 카탈로그 기반). ⑨ §10 검증 체크리스트 4항 PASS + 도메인 락 정합 5항 PASS. ⑩ TBD 노드 URL 91건 명시. |
| v0.3 | 2026-06-09 | **S-AUTH-FIND-USERNAME (아이디 찾기) 추가**. Figma node `295-7469` (요청) + `298-7851` (결과 state). 라우트 `/find-username`. F-AUTH 7→8, 총 화면 93→94. §2.1 헤더 / §3 트리 / §4 SRS 정합 / §5 합계 / §6 통계 / §8 패턴 락 / §8.1 충돌 검증 / §10 체크리스트 / §10.1 도메인 락 동기화. 디자인 시스템 §4 인증 페이지 타이틀·서브타이틀 정본 정합. ⚠️ SRS §5.2 / `features/03-authentication.md` / `integration/openapi.yaml` 에는 아이디 찾기 요구·라우트·엔드포인트 미반영 — 후속 동기화 필요. |
| v0.4 | 2026-06-09 | **아이디·비밀번호 찾기 프로토타입 추가 + S-AUTH-FORGOT 노드 정합**. ① `s-auth-find-username.html` 신규 (탭 UI + 결과 인플레이스 마스킹). ② `s-auth-forgot-password.html` 재작성 (탭 UI + 아이디·이메일 2-field + 본인인증 CTA, AC-17 존재 은닉 모달 유지). ③ S-AUTH-FORGOT Figma node `342-12997` → `285-9766` (Find-PW 1 정합). 비고에 입력 필드 구성·결과 모달 노드 명시. |
