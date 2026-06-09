# [F-RUN] 테스트 실행(TestRun) 결과 기록

| 항목 | 내용 |
| --- | --- |
| 기능 ID | F-RUN |
| 상태 | 검토 |
| 우선순위 | High |
| 관련 도메인(glossary) | TestRun, ExecutionResult, PlanItem, ActualResult, TestEnvironment |
| Figma | https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=0-1&p=f&m=dev |
| 작성자 | 기능 기획자 에이전트 |
| 최종 수정일 | 2026-06-08 |

> 본 기능은 PlanItem 단위 **TestRun(실행 1회차 헤더) + 단계별 결과(`test_run_steps`)** 기록을 다룬다. 결과 enum은 MVP **5종**(`PASS`/`FAIL`/`BLOCKED`/`SKIPPED`/`UNTESTED`) — glossary §3.1의 `Retest`는 Phase 2. 자동 종료(`status=COMPLETED`) + 소요시간(`duration_ms`) + **TC 변경 시 step 자동 UNTESTED + 이력**(기획자 Rule 2·4·5). 삭제는 **작성자 한정**(Rule 1). 첨부는 F-ATTACH, 결함은 F-DEF.

## 1. 개요 / 목적
- PlanItem 1건당 실행 1회차 = TestRun 헤더 1행 + 참조 TC의 step만큼 `test_run_steps` 다행.
- 사용자가 각 step의 결과를 개별 입력하며, **모든 step 결과 입력 완료 시 TestRun 자동 종료**(완료 시각·소요시간 기록).
- Fail step 발견 시 결함 등록(F-DEF)으로 연결.

## 2. 관련 용어
| 용어 | 정의 요약 |
| --- | --- |
| TestRun | PlanItem 단위 실행 1회차의 **헤더**. status·started_at·completed_at·duration_ms·result(집계)·environment 보유 |
| TestRunStep | TestRun에 속한 단계별 결과. TestCase의 TestStep 1개당 1행. `result` 5종 enum |
| ExecutionResult | `PASS`/`FAIL`/`BLOCKED`/`SKIPPED`/`UNTESTED` (glossary §3.1, MVP 5종) |
| TestRun status | `IN_PROGRESS`(미완 step 1개 이상) / `COMPLETED`(모든 step 결과 입력 완료) |
| Duration | 시작~마지막 step 결과 입력 시각 누적 (ms 단위) |
| ActualResult | step별 실제 결과 텍스트 |
| TestEnvironment | 자유 텍스트(브라우저/OS 등) |

## 3. 사용자 / 권한
| Role | 권한 |
| --- | --- |
| PO | 모든 PlanItem 실행(시작·step 기록·메타 수정), Run 조회 |
| Member | **본인 할당 PlanItem만** 실행(★10), 조회 |
| Viewer | 조회만 |
| Run 삭제 | **작성자(`created_by` = Run 시작자) 한정**(★16). PO/CO 우회 권한 없음 |

> 권한 매트릭스 정본: [`permissions.md`](../permissions.md) §4.4.

## 4. 사용자 스토리
- **PO/Member**로서, 할당받은 PlanItem 실행을 시작하면, TestRun 헤더와 step별 미입력(UNTESTED) 행이 자동 생성된다.
- **PO/Member**로서, 각 step을 수행하며 결과(`PASS`/`FAIL`/`BLOCKED`/`SKIPPED`)와 실제 결과를 입력한다.
- **PO/Member**로서, 모든 step 결과 입력이 완료되면 TestRun이 자동 종료되고 소요시간이 기록된다.
- **PO/Member**로서, 입력 중 잠시 중단 후 다시 돌아오면 미입력 step부터 이어 작성한다.
- **PO**로서, Fail step에서 결함을 등록(F-RUN→F-DEF)하여 추적한다.
- **Viewer**로서, Plan별 Run 이력·각 step 결과를 조회한다.
- **작성자**로서, 잘못 시작한 Run을 (24h 내) 삭제한다.

## 5. 주요 흐름 / 시나리오

### 5.1 Run 시작 (헤더 + step 초기화)
1. 실행 화면(`/projects/{projId}/plans/{planId}` 내 PlanItem 선택) → "실행 시작".
2. `POST /api/v1/projects/{projId}/runs` (body: `planItemId`, `environment`(선택)).
3. 서버 검증:
   - PlanItem 활성, Plan 미잠금(CLOSED Plan도 실행 허용 — F-PLAN §11).
   - Member의 경우 `assigneeUserId == 요청자`(아니면 400 `RUN_NOT_ASSIGNED`).
   - 참조 TC가 비활성/삭제 아님.
