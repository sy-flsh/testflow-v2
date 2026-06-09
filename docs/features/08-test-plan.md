# [F-PLAN] 테스트 계획(TestPlan) 관리

| 항목 | 내용 |
| --- | --- |
| 기능 ID | F-PLAN |
| 상태 | 검토 |
| 우선순위 | High |
| 관련 도메인(glossary) | TestPlan, TestCycle, PlanItem(신규 보조 용어), TestCase, Milestone |
| Figma | https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=0-1&p=f&m=dev |
| 작성자 | 기능 기획자 에이전트 |
| 최종 수정일 | 2026-06-05 |

> 본 기능은 **TestPlan(계획) + PlanItem(계획에 포함된 TC 1건 + 담당자)**의 CRUD를 다룬다. 실행 결과(TestRun) 기록은 F-RUN, 결함 등록은 F-DEF. TestCycle은 MVP에서는 단순 status(`DRAFT/IN_PROGRESS/CLOSED`)로 갈음(풀 cycle은 Phase 2).

## 1. 개요 / 목적
- Project 내에서 특정 릴리스/스프린트에 실행할 TC를 묶고, 담당자를 할당하여 **실행 단위(Plan)**를 만든다.
- Plan별 진척·통과율(F-REPORT)·결함(F-DEF) 집계의 기준이 된다.

## 2. 관련 용어
| 용어 | 정의 요약 |
| --- | --- |
| TestPlan | 실행 계획 (이름·기간·상태·milestone 텍스트) |
| PlanItem | Plan에 포함된 TC 1건 + 담당자(`assigneeUserId`). 실행 단위 |
| Milestone | 자유 텍스트 라벨(데모). 정형 객체화는 Phase 2 |

## 3. 사용자 / 권한
| Role | 권한 |
| --- | --- |
| PO | Plan CRUD, PlanItem 추가/제거/담당자 할당, 상태 전이 |
| Member | Plan CRUD, PlanItem 추가/제거, **담당자 할당은 PO 전용** (★ permissions §4.4) |
| Viewer | 조회만 |

> 권한 매트릭스 정본: [`permissions.md`](../permissions.md) §4.4.

## 4. 사용자 스토리
- **PO**로서, 다음 릴리스 회귀 테스트를 준비하기 위해, Plan을 만들고 TC를 일괄 추가한다.
- **PO**로서, 각 PlanItem 담당자를 정하여, Member가 본인 몫만 실행하게 한다.
- **Member**로서, Plan에 본인 TC를 추가할 수 있다(담당자 지정 X).
- **모든 멤버**로서, Plan 진척률(완료/전체)을 한눈에 본다.

## 5. 주요 흐름 / 시나리오

### 5.1 Plan 생성 (PO·Member)
1. `/projects/{projId}/plans` → "새 Plan".
2. 입력: name·milestone(텍스트, 선택)·plannedStartAt·plannedEndAt(선택)·status(기본 `DRAFT`).
3. `POST /api/v1/projects/{projId}/plans`.

### 5.2 Plan 목록·상세
- `GET /api/v1/projects/{projId}/plans` — 필터: `q`, `status`, page/size/sort. 응답에 `itemCount`, `executedCount`, `passRate` 요약.
- `GET /api/v1/projects/{projId}/plans/{planId}` — Plan + PlanItem 목록 + 진척률.

### 5.3 PlanItem 추가
- `POST /api/v1/projects/{projId}/plans/{planId}/items` (body: `testCaseIds[]`, 선택 `assigneeUserId`).
- 서버 검증: 같은 Project의 TC인지, 비활성/삭제 TC 아닌지, 중복 추가 시 무시(idempotent).
- 담당자 지정은 **PO만**(Member가 보내면 무시 + 200 또는 400 `PLAN_ASSIGNEE_FORBIDDEN`). **MVP 정책: 400 명확 거부**.

### 5.4 PlanItem 담당자 할당/변경 (PO)
- `POST /api/v1/projects/{projId}/plans/{planId}/items/{itemId}/assign` (body: `assigneeUserId`).
- 담당자는 같은 Project 멤버여야 함. 아니면 400 `USER_NOT_IN_PROJECT`.
- 미할당으로 되돌리기: `assigneeUserId=null`.

### 5.5 PlanItem 제거
- `POST /api/v1/projects/{projId}/plans/{planId}/items/{itemId}/remove`.
- **실행 결과(TestRun)가 1건 이상 있으면 거부** → 400 `PLAN_ITEM_HAS_RUNS` (이력 보존). 또는 soft archive(데모는 거부).

