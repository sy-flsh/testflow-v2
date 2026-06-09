# TMS 공통 용어 사전 (Glossary / Ubiquitous Language)

| 항목 | 내용 |
| --- | --- |
| 문서명 | TMS 공통 용어 사전 (Glossary / Ubiquitous Language) |
| 문서 버전 | v1.2 |
| 최초 작성일 | 2026-06-02 |
| 최종 개정일 | 2026-06-05 |
| 작성 주체 | PM (Project Manager) 에이전트 |
| 문서 등급 | 정본(正本, Single Source of Truth) — 도메인 용어 표준 |
| 적용 범위 | Backend / Frontend / QA 전 영역 |
| 관리 원칙 | 한/영 1:1 매핑, 영어 표준은 PascalCase 명사 정본, 변형 표기는 각 L1 정의서의 변환 규칙을 따름 |

> 본 문서는 TMS(Test Management System, **테스트 관리 도구**) 프로젝트의 **도메인 공통 용어 사전(Ubiquitous Language)의 정본**입니다.
> 백엔드 클래스명/DB 식별자/API 경로, 프론트엔드 컴포넌트명/모델명, QA 테스트 명세가 **모두 동일한 용어**를 사용하도록 통일하는 것이 목적입니다.
> 본 문서는 코드 구현을 포함하지 않으며, 용어의 한국어·영어 표준·약어·정의만을 규정합니다.

---

## 1. 거버넌스 및 관계 (Governance & Relationship)

### 1.1 development-standard.md 3.3과의 관계

- `docs/standards/development-standard.md`의 **3.3 공통 용어 사전(Ubiquitous Language)** 절은 시드(seed) 용어(TestCase, TestSuite, TestRun, Defect, User)만 제시하며, **전체 용어의 정본은 본 문서(`docs/glossary.md`)**임을 명시합니다.
- 두 문서 사이에 불일치가 발생하면 **본 문서(glossary.md)가 도메인 용어에 한하여 우선**합니다. (개발 표준의 다른 절은 그대로 L0 기준 문서가 우선합니다.)
- L1 정의서(backend / frontend / qa)의 도메인 용어는 모두 본 문서를 참조해야 합니다.

### 1.2 용어 추가/변경 거버넌스

| 원칙 | 내용 |
| --- | --- |
| PM 합의 필수 | 신규 용어 추가, 기존 용어의 한/영 매핑 변경, 약어 신설/폐지는 **반드시 PM 합의를 거친다.** 임의 추가 금지 |
| 변경 절차 | L1 작성 중 누락/모호 용어 발견 시 임의 정의하지 말고 PM에게 등록/명확화를 요청한다 |
| 1:1 매핑 | 하나의 한국어 개념은 하나의 영어 표준에만 매핑한다. 동의어 난립을 금지한다 |
| 약어 정책 | 약어는 본 사전에 등록된 것만 사용한다. 임의 축약 금지 (development-standard.md 3.2 준수) |
| 변경 이력 | 모든 변경은 본 문서 말미의 변경 이력 표에 기록한다 |

### 1.3 표기 변환 규칙 (정본 → 영역별 변형)

본 문서의 영어 표준 용어는 **PascalCase 명사**를 정본으로 삼습니다. 영역별 실제 표기 변형(snake_case, kebab-case, camelCase 등)은 **각 L1 정의서의 변환 규칙**을 따릅니다. 아래는 원칙 예시이며 최종 규칙은 L1에서 확정합니다.

| 사용 위치 | 표기 규칙(예시) | `TestCase` 적용 예 |
| --- | --- | --- |
| 정본(본 문서) | PascalCase 명사 | `TestCase` |
| 백엔드 클래스/타입 | PascalCase | `TestCase` |
| 백엔드 변수/필드 | camelCase | `testCase` |
| DB 테이블/컬럼 | snake_case | `test_case` |
| API 경로(URI) | kebab-case 복수형 | `/test-cases` |
| 프론트 컴포넌트 | PascalCase | `TestCaseList` |
| QA 테스트 명세 | 정본 용어 그대로 참조 | `TestCase` |

