# TMS 기능 정의서 (Functional Specifications)

TMS(Test Management System) 사이트의 **기능을 하나씩 정의·정리**하는 제품 사양 문서 모음입니다.
기능 정의서는 "무엇을/왜"(제품 관점)를 다루며, 구현 세부("어떻게")는 `docs/standards`의 backend/frontend/dba 정의서에 위임합니다.

- 작성 주체: **기능 기획자(Feature Planner) 에이전트** (`.claude/feature-planner/CLAUDE.md`)
- 시스템 전역 요구사항(NFR·ERD·IA·공통패턴): [`../srs.md`](../srs.md) — **기능 명세 횡단 규칙 정본**
- 용어 정본: [`../glossary.md`](../glossary.md) — 모든 기능 서술은 glossary 용어 사용
- 표준 정합: [`../standards/development-standard.md`](../standards/development-standard.md), backend(에러 코드·GET/POST·인증), test(수용 기준→테스트)
- 한 기능 = 한 파일, 템플릿: [`_template.md`](_template.md)
- 합본 스냅샷: [`../all-specs.md`](../all-specs.md) — 재생성 `./scripts/gen-all-specs.sh` (수동 편집 금지, pre-commit hook이 자동 갱신)

---

## 🎯 MVP 스코프 v2 (PM 락 2026-06-05 · 본문 락 2026-06-08)

- **대상**: 온프레미스 배포 + 멀티 Company 멀티테넌트 데이터 격리. 사내 1팀 데모 + 향후 다 고객사 확장 대비 (고객사별 온프레미스 인스턴스)
- **가치**: 엑셀 TC 관리 대체 + 경량 결함 트래킹 + 조직·권한 분리
- **시한**: 2026-07-31 데모 목표 (풀 스코프 추정 11~12주, 1~2주 이월 가능성 ⚠️)
- **인력**: BE 1, FE 1
- **목적**: 데모 시연 → Phase 2 운영 확장

### 3-tier 조직 격리 (정본)

```
Company (고객사, Master 관리)
  └─ Workspace (WO 관리, Company 내부 격리 단위)
       └─ Project (PO 관리, 테스트 자산 단위)
            └─ TestSuite / TestCase / TestPlan / TestRun / Defect / Attachment
```

- 데이터 격리키: `company_id`, `workspace_id`, `project_id` (테이블별 적용 범위는 dba-standard·SRS §4 참조)

### Role 6단 (정본)

| Role | Scope | 핵심 권한 |
|---|---|---|
| Master | 시스템 전역 | Company 생성·비활성, 전역 조회 |
| CO (Company Owner) | Company 1 | 사용자 초대·탈퇴·비번리셋·전체조회, WS 조회·비활성·소유자 이관, 사용자 Role 승격 (Company당 N명 가능) |
| WO (Workspace Owner) | Workspace N | WS 생성(무제한), CO가 Company 등록한 사용자를 WS에 초대, **본인 소유/멤버 WS 내 Project 생성·정보 수정·비활성** (컨테이너 한정, 내부 자산·멤버 초대는 별도 Role 필요 — permissions ★15) |
| PO (Project Owner) | Project N | 프로젝트 멤버 초대, Project·TC·TestRun CRUD |
| Member | Project N | Project·TC·TestRun 생성 (직접 생성해도 Member 유지) |
| Viewer | Project N | read-only (CO/PO가 Project 초대 시 기본 Role) |

> Role 부여 모델 = **(User × Scope) 다중 부여**. 한 사용자가 여러 WS/Project에서 서로 다른 Role 보유 가능.

### 회원가입 2경로 (정본)

| 경로 | 흐름 | 결과 |
|---|---|---|
| A. Master 등록 | Master가 Company + CO 동시 생성 → 임시비번 메일 발송 | CO 첫 로그인 시 비번 변경 강제 |
| B. CO 셀프 가입 | 가입 화면에서 이메일·비번·**회사명** 입력 → 이메일 인증 링크 클릭 | **신규 Company 자동 생성, 본인이 첫 CO** |
| C. 일반 사용자 초대 | CO/WO/PO가 이메일로 초대(1회용 토큰) → 초대 링크 → 비번 설정 → 가입 완료 | 초대 시점 Role + Scope 결정 |