### 5.6 Plan 상태 전이 (PO)
- `POST /api/v1/projects/{projId}/plans/{planId}/status` (body: `targetStatus`).
- enum: `DRAFT → IN_PROGRESS → CLOSED`. 역행 금지(`CLOSED → IN_PROGRESS` 등 거부).
- `CLOSED` 상태에서는 PlanItem 추가/제거/담당자 변경 모두 거부.

### 5.7 Plan 수정·삭제
- 수정: `POST /plans/{planId}/update` (name·milestone·일정). 권한: PO/Member (현행).
- 삭제: `POST /plans/{planId}/delete` → **작성자 한정 ★16** (기획자 Rule 1). `created_by = 요청자`만. PO/CO 우회 X. + **PlanItem이 1건이라도 있으면 거부** (`PLAN_NOT_EMPTY`). 빈 Plan만 soft delete. Phase 2 승인 단계 도입 예정.

### 5.8 대안 / 예외 흐름
- 비활성 Project → 403 `PROJ_INACTIVE`.
- 다른 Project의 TC 추가 시도 → 400 `PLAN_CROSS_PROJECT_FORBIDDEN`.
- CLOSED Plan에 PlanItem 추가/제거 → 400 `PLAN_CLOSED_LOCKED`.
- 담당자가 Project 멤버 아님 → 400 `USER_NOT_IN_PROJECT`.

## 6. 입력 / 출력

### 6.1 입력
| 구분 | 항목 | 설명/제약 |
| --- | --- | --- |
| Plan 생성 | name | 필수, 1~100자 |
| Plan 생성 | milestone | 선택, 0~100자(텍스트) |
| Plan 생성 | plannedStartAt/plannedEndAt | 선택, ISO 8601 |
| Item 추가 | testCaseIds[] | 필수, 같은 Project |
| Item 추가 | assigneeUserId | 선택, PO만 |
| Item 할당 | assigneeUserId | 선택(null=미할당), Project 멤버 |
| Item 제거 | (Path) itemId | 필수, Run 0건 |
| 상태 전이 | targetStatus | 필수, enum |

### 6.2 출력
| 구분 | 항목 | 설명 |
| --- | --- | --- |
| Plan 표현 | id, name, status, milestone, plannedStartAt, plannedEndAt, itemCount, executedCount, passRate, createdAt | |
| PlanItem 표현 | id, testCase(id+code+title), assignee(요약), latestRun(요약 또는 null) | |
| 응답 래퍼 | `success/code/message/data` | backend §4.5 |

## 7. 비즈니스 규칙
- **상태 전이 단방향**: `DRAFT → IN_PROGRESS → CLOSED`. 역행/스킵 거부.
- **CLOSED 잠금**: PlanItem 변경·담당자 변경 거부.
- **TestRun 있는 PlanItem 제거 거부**: 이력 보존.
- **빈 Plan만 삭제**: PlanItem 있으면 거부.
- **담당자 할당은 PO 전용** (permissions ★).
- **격리**: TC·담당자 모두 같은 Project 한정.
- **격리키**: `test_plans`/`plan_items`는 `company_id`, `workspace_id`, `project_id` 보유.
- **진척률·통과율 계산** (F-RUN v2 정합):
  - `executedCount` = PlanItem 중 **최신 TestRun이 `status=COMPLETED`이고 `result != null`인 수**. `IN_PROGRESS` Run은 미실행으로 카운트.
  - `passCount` = 위 중 `result=PASS` 수
  - `passRate` = `passCount / executedCount` (0 분모는 null)
- **Plan 삭제 (Rule 1·★16)**: 작성자(`created_by = 요청자`)만 가능. + 빈 Plan만(`PLAN_NOT_EMPTY` 우선 적용).

## 8. 예외 / 에러
| 상황 | 처리 | 에러 코드 |
| --- | --- | --- |
| 미인증 | 401 | `AUTH_UNAUTHORIZED` |
| Project 멤버 아님 | 403 | `AUTH_FORBIDDEN` |
| 미존재 Plan/Item | 404 | `PLAN_NOT_FOUND` / `PLAN_ITEM_NOT_FOUND` |
| 다른 Project TC 추가 | 400 | `PLAN_CROSS_PROJECT_FORBIDDEN` |
| Member의 담당자 지정 시도 | 400 | `PLAN_ASSIGNEE_FORBIDDEN` |
| Project 멤버 아닌 담당자 | 400 | `USER_NOT_IN_PROJECT` |
| Run 있는 Item 제거 | 400 | `PLAN_ITEM_HAS_RUNS` |
| 비어있지 않은 Plan 삭제 | 400 | `PLAN_NOT_EMPTY` |
| 작성자 아닌 Plan 삭제 시도 | 403 | `AUTH_FORBIDDEN` (★16) |
| 역행 상태 전이 | 400 | `PLAN_INVALID_STATUS_TRANSITION` |
| CLOSED Plan 변경 | 400 | `PLAN_CLOSED_LOCKED` |
| 비활성 Project | 403 | `PROJ_INACTIVE` |
| 입력 형식 오류 | 400 | `COMMON_INVALID_INPUT` |