> 위 변환 규칙의 구체 확정(예: 식별자 접미어 `Id` vs `ID`, 복수형 처리)은 각 L1 정의서가 정합니다. 본 문서는 **의미 단위 용어**만 정본으로 제공합니다.

---

## 2. 테스트 설계 (Test Design)

| 한국어 | 영어 표준 | 약어 | 정의/설명 |
| --- | --- | --- | --- |
| 테스트 케이스 | TestCase | TC | 특정 기능/조건을 검증하기 위한 최소 단위 명세. 사전조건, 테스트 스텝, 기대 결과로 구성된다. 테스트 자산의 기본 단위 |
| 테스트 스위트 | TestSuite | - | 관련 테스트 케이스를 논리적으로 묶은 그룹. 폴더/모듈 단위로 케이스를 조직화한다 |
| 테스트 시나리오 | TestScenario | - | 하나 이상의 테스트 케이스를 사용자 흐름/업무 흐름 순서로 엮은 검증 흐름. 케이스보다 상위의 행위 단위 |
| 테스트 스텝 | TestStep | - | 테스트 케이스를 구성하는 개별 실행 단계. 순번(order), 수행 동작(action), 단계별 기대 결과를 가진다 |
| 사전조건 | Precondition | - | 테스트 케이스를 실행하기 전에 충족되어야 하는 상태/조건 (예: 로그인 상태, 특정 데이터 존재) |
| 기대 결과 | ExpectedResult | - | 테스트 스텝/케이스 수행 후 나타나야 하는 정상 결과. 실제 결과(ActualResult)와 비교하여 Pass/Fail을 판정한다 |
| 실제 결과 | ActualResult | - | 테스트 실행 시 실제로 관측된 결과. 기대 결과와의 차이가 결함 후보가 된다 |
| 테스트 데이터 | TestData | - | 테스트 실행에 필요한 입력값/데이터 셋. 케이스나 스텝에 연결되어 재현성을 보장한다 |

---

## 3. 테스트 계획 / 실행 (Test Planning & Execution)

| 한국어 | 영어 표준 | 약어 | 정의/설명 |
| --- | --- | --- | --- |
| 테스트 계획 | TestPlan | - | 특정 릴리스/스프린트의 테스트 범위, 일정, 대상 스위트, 담당자, 목표를 정의하는 상위 계획 문서 |
| 테스트 사이클 | TestCycle | - | 테스트 계획 내에서 한 회차의 실행 주기. 동일 케이스 집합을 회귀(regression) 등으로 반복 실행하는 단위 |
| 테스트 실행(런) | TestRun | - | 테스트 케이스(또는 스위트)를 실제로 한 번 수행한 실행 기록. 실행 결과/실행자/실행 시각/환경을 포함한다 |
| 실행 결과 | ExecutionResult | - | 단일 테스트 실행의 판정 상태. 허용 값은 아래 [3.1 ExecutionResult 상태값] 참조 |
| 테스트 환경 | TestEnvironment | ENV | 테스트가 수행되는 대상 환경(예: dev, staging, prod, 브라우저/OS 조합). 결과 해석의 맥락을 제공한다 |
| 마일스톤 | Milestone | - | 테스트 활동이 연계되는 릴리스/일정 기준점 (예: 릴리스 버전, 스프린트 종료일) |

### 3.1 ExecutionResult 상태값 (enum)

