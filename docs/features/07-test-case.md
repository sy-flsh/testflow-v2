# [F-TC] 테스트 케이스(TestCase) 관리

| 항목 | 내용 |
| --- | --- |
| 기능 ID | F-TC |
| 상태 | 검토 |
| 우선순위 | High |
| 관련 도메인(glossary) | TestCase, TestStep, Precondition, ExpectedResult, Priority, Tag |
| Figma | https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=0-1&p=f&m=dev |
| 작성자 | 기능 기획자 에이전트 |
| 최종 수정일 | 2026-06-05 |

> 본 기능은 **TestCase의 CRUD + 단계(TestStep)·태그·검색·Scope 3종(공용 포함)**을 다룬다. TC 버전 풀이력은 Phase 2(F-TC-VER), 본 MVP는 수정 추적 + **TC 변경 시 관련 TestRun에 step 단위 이력·UNTESTED 자동 재설정**(기획자 Rule 4·5). 권한: [`permissions.md`](../permissions.md) §4.4.

## 1. 개요 / 목적
- 검증 대상의 최소 단위(TestCase)를 명세·관리한다.
- 단계(TestStep)·사전조건·기대결과를 구조적으로 보관해 실행(F-RUN)·결함(F-DEF)과 연결한다.
- 검색·필터링·일괄 작업으로 자산 운영을 효율화한다.

## 2. 관련 용어
| 용어 | 정의 요약 |
| --- | --- |
| TestCase | 사전조건 + 단계 + 기대결과로 구성된 최소 검증 단위 (glossary §2) |
| TestStep | 케이스 구성 단계. order/action/expectedResult |
| Precondition | 실행 전 충족 조건 |
| ExpectedResult | 기대 결과 |
| Priority | TC 처리 우선순위 (Urgent/High/Medium/Low, glossary §4.2 enum 재활용) |
| Tag | 분류 키워드(다대다) |
| **Scope** | TC 사용 범위 enum: `GLOBAL`(Company 전역) / `WORKSPACE`(특정 WS의 모든 Project) / `PROJECT`(특정 Project만, 기본) |

## 3. 사용자 / 권한
| Scope | 생성 | 수정 | 삭제(soft) | 조회 |
| --- | --- | --- | --- | --- |
| **Global** | **모든 인증 사용자** (Master/CO/WO/PO/Member/Viewer) ★18 | 같은 Scope 작업 권한 보유자 ★17 | **작성자(`created_by`)만** ★16 | Company 내 모두 |
| **Workspace** | **WS 멤버 누구나** (WO/PO/Member/Viewer) ★18 | 같은 WS 멤버 ★17 | **작성자만** ★16 | WS 멤버 |
| **Project** | PO/Member (기존 룰) | PO/Member | **작성자만** ★16 | Project 멤버 (Viewer 포함) |

> 권한 매트릭스 정본: [`permissions.md`](../permissions.md) §4.4 (★16/★17/★18).
> Phase 2 승인 단계 도입 시 Global/Workspace 생성 거버넌스 강화 예정.

## 4. 사용자 스토리
- **PO/Member**로서, 검증 항목을 명세하기 위해, TC를 생성하고 단계·기대결과를 입력한다.
- **PO/Member**로서, 분류·필터링을 위해, TC에 태그·우선순위를 부여한다.
- **PO/Member**로서, 잘못 작성된 TC를 수정한다.
- **PO/Member**로서, 더 이상 필요 없는 TC를 삭제(soft)한다.
- **모든 멤버**로서, 키워드/태그/Suite로 TC를 검색한다.

## 5. 주요 흐름 / 시나리오

### 5.1 TC 생성 (Scope 분기)

#### 5.1.1 Project Scope (기본)
1. PO/Member가 `/projects/{projId}/test-cases` → "새 TC" 또는 Suite 우클릭 → "TC 추가".
2. 입력: scopeType=`PROJECT`, title, **suiteId(필수)**, priority, precondition, expectedResult, tags[], steps[].
3. `POST /api/v1/projects/{projId}/test-cases` (body 또는 query에 `scopeType=PROJECT`).
4. 서버: suite가 같은 Project 소속인지 검증. `code` 자동 발급(`TC-<project.code>-<seq>`).

