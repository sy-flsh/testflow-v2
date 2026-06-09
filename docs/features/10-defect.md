# [F-DEF] 결함(Defect) 관리

| 항목 | 내용 |
| --- | --- |
| 기능 ID | F-DEF |
| 상태 | 검토 |
| 우선순위 | High |
| 관련 도메인(glossary) | Defect, DefectStatus, Severity, Priority, Reporter, Assignee, ReproductionSteps |
| Figma | https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=0-1&p=f&m=dev |
| 작성자 | 기능 기획자 에이전트 |
| 최종 수정일 | 2026-06-05 |

> 본 기능은 **결함 등록·리스트·상태·담당자 관리**를 다룬다. MVP는 상태 4종(`OPEN`/`IN_PROGRESS`/`RESOLVED`/`CLOSED`) 단순 전이(glossary §4.3 8종 축약). Jira 등 외부 연동·코멘트·멘션·이력은 Phase 2.

## 1. 개요 / 목적
- 테스트 실행 중 발견된 기대-실제 결과 불일치를 결함(Defect)으로 등록·추적한다.
- 결함은 TestRun에서 연결 등록(권장)되며, 독립 등록(Run 없이)도 허용한다.
- 상태·담당자·심각도·우선순위를 통해 처리 진행을 가시화한다.

## 2. 관련 용어
| 용어 | 정의 요약 |
| --- | --- |
| Defect | 결함 1건 |
| DefectStatus | MVP 4종(`OPEN`/`IN_PROGRESS`/`RESOLVED`/`CLOSED`) |
| Severity | glossary §4.1 (`Critical`/`Major`/`Minor`/`Trivial`) |
| Priority | glossary §4.2 (`Urgent`/`High`/`Medium`/`Low`) |
| Reporter | 결함 등록자 |
| Assignee | 결함 담당자(수정 책임) |

## 3. 사용자 / 권한
| Role | 권한 |
| --- | --- |
| PO | Defect CRUD, 모든 상태 변경, 담당자 지정 |
| Member | Defect 등록, **본인 등록 또는 본인 할당 Defect의 상태/내용만 변경** (★11), 담당자 변경 X |
| Viewer | 조회만 |

> 권한 매트릭스 정본: [`permissions.md`](../permissions.md) §4.4.

## 4. 사용자 스토리
- **PO/Member**로서, 실행 결과가 Fail이면 결함을 등록한다(연결 TestRun 자동 매핑).
- **PO/Member**로서, 결함 상태를 `OPEN → IN_PROGRESS → RESOLVED → CLOSED` 순으로 전이한다.
- **PO**로서, 결함 담당자를 Project 멤버 중에서 지정한다.
- **PO/Member**로서, 결함에 재현 절차·환경·심각도·우선순위를 기록한다.
- **모든 멤버**로서, 상태/담당자/심각도/우선순위 필터로 결함을 조회한다.

## 5. 주요 흐름 / 시나리오

### 5.1 결함 등록 — TestRun 연결
1. TestRun 결과가 FAIL인 화면에서 "결함 등록" → `POST /api/v1/projects/{projId}/defects` (body: `testRunId`(선택), title, description, severity, priority, reproductionSteps, assigneeUserId(선택, PO만)).
2. 서버 검증: testRunId가 같은 Project인지(있을 때), assignee가 Project 멤버인지(있을 때, Member는 미지정만 허용).
3. 상태 자동 `OPEN`. reporter = 요청자.
4. 응답: 생성된 Defect.

### 5.2 결함 등록 — 독립
- testRunId 없이 등록 가능. 화면: `/projects/{projId}/defects/new`.

### 5.3 결함 목록·검색
- `GET /api/v1/projects/{projId}/defects`.
- 쿼리: `q`, `status`, `severity`, `priority`, `reporterUserId`, `assigneeUserId`, page/size/sort.
- 응답: 페이지네이션.

### 5.4 결함 상세 조회
- `GET /api/v1/projects/{projId}/defects/{defectId}` → Defect + 연결 TestRun(있으면 요약) + Attachment 카운트.

### 5.5 결함 수정
- `POST /api/v1/projects/{projId}/defects/{defectId}/update` (부분 필드).
- 권한:
  - PO: 모든 필드 (title·description·severity·priority·reproductionSteps).
  - Member: **본인이 reporter 또는 assignee일 때만** title·description·severity·priority·reproductionSteps 수정.