| 상태값 | 한국어 | 의미 |
| --- | --- | --- |
| Pass | 통과 | 기대 결과와 실제 결과가 일치하여 검증에 성공함 |
| Fail | 실패 | 기대 결과와 실제 결과가 불일치함 (결함 등록 대상) |
| Blocked | 차단됨 | 사전조건 미충족/선행 결함 등으로 실행 자체가 불가함 |
| Skipped | 건너뜀 | 범위 제외/비해당으로 의도적으로 실행하지 않음 |
| Untested | 미실행 | 아직 실행되지 않은 초기 상태. **MVP 활성** (단계 미입력 초기 + TestCase 변경 시 자동 재설정) |
| Retest | 재테스트 | 결함 수정 등으로 재실행이 필요한 상태. (Phase 2) |

---

## 4. 결함 관리 (Defect Management)

| 한국어 | 영어 표준 | 약어 | 정의/설명 |
| --- | --- | --- | --- |
| 결함 | Defect | - | 테스트 실행 중 발견된 기대 동작과의 불일치(버그). `Bug`와 동의이나 정본 용어는 `Defect`로 통일한다 |
| 심각도 | Severity | - | 결함이 시스템/품질에 미치는 영향의 크기. 허용 값은 아래 [4.1 Severity 상태값] 참조 |
| 우선순위 | Priority | - | 결함을 처리해야 하는 시급성. 허용 값은 아래 [4.2 Priority 상태값] 참조 |
| 결함 상태 | DefectStatus | - | 결함 처리 진행 상태. 허용 값은 아래 [4.3 DefectStatus 상태값] 참조 |
| 재현 절차 | ReproductionSteps | - | 결함을 동일하게 재현하기 위한 단계별 절차. 환경/테스트 데이터/입력을 포함한다 |
| 결함 보고자 | Reporter | - | 결함을 등록한 사용자 |
| 결함 담당자 | Assignee | - | 결함 수정을 배정받은 사용자 |
| 해결 방법 | Resolution | - | 결함의 종결 방식 (예: Fixed, Won't Fix, Duplicate, Cannot Reproduce, As Designed) |

### 4.1 Severity 상태값 (enum)

| 상태값 | 한국어 | 의미 |
| --- | --- | --- |
| Critical | 치명적 | 시스템 중단/데이터 손실 등 핵심 기능 사용 불가 |
| Major | 중대 | 주요 기능 장애이나 우회 방법이 제한적 |
| Minor | 경미 | 부가 기능 결함, 우회 가능 |
| Trivial | 사소 | 오타/UI 정렬 등 영향이 미미함 |

### 4.2 Priority 상태값 (enum)

| 상태값 | 한국어 | 의미 |
| --- | --- | --- |
| Urgent | 긴급 | 즉시 처리 필요 |
| High | 높음 | 우선 처리 대상 |
| Medium | 보통 | 일반 처리 |
| Low | 낮음 | 여유 시 처리 |

### 4.3 DefectStatus 상태값 (enum)

| 상태값 | 한국어 | 의미 |
| --- | --- | --- |
| New | 신규 | 등록되었으나 아직 검토되지 않음 |
| Open | 열림 | 검토 완료, 처리 대상으로 확정됨 |
| InProgress | 진행 중 | 담당자가 수정 작업 중 |
| Fixed | 수정됨 | 수정 완료, 검증 대기 |
| Verified | 검증됨 | 재테스트로 수정이 확인됨 |
| Closed | 종료 | 처리가 완전히 종결됨 |
| Reopened | 재오픈 | 종결되었으나 재발하여 다시 열림 |
| Rejected | 반려 | 결함이 아님/중복 등으로 처리하지 않음 |

---

## 5. 추적성 / 리포팅 (Traceability & Reporting)

| 한국어 | 영어 표준 | 약어 | 정의/설명 |
| --- | --- | --- | --- |
| 요구사항 | Requirement | REQ | 테스트가 검증해야 하는 기능/품질 요구사항. 테스트 케이스와 연결되어 추적성을 형성한다 |
| 추적성 매트릭스 | TraceabilityMatrix | RTM | 요구사항 ↔ 테스트 케이스 ↔ 결함 간 연결 관계를 행렬로 표현한 추적 자료 (Requirement Traceability Matrix) |
| 커버리지 | Coverage | - | 요구사항/기능 대비 테스트가 얼마나 검증하고 있는지의 비율. 요구사항 커버리지, 테스트 실행 커버리지 등을 포함 |
| 테스트 리포트 | TestReport | - | 테스트 계획/사이클의 실행 현황·결과·결함 통계를 집계한 보고 산출물 |
| 대시보드 | Dashboard | - | 테스트 진척/통과율/결함 추이 등 핵심 지표를 시각화한 화면 |
| 통과율 | PassRate | - | 전체 실행 대비 Pass 결과의 비율. 품질 지표의 핵심 값 |

---

## 6. 조직 / 공통 (Organization & Common)

| 한국어 | 영어 표준 | 약어 | 정의/설명 |
| --- | --- | --- | --- |
| 회사 | Company | - | **데이터 격리의 최상위 경계(테넌트)**. 하나의 Company는 여러 Workspace를 포함하며, 모든 도메인 데이터는 Company 단위로 1차 분리된다(공유 스키마 + `company_id`). 서로 다른 Company 간 데이터 접근은 금지된다 |
| 워크스페이스 | Workspace | WS | **Company 내부의 격리 중간 단위**. 하나의 Workspace는 여러 Project를 포함하며, 공유 스키마 + `workspace_id`로 격리된다 |
| 프로젝트 | Project | - | Workspace에 속하며, 테스트 자산(스위트/케이스/계획/결함)을 담는 작업 공간 단위. `project_id`로 격리 |
| 사용자 | User | - | 시스템에 인증되어 활동하는 주체. Company에 1:N 소속. 역할(Role)에 따라 권한이 달라진다 |
| 마스터 | Master | - | **시스템 전역 관리자**. Company 생성·비활성 권한 보유. `master_admins` 별도 테이블로 관리 |
| 역할 | Role | - | 사용자에게 부여되는 권한 집합. (User × Scope) 다중 부여 모델. 인가의 기준 |
| 권한 | Permission | - | 특정 기능/리소스에 대한 수행 가능 행위. 역할에 묶여 부여된다. 매트릭스 정본은 [`permissions.md`](permissions.md) |
| 라벨/태그 | Tag | - | 테스트 자산을 분류/필터링하기 위한 자유 키워드. 다대다로 부여 가능 |
| 첨부 | Attachment | - | 케이스/결함/실행 기록에 연결되는 파일(스크린샷, 로그 등) |
| 댓글 | Comment | - | 케이스/결함 등에 대한 협업용 의견/논의 기록 |
| 식별자 | Id | - | 엔티티를 유일하게 식별하는 값. 표기 변형(`~Id` 접미어 등)은 L1 규칙을 따른다 |

### 6.1 Role 표준값 (enum, v1.2)

3-tier 격리(Company → Workspace → Project)에 대응하는 6단 Role. **(User × Scope) 다중 부여** 모델.

| 상태값 | 한국어 | Scope | 의미 |
| --- | --- | --- | --- |
| Master | 마스터 | SYSTEM | 시스템 전역 관리자. Company 생성·비활성 |
| CO | 회사 관리자 | COMPANY | Company 1개의 관리자(Company Owner). 사용자 초대·탈퇴·비번리셋·전체조회, WS 비활성·소유자 이관, **사용자 Role 승격 권한(유일)**. Company당 N명 가능 |
| WO | 워크스페이스 관리자 | WORKSPACE | Workspace Owner. WS 생성(무제한), CO가 등록한 사용자를 WS에 초대, **본인 소유/멤버 WS 내 Project 생성·정보 수정·비활성** (컨테이너 한정, 내부 자산·멤버 초대는 별도 PO/Member Role 필요 — `permissions.md` §4.3 ★15) |
| PO | 프로젝트 관리자 | PROJECT | Project Owner. Project 멤버 초대, Project·TC·TestRun CRUD |
| Member | 멤버 | WORKSPACE + PROJECT | WS·Project 초대 시 기본 Role. WS Scope = 진입·메뉴 가시, Project Scope = 자산 생성·편집(생성해도 Member 유지) |
| Viewer | 뷰어 | WORKSPACE + PROJECT | CO 강등 전용 (초대 기본 Role 아님). 해당 Scope read-only |

> 권한 매트릭스(Action × Role)의 정본은 [`permissions.md`](permissions.md)이며, 본 표는 **용어와 Scope 매핑**만 정의한다. `user_roles` 테이블은 다형성 `(user_id, scope_type, scope_id)` 단일 행 라디오 모델 (락 v2.7).

---

## 부록 A. 동의어/금지어 정리

용어 난립을 막기 위해 동일 개념의 대체 표현을 정본으로 통일한다.

| 정본(사용) | 금지/대체될 표현 | 비고 |
| --- | --- | --- |
| Defect | Bug, Issue, Error | 결함의 정본은 `Defect`. 코드/UI/명세에서 통일 |
| TestRun | Execution, RunResult | 단일 실행 기록은 `TestRun` |
| TestCase | Testcase, Case, TC(축약 단독 사용) | 정본은 `TestCase`, 약어 `TC`는 등록된 맥락에서만 |
| ExpectedResult | Expected, Result(단독) | 기대 결과는 `ExpectedResult` |
| Assignee | Owner, Handler | 결함 담당자는 `Assignee` |

## 부록 B. 카테고리 요약

| 카테고리 | 정의된 용어 수 | 비고 |
| --- | --- | --- |
| 2. 테스트 설계 | 8 | TestCase, TestSuite, TestScenario, TestStep, Precondition, ExpectedResult, ActualResult, TestData |
| 3. 테스트 계획/실행 | 6 (+ ExecutionResult enum 6) | TestPlan, TestCycle, TestRun, ExecutionResult, TestEnvironment, Milestone |
| 4. 결함 관리 | 8 (+ Severity 4 / Priority 4 / DefectStatus 8 enum) | Defect, Severity, Priority, DefectStatus, ReproductionSteps, Reporter, Assignee, Resolution |
| 5. 추적성/리포팅 | 6 | Requirement, TraceabilityMatrix, Coverage, TestReport, Dashboard, PassRate |
| 6. 조직/공통 | 9 (+ Role enum 4) | Workspace, Project, User, Role, Permission, Tag, Attachment, Comment, Id |

## 부록 C. 문서 변경 이력

| 버전 | 일자 | 변경 내용 | 작성자 |
| --- | --- | --- | --- |
| v1.0 | 2026-06-02 | 최초 작성. 5개 카테고리 36개 용어 + 상태값 enum(ExecutionResult/Severity/Priority/DefectStatus/Role) 정의 | PM 에이전트 |
| v1.1 | 2026-06-03 | §6 조직/공통에 **Workspace(워크스페이스)** 용어 추가 — 데이터 격리 최상위 경계(공유 스키마 + `workspace_id`), Project는 Workspace에 속하도록 정의 수정 | PM 에이전트 |
| v1.2 | 2026-06-05 | **PM 락 v2 반영(3-tier 격리)**. ① §6에 **Company(회사)** 신규 추가 — 데이터 격리 최상위 경계(테넌트). Workspace는 Company 하위로 격하. ② §6에 **Master(마스터)** 추가 — 시스템 전역 관리자. ③ §6.1 **Role enum 6단으로 전면 교체** (Admin/Manager/Tester/Viewer → Master/CO/WO/PO/Member/Viewer), Scope 매핑 표 추가, (User × Scope) 다중 부여 모델 명시. ④ Role/Permission 정의에 `permissions.md` 매트릭스 정본 링크. 부록 B 카테고리 요약 갱신 필요(차기 갱신) | PM 에이전트 |