> 인증 인프라: **SMTP 도입 필수**. 이메일 인증·초대 토큰·임시비번·비번리셋 모두 SMTP 의존.

## 📋 기능 백로그 v2 (Feature Backlog)

### MVP (12기능, 2026-07-31 목표)

| 순서 | ID | 기능 | 핵심 도메인(glossary) | 상태 | 문서 |
|----|----|------|------|------|------|
| 1 | F-COMPANY | 회사(Company) 관리 (Master·CO) | Company, Master | 확정 | [01-company.md](01-company.md) |
| 2 | F-WS | 워크스페이스 관리 (WO 생성·CO 비활성·소유자 이관·멤버 초대) | Workspace | 확정 | [02-workspace.md](02-workspace.md) |
| 3 | F-AUTH | 인증 (회원가입 2경로·로그인·초대 토큰·비번리셋) | User, Role | 확정 | [03-authentication.md](03-authentication.md) |
| 4 | F-USER | Company 사용자 관리 + Scope별 Role 부여 매트릭스 | User, Role, Permission | 확정 | [04-user.md](04-user.md) |
| 5 | F-PROJ | 프로젝트 관리 | Project | 확정 | [05-project.md](05-project.md) |
| 6 | F-TS | 테스트 스위트/폴더 트리 | TestSuite | 확정 | [06-test-suite.md](06-test-suite.md) |
| 7 | F-TC | 테스트 케이스 CRUD (스텝/기대결과/우선순위/태그) | TestCase, TestStep | 확정 | [07-test-case.md](07-test-case.md) |
| 8 | F-PLAN | 테스트 계획 (TC 선택·묶기·할당) | TestPlan, TestCycle | 확정 | [08-test-plan.md](08-test-plan.md) |
| 9 | F-RUN | 테스트 실행 결과 (Pass/Fail/Block/Skip) | TestRun, ExecutionResult | 확정 | [09-test-run.md](09-test-run.md) |
| 10 | F-DEF | 결함 관리 (리스트 + 상태 4종 + 담당자) | Defect, DefectStatus | 확정 | [10-defect.md](10-defect.md) |
| 11 | F-ATTACH | 첨부 (이미지 단일, 로컬 디스크) | Attachment | 확정 | [11-attachment.md](11-attachment.md) |
| 12 | F-REPORT | 최소 리포트 (Pass율, 결함카운트) | TestReport, PassRate | 확정 | [12-report.md](12-report.md) |

### 부속 UX 명세
| 문서 | 부속 기능 | 상태 |
|---|---|---|
| [_ux-user-detail.md](_ux-user-detail.md) | F-USER §5 전반 (회원 목록 + 사이드바 상세 + 초대 모달 + 액션 다이얼로그) | 확정 |
| [_ux-role-matrix.md](_ux-role-matrix.md) | F-USER §5.3 (CO Role 매트릭스 탭 — 사이드바 내부) | 확정 |

### Phase 2 (8월 이후, MVP 검증 후)

| ID | 기능 | 사유 |
|----|------|------|
| F-TC-VER | TC 버전·이력 | MVP에서는 단순 수정 추적만 |
| F-RELEASE | 릴리즈/버전 관리 | Project 내 단일 버전 필드로 대체 |
| F-SCN | 테스트 시나리오 | TC+Plan으로 우선 커버 |
| F-TRACE | 요구사항 추적성 (RTM) | 데모 범위 외 |
| F-COMMON | 댓글 · 태그 · 멘션 | Phase 2 |
| F-IMPORT | 엑셀 import/export | 초기 마이그 1회성 스크립트 대체 |
| F-NOTIFY | 알림 (메일/인앱) | MVP는 이메일 인증/초대 발송에 한정 |
| F-AUDIT | 감사 로그 | 운영 단계 필요 |
| F-SEARCH | 통합 검색 | 기본 목록 필터로 대체 |
| F-AUTOMATION | CI 자동화 결과 수집 | Phase 2 |
| F-DEFECT-LINK | Jira 등 외부 이슈 연동 | Phase 2 |
| F-BILLING | 회사 단위 과금/플랜 | 운영 단계 |
| F-CO-DASHBOARD | CO 전용 사용량/활동 대시보드 | 운영 단계 |