#### 5.1.2 Workspace Scope (공용)
1. WS 멤버 누구나 `/workspaces/{wsId}/test-cases` → "새 공용 TC".
2. 입력: scopeType=`WORKSPACE`, title, **suiteId=null**, priority, precondition, expectedResult, tags[], steps[].
3. `POST /api/v1/workspaces/{wsId}/test-cases`.
4. 서버: 요청자가 그 WS 멤버인지 검증. `code` 자동 발급(`TC-WS<wsId>-<seq>`).

#### 5.1.3 Global Scope (전사 공용)
1. 모든 인증 사용자(Viewer 포함) `/company/test-cases` → "새 전사 공용 TC".
2. 입력: scopeType=`GLOBAL`, title, **suiteId=null**, priority, precondition, expectedResult, tags[], steps[].
3. `POST /api/v1/company/test-cases`.
4. 서버: 요청자가 같은 Company 사용자인지만 검증. `code` 자동 발급(`TC-GBL-<seq>`).

> 공통: 응답에 생성된 TC + steps + scopeType + scopeId. `created_by`에 요청자 기록(★16 삭제 권한 판정 근거).

### 5.2 TC 목록·검색

| 진입 | 엔드포인트 | 가시 범위 |
| --- | --- | --- |
| Project 컨텍스트 (기본) | `GET /api/v1/projects/{projId}/test-cases` | Project Scope TC + 그 Project 사용 가능한 WS·Global Scope TC 합본 (필터 `?scope=PROJECT|WORKSPACE|GLOBAL|ALL`) |
| Workspace 라이브러리 | `GET /api/v1/workspaces/{wsId}/test-cases` | WS Scope TC + Global Scope TC |
| Company 라이브러리 | `GET /api/v1/company/test-cases` | Global Scope TC만 |

- 쿼리: `q`(title·code 부분일치), `suiteId`(Project 화면만, 트리 노드 + 하위 포함 옵션), `priority`, `tag`, `createdBy`, `scope` 필터, page/size/sort.
- 응답: 페이지네이션 + 항목(id, code, title, **scopeType**, **scopeId**, suiteId(nullable), priority, tags, updatedAt 등).

### 5.3 TC 상세 조회
- `GET /api/v1/projects/{projId}/test-cases/{tcId}` → TC + steps + tags + 메타.

### 5.4 TC 수정
- Scope별 엔드포인트:
  - Project: `POST /api/v1/projects/{projId}/test-cases/{tcId}/update`
  - Workspace: `POST /api/v1/workspaces/{wsId}/test-cases/{tcId}/update`
  - Global: `POST /api/v1/company/test-cases/{tcId}/update`
- steps 일괄 교체 모델(부분 패치 Phase 2).
- **변경 트리거(Rule 4·5)** — `title`/`precondition`/`expectedResult`/`steps[]` 중 1개 이상 변경 시:
  1. 해당 TC를 참조하는 모든 `PlanItem` 검색 → 해당 PlanItem의 모든 `TestRun` 검색.
  2. 각 TestRun 대상으로:
     - `test_run_step_history`에 변경 전 step 스냅샷 1행 기록 (per affected step)
     - 해당 TestRun의 `test_run_steps.result`가 `null` 또는 비-`UNTESTED`이면 **`UNTESTED`로 재설정**
     - TestRun 자체 상태(`status`)도 `IN_PROGRESS`로 되돌림(`completed_at=null`). `duration_ms`는 보존.
  3. **비동기 작업 큐 처리 (필수)** — 영향 Run 1건이라도 발생할 가능성이 있으면 `@Async` 단순 호출이 아닌 **영속 작업 큐**(예: `tc_change_propagation_jobs` 테이블 또는 Redis Stream)에 작업 enqueue 후 응답은 즉시 `200 + { jobId }` 반환. 이유: (a) 영향 범위 큰 경우(예: Global Scope TC 변경 = Company 전역) 동기 처리 시 응답 지연 30초+ 위험, (b) 앱 재시작·실패 시 작업 손실 방지, (c) 트랜잭션 분리 — TC update 트랜잭션과 영향 Run 갱신 트랜잭션 격리.
     - 작업 단위: TestRun 1건 = job 1개. 병렬 워커가 batch 처리.
     - 실패 시 지수 백오프 + 최대 5회 재시도 → 실패 시 DLQ + Sentry 알림.
     - 멱등성: job에 (`tc_id`, `tc_updated_at`, `test_run_id`) 키 — 동일 키 중복 enqueue 시 1회만 처리.
     - 진행 상태 조회: `GET /api/v1/tc-change-jobs/{jobId}` → `{ status: PENDING | RUNNING | COMPLETED | FAILED, processed: N, total: M, failedRunIds: [...] }`
     - UI: 변경 직후 "TC 갱신 반영 중" 토스트 + 헤더에 진행 배지(`<Badge>3건 갱신 중</Badge>`) 표시. 완료 시 토스트 success. 실패 시 알림 + 재시도 버튼.
  4. CLOSED Plan의 TestRun도 동일 처리(이력 보존이 핵심).