4. 처리:
   - `test_runs` 1행: `started_at=now`, `status=IN_PROGRESS`, `result=null`, `completed_at=null`, `duration_ms=0`, `created_by=요청자`.
   - 참조 TC의 step 목록 스냅샷 기준으로 `test_run_steps` 다행 생성, 각 `result=UNTESTED`, `actual_result=null`.
5. 응답: TestRun 헤더 + steps 배열 (모두 UNTESTED 초기값).

### 5.2 step 결과 입력/수정
1. 화면에서 step 한 줄 선택 → 결과 라디오(`PASS`/`FAIL`/`BLOCKED`/`SKIPPED`) + actualResult 입력 → "저장".
2. `POST /api/v1/projects/{projId}/runs/{runId}/steps/{stepId}/update` (body: `result`, `actualResult`).
3. 서버 검증:
   - runId·stepId 정합(이 Run의 step인지).
   - 결과 enum 5종 중(`UNTESTED`도 가능 — 되돌리기 허용, 단 자동 종료 해제 사이드 이펙트 있음).
   - 권한 검증(Run 작성자 본인 또는 PO. Member는 본인 할당 Item의 Run에 한해).
4. 처리:
   - `test_run_steps`: `result`, `actual_result`, `updated_at=now`, `updated_by_user_id` 갱신.
   - **소요시간 갱신**: `duration_ms = updated_at - started_at` (헤더 컬럼 갱신).
   - **자동 종료 판정**: 모든 step의 `result != UNTESTED`이면 → §5.3 종료 처리.

### 5.3 자동 종료 (status=COMPLETED + 집계 result)
- 트리거: §5.2에서 마지막 UNTESTED step이 다른 결과로 갱신된 순간.
- 처리:
  - `completed_at=now`
  - `duration_ms = completed_at - started_at`
  - `status=COMPLETED`
  - **집계 result 계산** (우선순위):
    1. step 중 1개라도 `FAIL` → `result=FAIL`
    2. 아니면 1개라도 `BLOCKED` → `result=BLOCKED`
    3. 아니면 1개라도 `SKIPPED` + 나머지 `PASS` → `result=SKIPPED` (PASS+SKIPPED 혼합도 SKIPPED 우선)
    4. 모두 `PASS` → `result=PASS`
- 응답: 갱신된 TestRun 헤더 + steps.
- 종료 후에도 step 결과 수정 가능 → 한 step이라도 `UNTESTED`로 되돌리면 `status=IN_PROGRESS`로 재진입(`completed_at=null`, `result=null`).

### 5.4 Run 조회/이력
- `GET /api/v1/projects/{projId}/runs/{runId}` → TestRun 헤더 + steps + 변경 이력 카운트 + 첨부 카운트 + 연결 결함 카운트.
- `GET /api/v1/projects/{projId}/plans/{planId}/items/{itemId}/runs` — PlanItem의 Run 시간 역순 목록.
- `GET /api/v1/projects/{projId}/runs/{runId}/step-history` → TC 변경으로 발생한 `test_run_step_history` 시간 역순.

### 5.5 Run 메타 수정
- `POST /api/v1/projects/{projId}/runs/{runId}/update` (body: `environment`).
- 결과(step `result`) 수정은 §5.2 step 엔드포인트로만.
- 권한: Run 작성자 본인 또는 PO.

### 5.6 Run 삭제 (soft, **작성자 한정 ★16**)
- `POST /api/v1/projects/{projId}/runs/{runId}/delete`.
- `created_by = 요청자`만 가능. PO/CO 우회 권한 없음(Rule 1).
- 24h 윈도 제거(이전 정책 폐기) — 작성자라면 언제든 soft delete 가능(MVP). Phase 2 승인 단계로 확장.
- soft delete: `test_runs.is_deleted=true`. step·history는 보존(이력 추적성).