### 5.6 상태 전이
- `POST /api/v1/projects/{projId}/defects/{defectId}/status` (body: `targetStatus`).
- 전이 규칙(단순 전이):
  - `OPEN → IN_PROGRESS`
  - `IN_PROGRESS → RESOLVED`
  - `RESOLVED → CLOSED`
  - `RESOLVED → OPEN` (재오픈, 검증 실패)
  - 그 외 전이 거부.
- 권한: PO(모든 결함), Member(본인 reporter/assignee만).

### 5.7 담당자 지정/변경
- `POST /api/v1/projects/{projId}/defects/{defectId}/assign` (body: `assigneeUserId`).
- PO만 가능. assignee는 같은 Project 멤버.
- 미할당: `assigneeUserId=null`.

### 5.8 결함 삭제 (soft, **작성자 한정 ★16**)
- `POST /api/v1/projects/{projId}/defects/{defectId}/delete`.
- **작성자(`created_by = 요청자` = reporter) 한정** (Rule 1·★16). PO/CO 우회 X.
- 기존 "PO + CLOSED 한정" 정책은 **폐기** (Rule 1 단일화).
- soft delete: `is_deleted=true`. 첨부·코멘트는 보존.
- Phase 2 승인 단계 도입 시 작성자 외 사용자도 신청·승인 후 삭제 가능.

### 5.9 대안 / 예외 흐름
- 다른 Project의 TestRun 연결 → 400 `DEF_CROSS_PROJECT_FORBIDDEN`.
- 잘못된 상태 전이 → 400 `DEF_INVALID_STATUS_TRANSITION`.
- Member의 담당자 변경 시도 → 403 `AUTH_FORBIDDEN`.
- Member의 타인 결함 수정 시도 → 403 `AUTH_FORBIDDEN`.
- 비활성 Project → 403 `PROJ_INACTIVE`.

## 6. 입력 / 출력

### 6.1 입력
| 구분 | 항목 | 설명/제약 |
| --- | --- | --- |
| 등록 | testRunId | 선택, 같은 Project |
| 등록 | title | 필수, 1~200자 |
| 등록 | description | 선택, 0~5000자 |
| 등록 | severity | 기본 `Major`, enum |
| 등록 | priority | 기본 `Medium`, enum |
| 등록 | reproductionSteps | 선택, 0~5000자 |
| 등록 | assigneeUserId | 선택, PO만 |
| 수정 | (위 필드 부분) | 권한 따라 부분 |
| 상태 | targetStatus | 필수, enum |
| 할당 | assigneeUserId | 필수(null=미할당), PO 전용 |
| 목록 | q/status/severity/priority/reporterUserId/assigneeUserId/page/size/sort | 모두 선택 |

### 6.2 출력
| 구분 | 항목 | 설명 |
| --- | --- | --- |
| Defect 표현(상세) | id, code, title, description, status, severity, priority, reproductionSteps, reporter(요약), assignee(요약 또는 null), testRun(요약 또는 null), attachmentCount, createdAt, updatedAt | |
| Defect 표현(목록) | id, code, title, status, severity, priority, assigneeName, updatedAt | |
| 응답 래퍼 | `success/code/message/data` | backend §4.5 |

## 7. 비즈니스 규칙
- **상태 enum 4종**: `OPEN`/`IN_PROGRESS`/`RESOLVED`/`CLOSED` (MVP). 8종은 Phase 2.
- **상태 전이 룰 (DAG)**:
  - `OPEN → IN_PROGRESS`
  - `IN_PROGRESS → RESOLVED`
  - `RESOLVED → CLOSED`
  - `RESOLVED → OPEN` (재오픈)
- **Member 수정 권한 제한** (★11): 본인 reporter 또는 assignee만.
- **담당자 변경은 PO 전용**.
- **결함 `code` 자동 발급**: `DEF-<project.code>-<seq>` 형식. `project.code`는 F-PROJ §7 정의. `seq`는 Project 내 1부터 증가, 삭제 후 재사용 X.
- **TestRun 연결 격리**: 다른 Project Run 연결 거부.
- **삭제 권한 (Rule 1·★16)**: `created_by = 요청자`(reporter)인 작성자만 가능. PO/CO 우회 X. CLOSED 제약은 폐기. soft delete.
- **격리키**: `defects`는 `company_id`, `workspace_id`, `project_id` 보유.