- 비트리거 변경(태그/우선순위/scope 메타) → 이력 영향 없음.

> **성능 가드 (락 v2.4)**:
> - TC update 응답 SLO: **p95 < 300ms** (비동기 처리로 영향 Run 수와 무관).
> - 영향 Run 처리 SLO: **1000 Run / 5분 이내** 처리 완료 (4 워커 병렬 기준).
> - 큐 백로그 임계: `pending jobs > 1000` 시 alerting → 워커 증설 또는 batch 크기 조정.

> Scope별 처리 대상 범위:
> - Project Scope TC 변경 → 그 Project 내 TestRun.
> - Workspace Scope TC 변경 → WS 내 모든 Project의 TestRun.
> - Global Scope TC 변경 → Company 전역 모든 TestRun.

### 5.5 TC 삭제 (soft, **작성자 한정** ★16)
- Scope별 엔드포인트:
  - Project: `POST /api/v1/projects/{projId}/test-cases/{tcId}/delete`
  - Workspace: `POST /api/v1/workspaces/{wsId}/test-cases/{tcId}/delete`
  - Global: `POST /api/v1/company/test-cases/{tcId}/delete`
- **`created_by = 요청자`인 경우만** 가능. 다른 사용자(PO/CO 포함)는 403 `AUTH_FORBIDDEN`.
- **PlanItem에서 참조 중인 TC 삭제 시도** → 400 `TC_IN_USE` (Plan에서 먼저 제거 후 삭제).
- 통과 시 `is_deleted=true`.
- Phase 2: 승인 단계 도입 시 작성자 외 사용자도 신청·승인 후 삭제 가능.

### 5.6 TC 이동(Suite 변경, Project Scope 한정)
- `POST /api/v1/projects/{projId}/test-cases/{tcId}/move` (`newSuiteId`).
- 같은 Project 한정. Workspace/Global Scope TC는 Suite 비종속이므로 이동 개념 없음(`TC_SCOPE_NO_SUITE`).

### 5.7 태그 관리
- 태그는 자유 키워드(다대다 `test_case_tags`).
- 입력: 문자열 배열. 서버가 `tags` 테이블에 upsert(Project Scope unique).
- 삭제 태그는 TC에서 분리만(태그 자체 삭제는 Phase 2).

### 5.8 대안 / 예외 흐름
- Project Scope에 suiteId 누락 → 400 `COMMON_INVALID_INPUT`.
- WS/Global Scope에 suiteId 포함 전송 → 400 `TC_SCOPE_NO_SUITE`.
- suite 다른 Project → 400 `TC_CROSS_PROJECT_FORBIDDEN`.
- 미존재 TC → 404 `TC_NOT_FOUND`.
- 필수 필드 누락 → 400 `COMMON_INVALID_INPUT`.
- PlanItem 참조 중 삭제 → 400 `TC_IN_USE`.
- 작성자 아닌 삭제 시도 → 403 `AUTH_FORBIDDEN` (★16).
- 비활성 Project (Project Scope TC만 해당) → 403 `PROJ_INACTIVE`.
- 비활성 WS (WS·Project Scope) → 403 `WS_INACTIVE`.
- 비활성 Company → 403 `COMPANY_INACTIVE`.
- WS 비멤버가 WS Scope TC 작업 → 403 `AUTH_FORBIDDEN`.