### 5.7 TC 변경에 의한 자동 UNTESTED + 이력 (Rule 4·5 — F-TC §5.4 트리거)
- F-TC §5.4의 변경 트리거가 발화되면 본 기능은 **수동 호출 없이** 다음 처리를 받는다:
  1. 영향 TestRun 식별: 변경된 TC를 참조하는 PlanItem들의 Run.
  2. 각 영향 TestRun에 대해:
     - 모든 `test_run_steps`의 변경 전 스냅샷을 `test_run_step_history`에 기록(run_id, step_id, snapshot_action, snapshot_expected_result, changed_at, changed_by_user_id, reason='TC_UPDATED').
     - `test_run_steps.result`가 `null`이 아니거나 비-`UNTESTED`였던 행 → `UNTESTED`로 재설정 + `updated_at=now`.
     - `test_runs.status=IN_PROGRESS`, `completed_at=null`, `result=null`. **`duration_ms`는 보존**(이전까지 누적 시간 보존, 재실행 시 누적 이어감).
  3. step 구조 자체 변경(TC step 추가/삭제) 처리:
     - **신규 step**: `test_run_steps`에 `UNTESTED` 신규 행 추가.
     - **삭제 step**: 해당 `test_run_steps` 행 soft delete + history 보존.
- 처리는 비동기(`@Async`). 결과 가시화는 다음 Run 조회 시.

### 5.8 대안 / 예외 흐름
- 비활성 Project → 403 `PROJ_INACTIVE`.
- 비활성 WS/Company → 403 `WS_INACTIVE`/`COMPANY_INACTIVE`.
- Plan/PlanItem 미존재 → 404 `PLAN_NOT_FOUND`/`PLAN_ITEM_NOT_FOUND`.
- Member 비할당 Item 실행 시도 → 400 `RUN_NOT_ASSIGNED`.
- 결과 enum 외 값 → 400 `RUN_INVALID_RESULT`.
- 다른 Run의 step id로 update 시도 → 400 `RUN_STEP_MISMATCH`.
- 작성자 아닌 Run 삭제 시도 → 403 `AUTH_FORBIDDEN` (★16).

## 6. 입력 / 출력

### 6.1 입력
| 구분 | 항목 | 설명/제약 |
| --- | --- | --- |
| Run 시작 | planItemId | 필수 |
| Run 시작 | environment | 선택, 0~200자 |
| step 결과 | result | 필수, enum (`PASS`/`FAIL`/`BLOCKED`/`SKIPPED`/`UNTESTED`) |
| step 결과 | actualResult | 선택, 0~5000자 |
| Run 메타 수정 | environment | 부분 변경 |
| Run 삭제 | (Path) runId | 필수, 작성자 |
| Run 조회 | range/result/status/executedBy/page/size/sort | 모두 선택 |

### 6.2 출력
| 구분 | 항목 | 설명 |
| --- | --- | --- |
| TestRun 헤더 | id, planItem(id+testCase 요약), **status**, **result**(집계, null if IN_PROGRESS), **startedAt**, **completedAt**(nullable), **durationMs**, environment, createdBy(요약), attachmentCount, defectCount | |
| TestRun steps[] | id, testStepId, order, action, expectedResult, **result**(5종), actualResult, updatedAt, updatedBy(요약) | TC step 스냅샷 + 결과 |
| 이력(step-history) | id, stepId, snapshotAction, snapshotExpectedResult, changedAt, changedBy(요약), reason | TC 변경 흔적 |
| 응답 래퍼 | `success/code/message/data` | backend §4.5 |

## 7. 비즈니스 규칙
- **단계별 결과 모델**: TestRun 헤더 + `test_run_steps` 다행. step별 result 5종.
- **결과 enum 5종**: `PASS`/`FAIL`/`BLOCKED`/`SKIPPED`/`UNTESTED` (Rule 2·4·5 정합).
- **자동 종료**: 모든 step `result != UNTESTED` 시점에 `status=COMPLETED` + `completed_at` + 집계 `result` 산출 (§5.3).
- **집계 result 우선순위**: FAIL > BLOCKED > SKIPPED > PASS (1건이라도 상위 결과 있으면 그 결과).
- **소요시간(`duration_ms`)** (Rule 2):
  - 시작 = `started_at` 기록.
  - 각 step result 업데이트 시 `duration_ms = lastUpdatedAt - started_at` 갱신.
  - 종료 시 `duration_ms = completed_at - started_at` 확정.
  - **TC 변경 의한 UNTESTED 재설정 시에도 duration_ms 보존** (이전 누적 보존). 재실행 시 갱신 이어감.