## 9. 수용 기준 (Acceptance Criteria)
- [ ] **AC-1** Given PO/Member, When Plan 생성하면, Then 200 + `status=DRAFT`.
- [ ] **AC-2** Given Member, When PlanItem 추가 with `assigneeUserId`, Then 400 `PLAN_ASSIGNEE_FORBIDDEN`.
- [ ] **AC-3** Given PO, When 같은 Project TC 5건을 PlanItem으로 추가하면, Then 200 + 5건 추가.
- [ ] **AC-4** Given PO, When 다른 Project TC 추가하면, Then 400 `PLAN_CROSS_PROJECT_FORBIDDEN`.
- [ ] **AC-5** Given PO, When 비Project 멤버 사용자에게 담당자 할당, Then 400 `USER_NOT_IN_PROJECT`.
- [ ] **AC-6** Given Run 보유 PlanItem, When 제거 시도하면, Then 400 `PLAN_ITEM_HAS_RUNS`.
- [ ] **AC-7** Given 작성자 본인 + 비어있는 Plan, When 삭제, Then 200 + `is_deleted=true`.
- [ ] **AC-8** Given Item 1건 보유 Plan, When 삭제 시도, Then 400 `PLAN_NOT_EMPTY`.
- [ ] **AC-7b** Given **작성자 아닌 PO** + 비어있는 Plan, When 삭제 시도, Then 403 `AUTH_FORBIDDEN` (★16).
- [ ] **AC-9** Given `DRAFT`, When `IN_PROGRESS` 전이, Then 200.
- [ ] **AC-10** Given `CLOSED`, When `IN_PROGRESS`로 되돌리기 시도, Then 400 `PLAN_INVALID_STATUS_TRANSITION`.
- [ ] **AC-11** Given `CLOSED`, When PlanItem 추가 시도, Then 400 `PLAN_CLOSED_LOCKED`.
- [ ] **AC-12** Given 10 Items, 최신 Run 6 COMPLETED·PASS, 2 COMPLETED·FAIL, 2 미실행(IN_PROGRESS 또는 Run 없음), When 상세 조회, Then `executedCount=8`, `passRate=0.75`. IN_PROGRESS Run은 미실행으로 카운트.

## 10. 추적성
| Requirement ID | 설명 | 관련 기능/화면 | 관련 API(개념) | 연관 TestCase |
| --- | --- | --- | --- | --- |
| REQ-PLAN-001 | Plan 생성·수정·삭제(빈 Plan 한정) | /projects/{id}/plans | `POST /plans`·`/update`·`/delete` | (QA) |
| REQ-PLAN-002 | PlanItem 추가/제거(Run 보유 시 잠금) | /plans/{id} | `POST /plans/{id}/items`·`/remove` | (QA) |
| REQ-PLAN-003 | PlanItem 담당자 할당(PO 전용) | /plans/{id} | `POST /plans/{id}/items/{id}/assign` | (QA) |
| REQ-PLAN-004 | Plan 상태 전이(DRAFT→IN_PROGRESS→CLOSED) | /plans/{id} | `POST /plans/{id}/status` | (QA) |
| REQ-PLAN-005 | 진척률·통과율 집계 | /plans/{id}, /report | (집계 쿼리) | (QA) |
| REQ-PLAN-006 | 격리(같은 Project TC/담당자) | 전역 | (서비스 규칙) | (QA) |

## 11. 오픈 이슈 / 비고
- **TestCycle 정형화**: glossary §3 TestCycle을 별도 객체로 도입할지(반복 실행) — Phase 2.
- **Milestone 정형화**: 자유 텍스트 → 정형 객체(릴리스 버전 등) Phase 2.
- **다중 담당자**: PlanItem 1건당 다중 담당자 — Phase 2.
- **자동 진척률 갱신**: PlanItem 변경 시 캐시 무효화 — 실시간 vs 배치 결정 필요.
- **CLOSED 잠금 정책**: 결함 추가/상태 변경은 별도(F-DEF). Plan 잠금은 PlanItem 수준에만 적용.