## 6. 입력 / 출력

### 6.1 입력
| 구분 | 항목 | 설명/제약 |
| --- | --- | --- |
| 생성 | scopeType | 필수, `GLOBAL`/`WORKSPACE`/`PROJECT` |
| 생성 | title | 필수, 1~200자 |
| 생성 | suiteId | Project Scope만 필수, WS/Global Scope는 미전송 |
| 생성 | priority | 기본 `Medium`. enum (`Urgent`/`High`/`Medium`/`Low`) |
| 생성 | precondition | 선택, 0~2000자 |
| 생성 | expectedResult | 선택, 0~2000자 |
| 생성 | tags[] | 선택, 각 1~30자, 최대 10개 |
| 생성 | steps[] | 선택, [{order, action, expectedResult}] |
| 수정 | (위 필드 부분) | 부분 변경. scopeType은 **불변** |
| 수정 | steps[] | 전체 교체 (부분 패치 X, MVP) |
| 목록 | q / suiteId / includeChildren / priority / tag / createdBy / scope / page / size / sort | 모두 선택 |
| 이동 | newSuiteId | Project Scope만 |

### 6.2 출력
| 구분 | 항목 | 설명 |
| --- | --- | --- |
| TC 표현(상세) | id, code, **scopeType**, **scopeId**, title, suite(id+path, Project Scope만), priority, precondition, expectedResult, tags[], steps[{order, action, expectedResult}], createdBy, updatedBy, createdAt, updatedAt | |
| TC 표현(목록) | id, code, scopeType, scopeId, title, suiteId(nullable), priority, tags[], updatedAt | 가벼움 |
| 응답 래퍼 | `success/code/message/data` | backend §4.5 |

## 7. 비즈니스 규칙
- **Scope 정본** (기획자 Rule 3):
  - `PROJECT`: Project 종속, Suite 트리에 포함. 격리키 `company_id`+`workspace_id`+`project_id`.
  - `WORKSPACE`: WS 종속, Suite 비종속. 격리키 `company_id`+`workspace_id`. WS 내 모든 Project에서 사용 가능.
  - `GLOBAL`: Company 전역, Suite 비종속. 격리키 `company_id`만. Company 내 모든 WS·Project에서 사용 가능.
  - `scopeType`은 생성 후 **불변**(`TC_SCOPE_IMMUTABLE`). 변경 필요 시 신규 생성 + 마이그레이션.
- **`code` 자동 발급**:
  - Project: `TC-<project.code>-<seq>`
  - Workspace: `TC-WS<wsId>-<seq>`
  - Global: `TC-GBL-<seq>`
  - `seq`는 Scope 단위 1부터 증가, soft-deleted 포함 재사용 X.
- **steps 전체 교체 모델**(MVP): PUT-like POST. 부분 패치는 Phase 2.
- **변경 트리거(Rule 4·5)**: §5.4 정의. `title`/`precondition`/`expectedResult`/`steps[]` 변경 시 참조 TestRun에 step 단위 이력 + `UNTESTED` 자동 재설정. 비동기(`@Async`) 처리.
- **삭제 권한 (Rule 1, ★16)**: `created_by = 요청자`만 soft delete. PlanItem 참조 시 거부(`TC_IN_USE`).
- **격리 검증**: Project Scope TC의 Suite는 같은 Project, WS Scope는 그 WS 멤버, Global Scope는 같은 Company.
- **Soft delete**: `is_deleted=true`. 검색·목록에서 제외.
- **버전 이력**: MVP는 `updated_at/updated_by` + 위 변경 트리거의 step 스냅샷(영향 TestRun에). 풀 TC 버전 관리는 Phase 2 F-TC-VER.
- **사용 모델 = 참조**: PlanItem이 TC를 참조(복제 X). TC 변경은 모든 참조 Run에 영향.