- **Member 할당 강제(★10)**: Member는 본인 할당 PlanItem만 Run 가능. 비할당 → 400.
- **PlanItem당 다회차 Run** 허용. 진척률·집계는 최신 Run 기준(F-PLAN §7).
- **삭제 (Rule 1·★16)**: `created_by = 요청자`만 soft. 24h 윈도 폐기. PO/CO 우회 X.
- **수정 권한**: step result는 Run 작성자 + PO. Member는 본인 할당 Run에 한해.
- **격리키**: `test_runs`/`test_run_steps`/`test_run_step_history`는 `company_id`+`workspace_id`+`project_id` 보유.
- **TC 변경 트리거 흡수**(Rule 4·5): F-TC §5.4 트리거 발생 시 본 기능이 자동 처리(§5.7). 사용자 액션 불요.
- **시간 저장**: UTC 저장, `Asia/Seoul` 표시.

## 8. 예외 / 에러
| 상황 | 처리 | 에러 코드 |
| --- | --- | --- |
| 미인증 | 401 | `AUTH_UNAUTHORIZED` |
| Project 멤버 아님 | 403 | `AUTH_FORBIDDEN` |
| 미존재 Run/Plan/Item/Step | 404 | `RUN_NOT_FOUND` / `PLAN_*_NOT_FOUND` / `RUN_STEP_NOT_FOUND` |
| Member 비할당 Item 실행 | 400 | `RUN_NOT_ASSIGNED` |
| 잘못된 결과 enum | 400 | `RUN_INVALID_RESULT` |
| 다른 Run의 stepId update | 400 | `RUN_STEP_MISMATCH` |
| 작성자 아닌 삭제 시도 | 403 | `AUTH_FORBIDDEN` (★16) |
| 작성자 아닌 메타 수정 시도(PO 아님) | 403 | `AUTH_FORBIDDEN` |
| 비활성 Project/WS/Company | 403 | `PROJ_INACTIVE`/`WS_INACTIVE`/`COMPANY_INACTIVE` |
| 입력 형식 오류 | 400 | `COMMON_INVALID_INPUT` |

## 9. 수용 기준 (Acceptance Criteria)
- [ ] **AC-1** Given Member가 본인 할당 Item, When Run 시작, Then 200 + 헤더 `status=IN_PROGRESS`·`started_at=now` + 참조 TC step 수만큼 `test_run_steps` 모두 `result=UNTESTED`.
- [ ] **AC-2** Given Member가 타인 할당 Item, When Run 시작 시도, Then 400 `RUN_NOT_ASSIGNED`.
- [ ] **AC-3** Given Viewer, When Run 시작 시도, Then 403 `AUTH_FORBIDDEN`.
- [ ] **AC-4** Given Run 진행 중, When step result 입력하면, Then 200 + 해당 step 갱신 + `duration_ms` 증가.
- [ ] **AC-5** Given Run에 step 5개 중 4개 결과 입력 완료, When 마지막 step `PASS` 입력, Then `status=COMPLETED` + `completed_at=now` + 집계 `result=PASS`(모두 PASS면).
- [ ] **AC-6** Given Run step 5개 중 1개 FAIL + 나머지 PASS, When 자동 종료, Then 집계 `result=FAIL`.
- [ ] **AC-7** Given Run step PASS×3 + BLOCKED×1 + SKIPPED×1, When 자동 종료, Then 집계 `result=BLOCKED` (FAIL 없음, BLOCKED 우선).
- [ ] **AC-8** Given Run step 모두 SKIPPED·PASS 혼합 (FAIL/BLOCKED 없음), When 자동 종료, Then 집계 `result=SKIPPED` (PASS+SKIPPED 혼합도 SKIPPED 우선).
- [ ] **AC-9** Given COMPLETED Run, When 한 step을 `UNTESTED`로 되돌리면, Then `status=IN_PROGRESS` + `completed_at=null` + 집계 `result=null`. `duration_ms` 보존.
- [ ] **AC-10** Given `result=INVALID`, When step 호출, Then 400 `RUN_INVALID_RESULT`.
- [ ] **AC-11** Given 다른 Run의 stepId로 호출, When step update, Then 400 `RUN_STEP_MISMATCH`.
- [ ] **AC-12** Given 작성자 본인, When Run 삭제, Then 200 + `is_deleted=true`. steps·history는 보존.
- [ ] **AC-13** Given **작성자 아닌 PO**, When Run 삭제 시도, Then 403 `AUTH_FORBIDDEN` (★16).
- [ ] **AC-14** Given PlanItem A에 PASS Run + 이후 FAIL Run 작성, When Plan 진척률 조회, Then 최신 Run(FAIL)이 집계 반영.
- [ ] **AC-15** Given 비활성 Project, When Run API 호출, Then 403 `PROJ_INACTIVE`.
- [ ] **AC-16** Given 진행 중 Run + 모든 step PASS 입력, When 마지막 step 입력 직후 응답, Then `duration_ms = lastUpdatedAt - started_at` 정확.
- [ ] **AC-17** Given 진행 중 Run 시작 후 5분 일시 중단 → 10분 후 다음 step 입력 → 종료, When duration 확인, Then `duration_ms = completed_at - started_at` (≈15분 ms 단위).
- [ ] **AC-18** Given Run의 참조 TC 본문(title/expected/step) 변경(F-TC 트리거), When 비동기 처리 완료, Then 영향 Run 모든 step `result=UNTESTED` + `status=IN_PROGRESS` + `completed_at=null` + `duration_ms` **보존** + `test_run_step_history` 각 step 1행 추가.
- [ ] **AC-19** Given TC에 step 신규 추가, When 트리거, Then 영향 Run의 `test_run_steps`에 신규 step 행 `result=UNTESTED` 추가.
- [ ] **AC-20** Given TC에서 step 삭제, When 트리거, Then 영향 Run의 해당 step 행 soft delete + history 보존.
- [ ] **AC-21** Given TC의 tag만 변경(비트리거), When 트리거 안 됨, Then 영향 Run에 변경 없음.