## 8. 예외 / 에러
| 상황 | 처리 | 에러 코드 |
| --- | --- | --- |
| 미인증 | 401 | `AUTH_UNAUTHORIZED` |
| Project 멤버 아님 | 403 | `AUTH_FORBIDDEN` |
| 미존재 Defect | 404 | `DEF_NOT_FOUND` |
| 다른 Project Run 연결 | 400 | `DEF_CROSS_PROJECT_FORBIDDEN` |
| 잘못된 상태 전이 | 400 | `DEF_INVALID_STATUS_TRANSITION` |
| Member의 담당자 변경 | 403 | `AUTH_FORBIDDEN` |
| Member의 타인 결함 수정 | 403 | `AUTH_FORBIDDEN` |
| Project 비멤버 담당자 지정 | 400 | `USER_NOT_IN_PROJECT` |
| 작성자 아닌 삭제 시도 | 403 | `AUTH_FORBIDDEN` (★16) |
| 비활성 Project | 403 | `PROJ_INACTIVE` |
| 입력 형식 오류 | 400 | `COMMON_INVALID_INPUT` |

## 9. 수용 기준 (Acceptance Criteria)
- [ ] **AC-1** Given PO/Member, When 결함 등록(testRunId 포함)하면, Then 200 + Defect 생성 + 상태 `OPEN` + reporter=요청자.
- [ ] **AC-2** Given Member, When `assigneeUserId` 포함 등록 시도하면, Then 400 또는 무시(MVP 정책: 400 `AUTH_FORBIDDEN`).
- [ ] **AC-3** Given 다른 Project TestRun id, When 연결 등록하면, Then 400 `DEF_CROSS_PROJECT_FORBIDDEN`.
- [ ] **AC-4** Given Member가 reporter인 결함, When 본인이 description 수정하면, Then 200.
- [ ] **AC-5** Given Member가 reporter/assignee 둘 다 아님, When 수정 시도하면, Then 403 `AUTH_FORBIDDEN`.
- [ ] **AC-6** Given `OPEN`, When `IN_PROGRESS`로 전이, Then 200.
- [ ] **AC-7** Given `OPEN`, When `RESOLVED`로 전이(중간 건너뜀), Then 400 `DEF_INVALID_STATUS_TRANSITION`.
- [ ] **AC-8** Given `RESOLVED`, When `OPEN`(재오픈)으로 전이, Then 200.
- [ ] **AC-9** Given Member, When 담당자 변경 시도, Then 403 `AUTH_FORBIDDEN`.
- [ ] **AC-10** Given PO, When 비Project 멤버 담당자 지정, Then 400 `USER_NOT_IN_PROJECT`.
- [ ] **AC-11** Given **작성자 본인** + 임의 상태 결함, When 삭제, Then 200 + `is_deleted=true`. (CLOSED 제약 제거)
- [ ] **AC-12** Given **작성자 아닌 PO**, When 삭제 시도, Then 403 `AUTH_FORBIDDEN` (★16).
- [ ] **AC-13** Given 필터 `status=OPEN`, When 목록 조회, Then OPEN 결함만 반환.
- [ ] **AC-14** Given 비활성 Project, When Defect API 호출, Then 403 `PROJ_INACTIVE`.

## 10. 추적성
| Requirement ID | 설명 | 관련 기능/화면 | 관련 API(개념) | 연관 TestCase |
| --- | --- | --- | --- | --- |
| REQ-DEF-001 | 결함 등록(TestRun 연결 또는 독립) | /projects/{id}/defects | `POST /defects` | (QA) |
| REQ-DEF-002 | 결함 목록·검색·필터 | /projects/{id}/defects | `GET /defects` | (QA) |
| REQ-DEF-003 | 결함 상세·수정(권한 분기) | /defects/{id} | `POST /defects/{id}/update` | (QA) |
| REQ-DEF-004 | 상태 전이(4종 DAG) | /defects/{id} | `POST /defects/{id}/status` | (QA) |
| REQ-DEF-005 | 담당자 지정(PO 전용) | /defects/{id} | `POST /defects/{id}/assign` | (QA) |
| REQ-DEF-006 | 결함 삭제(PO + CLOSED) | /defects/{id} | `POST /defects/{id}/delete` | (QA) |
| REQ-DEF-007 | 격리(같은 Project Run/담당자) | 전역 | (서비스 규칙) | (QA) |

## 11. 오픈 이슈 / 비고
- **상태 enum 풀세트(8종)**: `New`/`Verified`/`Reopened`/`Rejected` 등 — Phase 2.
- **코멘트·멘션·활동 이력**: Phase 2 F-COMMON.
- **외부 이슈 연동(Jira)**: Phase 2 F-DEFECT-LINK.
- **결함 SLA·자동 닫힘**: 운영 정책 Phase 2.
- **TestRun-Defect N:N 연결**: MVP는 N:1(Defect → TestRun 단건). N:N 확장은 Phase 2.
- **결함 검색 고도화**: Full-text Phase 2.