## 8. 예외 / 에러
| 상황 | 처리 | 에러 코드 |
| --- | --- | --- |
| 미인증 | 401 | `AUTH_UNAUTHORIZED` |
| Scope에 대응 권한 부족 | 403 | `AUTH_FORBIDDEN` |
| 미존재 TC | 404 | `TC_NOT_FOUND` |
| 다른 Project Suite 사용 | 400 | `TC_CROSS_PROJECT_FORBIDDEN` |
| 비-Project Scope에 suiteId 포함 | 400 | `TC_SCOPE_NO_SUITE` |
| Project Scope에 suiteId 누락 | 400 | `COMMON_INVALID_INPUT` |
| scopeType 변경 시도 | 400 | `TC_SCOPE_IMMUTABLE` |
| PlanItem에서 참조 중 삭제 | 400 | `TC_IN_USE` |
| 작성자 아닌 삭제 시도 | 403 | `AUTH_FORBIDDEN` (★16) |
| 비활성 Project (PROJECT Scope) | 403 | `PROJ_INACTIVE` |
| 비활성 WS (WS·PROJECT Scope) | 403 | `WS_INACTIVE` |
| 비활성 Company | 403 | `COMPANY_INACTIVE` |
| 입력 형식 오류 | 400 | `COMMON_INVALID_INPUT` |

## 9. 수용 기준 (Acceptance Criteria)
- [ ] **AC-1** Given PO/Member, When Project Scope TC 생성하면, Then 200 + `code=TC-<proj.code>-<seq>` + steps 저장.
- [ ] **AC-2** Given Viewer, When Project Scope TC 생성 시도, Then 403 `AUTH_FORBIDDEN`.
- [ ] **AC-3** Given 다른 Project Suite, When suiteId로 Project Scope 생성, Then 400 `TC_CROSS_PROJECT_FORBIDDEN`.
- [ ] **AC-4** Given 기존 TC, When steps를 새 배열로 update, Then 기존 steps 전부 교체.
- [ ] **AC-5** Given Plan에 등록된 TC, When 삭제 시도, Then 400 `TC_IN_USE`.
- [ ] **AC-6** Given 작성자 본인 + Plan 미참조 TC, When 삭제, Then 200 + `is_deleted=true`.
- [ ] **AC-7** Given **작성자 아닌 PO** + Plan 미참조 TC, When 삭제 시도, Then 403 `AUTH_FORBIDDEN` (★16).
- [ ] **AC-8** Given `q=keyword`, When 목록 호출, Then title·code 부분일치 결과 반환.
- [ ] **AC-9** Given Tag 부여, When `tag=foo` 필터, Then 해당 태그 보유 TC만.
- [ ] **AC-10** Given 비활성 Project, When Project Scope TC API 호출, Then 403 `PROJ_INACTIVE`.
- [ ] **AC-11** Given 비활성 WS, When WS Scope TC API 호출, Then 403 `WS_INACTIVE`.
- [ ] **AC-12** Given **WS 멤버 Viewer**, When Workspace Scope TC 생성, Then 200 (★18).
- [ ] **AC-13** Given **인증된 모든 사용자(Viewer 포함)**, When Global Scope TC 생성, Then 200 + `code=TC-GBL-<seq>` (★18).
- [ ] **AC-14** Given Workspace Scope 생성에 `suiteId` 포함, When 호출, Then 400 `TC_SCOPE_NO_SUITE`.
- [ ] **AC-15** Given Project Scope 생성에 `suiteId` 누락, When 호출, Then 400 `COMMON_INVALID_INPUT`.
- [ ] **AC-16** Given 기존 TC, When `scopeType` 변경 시도, Then 400 `TC_SCOPE_IMMUTABLE`.
- [ ] **AC-17** Given Project 컨텍스트, When 목록 호출 (`scope=ALL`), Then 그 Project 사용 가능한 모든 Scope TC 합본 반환.
- [ ] **AC-18** Given Project Scope TC의 `title` 변경, When update + 해당 TC를 참조하는 TestRun 1건 존재(step result=PASS), Then 변경 후 그 TestRun step result `UNTESTED` + `test_run_step_history` 1행 + TestRun `status=IN_PROGRESS`.
- [ ] **AC-19** Given Workspace Scope TC의 `steps` 변경, When 두 Project에서 각각 그 TC를 참조하는 TestRun 존재, Then 둘 다 영향 받아 step `UNTESTED` 처리.
- [ ] **AC-20** Given Global Scope TC 변경, When Company 내 모든 영향 TestRun 갱신 비동기 처리, Then 응답은 즉시 200, 백그라운드로 step·이력 갱신.
- [ ] **AC-21** Given TC의 `tag` 변경(비트리거), When update, Then 영향 TestRun에 step 이력·UNTESTED 영향 없음.