## 10. 추적성
| Requirement ID | 설명 | 관련 기능/화면 | 관련 API(개념) | 연관 TestCase |
| --- | --- | --- | --- | --- |
| REQ-RUN-001 | Run 시작 — 헤더 + step 초기화(UNTESTED) | /projects/{id}/runs | `POST /projects/{id}/runs` | (QA) |
| REQ-RUN-002 | step별 결과 입력·수정 | /runs/{id} | `POST /runs/{id}/steps/{id}/update` | (QA) |
| REQ-RUN-003 | 자동 종료 + 집계 result + duration | 전역 | (서비스 규칙) | (QA) |
| REQ-RUN-004 | Member 할당 강제(★10) | 전역 | (서비스 규칙) | (QA) |
| REQ-RUN-005 | Run·step 이력 조회 | /runs/{id}, /runs/{id}/step-history | `GET ...` | (QA) |
| REQ-RUN-006 | Run 삭제 — 작성자 한정(★16) | /runs/{id} | `POST /runs/{id}/delete` | (QA) |
| REQ-RUN-007 | Plan 진척률 = 최신 Run 기준 | 전역 | (집계 쿼리) | (QA) |
| REQ-RUN-008 | TC 변경 시 자동 UNTESTED + 이력 + duration 보존 | 전역(F-TC §5.4 연계) | (비동기 잡) | (QA) |
| REQ-RUN-009 | 종료 후 step 재변경 시 IN_PROGRESS 회귀 | 전역 | (서비스 규칙) | (QA) |

## 11. 오픈 이슈 / 비고
- **CLOSED Plan 실행 허용**: F-PLAN §11 정책 정합. 운영 잠금은 Phase 2.
- **집계 result 우선순위**: SKIPPED+PASS 혼합 시 SKIPPED 우선은 데모 정책. 운영은 PASS 우선 가능 — 합의 필요.
- **`Retest` enum**: glossary 6종 풀세트 Phase 2.
- **TestEnvironment 정형화**: 브라우저·OS·디바이스 분리 — Phase 2.
- **다중 TC 일괄 실행(Bulk)**: PASS 일괄 마킹 등 효율화 — Phase 2.
- **실행 타이머/UI 표시**: duration 실시간 UI 노출(진행 중 카운트업) — Phase 2.
- **TC 변경 영향 비동기 처리 지연 가시화**: 사용자가 갱신 진행 중인지 알 수 있는 표시 필요 — Phase 2.
- **삭제 = 작성자 한정 (Rule 1) Phase 2 승인 단계**: 영향 Run 삭제는 이력 손실 위험. 신중 검토.
- **step 수정 권한 미세화**: Member가 본인 시작 Run 중에 PO가 다른 step 수정 가능? — 데모는 PO 모든 권한, Phase 2 정책 결정.
- **자동 종료 알림**: 마지막 step 입력 시 토스트 "테스트 종료, 소요 X분" Phase 2 F-NOTIFY.
- **Run 시작 시 TC step 스냅샷**: 시작 시점 TC step 기준으로 `test_run_steps` 생성. 시작 후 TC 변경은 §5.7 트리거. 시작 전 TC 변경은 영향 없음(다음 Run부터 반영).