> 백로그는 PM 합의로 확장/조정. 기능 확정 시 상태·문서 링크·추적성(Requirement ID) 갱신.

## 🧭 상태 정의

| 상태 | 의미 |
|------|------|
| 정의 전 | 백로그 등록만 됨 |
| 정의 중 | 기능 정의서 작성 진행 중 |
| 검토 | 초안 완료, PM/관련 에이전트 리뷰 대기 |
| 확정 | 합의 완료, 구현/테스트 착수 가능 |
| 재작성 필요 | 이전 락(v1) 기반 작성 → v2 락 반영 필요 |

---

## 🔗 다운스트림 연계
- **QA**: 각 기능의 **수용 기준(AC)** → `test-standard` 규칙에 따라 TestCase로 전환
- **Backend/Frontend**: 흐름·입출력·규칙 → API(GET/POST)·화면 구현
- **DBA**: 3-tier 격리키(`company_id`/`workspace_id`/`project_id`)·인덱스·복합 유니크
- **추적성**: `REQ-<도메인>-NNN` → 기능 ↔ TestCase ↔ Defect (glossary §5 TraceabilityMatrix)

## 🗂 락 변경 이력

| 버전 | 일자 | 핵심 변경 |
|------|------|------|
| v1 | 2026-06-05 | 단일 조직 / Admin·Tester 2단 / Workspace Phase 2 / MVP 10기능 |
| v2 | 2026-06-05 | **3-tier 격리(Company→WS→Project) / Role 6단(Master·CO·WO·PO·Member·Viewer) / 회원가입 2경로 / SMTP 도입 / MVP 12기능 (F-COMPANY·F-WS 부활)** |
| v2.1 | 2026-06-08 | **WO Project 컨테이너 권한(★15) / Project `code` 도입(불변·Company unique) / `roles/sync` 단일 트랜잭션 / Figma 마스터·메타 retrofit / UI 표현 패턴 락(모달/사이드바/새화면) / F-USER 회원관리 UX 명세** |
| v2.2 | 2026-06-08 | **테스트 도메인 5룰 추가** — (1) 삭제 작성자 한정(Rule 1·★16) (2) TestRun 단계별 결과 + 자동 종료 + 소요시간(Rule 2) (3) TestCase Scope 3종(Global/Workspace/Project, Rule 3) (4·5) TC 변경 시 영향 Run UNTESTED + step 이력 + duration 보존. ExecutionResult 5종(UNTESTED 활성). TestRun status enum (IN_PROGRESS/COMPLETED). |
| v2.4 | 2026-06-08 | **Soft Enum 정책 + 디자이너 정본 통합**. (a) 모든 도메인 enum을 외부 metadata-service 진실원으로 전환(ERD CHECK 제거, `varchar(50)` + Code SDK validator). 정본 `docs/integration/codes.md`. (b) ExecutionResult **6종** (+ PENDING 활성). (c) Priority **3종** (Urgent 제거, 옵션 A). (d) 디자인 시스템 정본 `docs/design/00_design_system_v3.md` 채택 — 컬러/타이포/간격/레이아웃/앱 셸/Auth Layout/컴포넌트. (e) 모바일 지원 추가 (mobile <768 활성화). (f) z-index 토큰 스케일 정본화(`--z-modal` 200 / `--z-drawer` 150). (g) 라우트 `/bugs` → `/defects`, 토큰 `--bug-*` → `--defect-*`. (h) 디자이너 파일 TestFlow → TMS, Next.js 가정 제거. |
| v2.5 | 2026-06-08 | **본문 사인오프(Lock Confirmed)** — 12 feature + 2 UX 명세 본문 PM 검토 완료 → 상태 `검토 → 확정` 일괄 전환. 락 후 변경은 **RFC 절차** 필수 (이슈 → PM 승인 → PR → 다운스트림 알림). BE/FE/QA 구현 착수 가능. Figma 마스터의 node-id 91건 TBD는 별도 디자이너 작업 트랙. |
| v2.6 | 2026-06-08 | **성능 가드 보강** (P1 후속). (a) **Rule 4·5 비동기 큐 강제** — `@Async` 단순 호출 → **영속 작업 큐** + jobId 응답 + 진행 상태 조회 + 재시도/DLQ. SLO: TC update p95 < 300ms, 1000 Run / 5분 처리. (`docs/features/07-test-case.md` §5.4). (b) **N+1 가드 검증 의무화** — 모든 목록 API 통합 테스트에 쿼리 카운트 어설션 + p6spy 로컬 + CI 머지 차단 (`backend-coding-standard.md` §7.2). (c) **Cursor 페이지네이션 룰 신설** — TC/Run/Defect/Attachment/StepHistory는 cursor 전환, 작은 컬렉션(WS/Project/Suite tree 등)은 offset 유지. `size ≤ 100`, offset 상한 10000, OpenAPI 공통 파라미터·스키마 추가 (`backend-coding-standard.md` §4.7). |
| v2.7 | 2026-06-09 | **WS·Project 초대 정책 갱신**. (a) WO의 WS 초대 / PO의 Project 초대 시 신규 `user_roles` 행 **기본 Role = Member** (기존 Viewer 폐기). 단 `(user_id, scope_type, scope_id)` 행 이미 존재 시 **기존 Role 유지(INSERT ON CONFLICT DO NOTHING)** — CO 사전 부여 Role 보존. (b) Member·Viewer enum 적용 Scope 확장 — `WORKSPACE` + `PROJECT` 양쪽 부여 가능 (기존 PROJECT만). WS Scope Member는 진입·메뉴 가시까지(★19·★23), Project Scope Member는 자산 작업까지(★19). (c) Project Scope 사용자의 상위 WS 자동 가시(★22) / WS Scope Member의 하위 Project 자동 가시(★23). (d) ERD `user_roles` 변경 — CHECK 제약 확장, UNIQUE를 `(user_id, scope_type, scope_id)`로 강화(라디오 모델, _ux-role-matrix §3.2). (e) Role 카운트 표기 Scope suffix `(W)`/`(P)` 필수 (UX-USER §2.3, openapi.yaml UserListItem). |
| v2.8 | 2026-06-09 | **배포 형태 표현 통일 (온프레미스 정합)**. (a) `srs.md` §1.1 / `features/README.md` 본문의 "멀티 Company SaaS형" 표현 폐기 → **"온프레미스 배포 + 멀티 Company 멀티테넌트 데이터 격리"** 로 통일. 배포 형태(Docker Compose 단일 호스트, 단일 노드 HA X)와 데이터 모델(멀티테넌트)을 분리 명시. (b) 외부 SaaS 서비스가 아님을 명시 — 고객사 자체 인프라 설치, 고객사별 인스턴스 분리 운영. (c) 디자인 정본(`design/00_design_system_v3.md`: "한국형 온프레미스") 표현과 정합. 기능·권한·도메인 모델 변경 없음 (배포/대상 표기만 정정). (d) 메모리 `project_menu_rbac.md`(RBAC 하드코딩·설정 UI 없음 — 온프레미스) 와 정합 확인. (e) 루트 `/README.md` 신규 (공유용 1-pager) + `docs/{design,api,dba,integration}/README.md` 신규. |