## 10. 추적성
| Requirement ID | 설명 | 관련 기능/화면 | 관련 API(개념) | 연관 TestCase |
| --- | --- | --- | --- | --- |
| REQ-TC-001 | TC 생성 — Scope 3종 분기 | /projects, /workspaces, /company test-cases | `POST .../test-cases` | (QA) |
| REQ-TC-002 | TC 목록·검색·필터·Scope 합본 | 각 Scope 라이브러리 | `GET .../test-cases?scope=...` | (QA) |
| REQ-TC-003 | TC 상세 조회 | 각 Scope 상세 | `GET .../test-cases/{id}` | (QA) |
| REQ-TC-004 | TC 수정 + 변경 트리거(영향 Run UNTESTED + 이력) | 각 Scope 상세 | `POST .../test-cases/{id}/update` | (QA) |
| REQ-TC-005 | TC Suite 이동(Project Scope만) | /projects/{id}/test-cases/{id} | `POST /projects/{id}/test-cases/{id}/move` | (QA) |
| REQ-TC-006 | TC 삭제 — 작성자 한정(★16) + PlanItem 미참조 | 각 Scope 상세 | `POST .../test-cases/{id}/delete` | (QA) |
| REQ-TC-007 | 격리 검증(Scope별 가시·작업 범위) | 전역 | (서비스 규칙) | (QA) |
| REQ-TC-008 | TC 변경 시 영향 TestRun step 이력·UNTESTED 비동기 갱신 | 전역 | (이벤트/비동기 잡) | (QA) |

## 11. 오픈 이슈 / 비고
- **TC 버전·이력**: MVP는 수정 추적(`updated_at/updated_by`) + 변경 트리거의 step 이력. 풀 버전 관리(version·diff·rollback)는 Phase 2 F-TC-VER.
- **steps 부분 패치**: 전체 교체로 갈음. Phase 2.
- **승인 단계 도입(Rule 1·3 Phase 2)**: Global/Workspace TC 생성·삭제에 승인 워크플로 추가 — PO/CO 승인 후 작성자 외 삭제 가능. 데이터 모델: `tc_change_requests`.
- **TC 변경 영향 갱신의 동기 vs 비동기**: 권장 비동기(`@Async`). 영향 Run 수가 수천 건일 경우 처리 시간·실패 회복 정책 — Phase 2 큐(예: RabbitMQ) 검토.
- **공용 TC 거버넌스**: Global Scope 무제한 생성 시 노이즈 위험. 태그 강제·승인 단계 도입 — Phase 2.
- **태그 자체 삭제/통합**: Phase 2.
- **TC 복제·일괄 작업**: Phase 2.
- **TC 첨부**: Step 이미지·파일 첨부 — F-ATTACH의 owner를 TC로 확장 여부 Phase 2.
- **검색 고도화**: Full-text 검색(PostgreSQL `tsvector`) Phase 2.
- **Priority enum 통일**: glossary §4.2 Severity/Priority와 별개로 TC Priority를 위 4종으로 재활용. enum 명확화 필요.
- **변경 트리거 비트리거 필드**: 현재 `title/precondition/expectedResult/steps[]`만 트리거. `precondition` 단순 오타 수정도 UNTESTED 트리거? 운영 시 fine-tune 필요.
