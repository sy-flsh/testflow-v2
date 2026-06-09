# TMS 테스트 코드 정의서 (Test Standard)

| 항목 | 내용 |
| --- | --- |
| 문서명 | TMS 테스트 코드 정의서 (Test Standard) |
| 문서 버전 | v1.3 |
| 최초 작성일 | 2026-06-02 |
| 최종 개정일 | 2026-06-03 |
| 작성 주체 | QA 에이전트 |
| 문서 등급 | L1 (영역별 세부 표준) |
| 상위 문서 | `docs/standards/development-standard.md` (L0, PM) |
| 참조 정본 | `docs/standards/backend-coding-standard.md` (L1), `docs/standards/frontend-coding-standard.md` (L1), `docs/glossary.md` (도메인 용어 정본) |
| 적용 범위 | Backend / Frontend / E2E 테스트 전 영역 |

> 본 문서는 PM이 작성한 **개발 표준 정의서(L0)**의 품질 기준(특히 8장 품질 기준, 6장 리뷰/PR, 9장 보안/에러 처리)을 **테스트 관점에서 구체화**한 L1 정의서입니다.
> v1.1부터는 Backend 정의서(`backend-coding-standard.md`), Frontend 정의서(`frontend-coding-standard.md`), 도메인 용어 정본(`docs/glossary.md`)을 **정본으로 반영**합니다.
> L0와 충돌하는 내용이 있으면 L0가 우선하며, **도메인 용어에 한해서는 `glossary.md`가 우선**합니다(glossary §1.1). 충돌 발견 시 임의 해석하지 않고 PM에게 명확화를 요청합니다.

---

## 0. 전제 및 정본 반영 (Assumptions & Source of Truth)

v1.0 작성 시점에는 Backend/Frontend 정의서와 용어 사전이 부재하여 도구·용어·세부 규칙을 **가정값**으로 기술했습니다. v1.1에서는 아래 4개 문서가 모두 확정되었으므로 가정을 **정본 반영**으로 전환하고, 가정했던 스택을 실제 정의서와 정렬했습니다.

### 0.1 기술 스택 정렬 결과

| 영역 | v1.0 가정값 | v1.1 정본(반영) | 정합 여부 |
| --- | --- | --- | --- |
| Backend 언어/프레임워크 | Java/Kotlin + Spring 계열 | **Java 21 (LTS) + Spring Boot 3.x (Web MVC)** (L0 §2.4, backend §0) | 정렬됨 |
| Backend 빌드/데이터 접근 | (미상) | **Maven 3.9.x + Spring Data JPA(Hibernate)** (backend §0) | 정렬됨 |
| Backend 단위 테스트 | JUnit 5 + AssertJ + Mockito | **JUnit 5 + AssertJ + Mockito** (유지) | 정렬됨 |
| Backend 통합/슬라이스 | Spring Boot Test, Testcontainers, MockMvc/WebTestClient | **`@SpringBootTest` / `@WebMvcTest` + MockMvc / `@DataJpaTest` + Testcontainers** | 정렬됨(슬라이스 구체화) |
| Backend 커버리지 | JaCoCo | **JaCoCo** (backend §10) | 정렬됨 |
| Frontend 언어/프레임워크 | TypeScript + React 계열 | **TypeScript(strict) + React 18+** (frontend §0) | 정렬됨 |
| Frontend 단위/컴포넌트 | **Jest** + RTL | **Vitest + React Testing Library(RTL)** (frontend §0) | **변경**: Jest→Vitest |
| Frontend 빌드/패키지 | (미상) | **Vite + pnpm** (frontend §0) | 정렬됨 |
| Frontend API 모킹 | MSW | **MSW (Mock Service Worker)** (유지) | 정렬됨 |
| Frontend 서버 상태 | (미상) | **TanStack Query (React Query)** (frontend §4) | 정렬됨 |
| Frontend 전역 상태 | (미상) | **Zustand** (frontend §4) | 정렬됨 |
| Frontend 커버리지 | Jest coverage | **Vitest coverage (v8/istanbul)** | **변경**: Jest→Vitest |
| E2E | Playwright | **Playwright** (QA 확정) | 정렬됨 |
| CI | GitHub Actions | **GitHub Actions** (L0 §4.1) | 정렬됨 |

> 핵심 변경은 프론트엔드 테스트 러너가 **Jest → Vitest**로 확정된 점입니다. API 모킹(MSW), 테스트 라이브러리(RTL), 백엔드 도구군은 v1.0 가정과 일치합니다.

### 0.2 도메인 용어 정본 반영

v1.0의 예시는 운송/물류 성격의 `Task`/`Assignment`(배정·정산) 용어를 사용했으나, TMS는 **Test Management System(테스트 관리 도구)**입니다. v1.1에서는 모든 예시·시나리오·명세를 `glossary.md`의 PascalCase 표준 용어로 통일합니다.

| 사용한 정본 용어 | glossary 근거 | 비고 |
| --- | --- | --- |
| TestCase / TestSuite / TestScenario / TestStep | glossary §2 | 테스트 설계 자산 |
| TestPlan / TestCycle / TestRun / TestEnvironment / Milestone | glossary §3 | 계획·실행 |
| ExecutionResult (Pass/Fail/Blocked/Skipped/Untested/Retest) | glossary §3.1 | 실행 결과 enum |
| Defect / Severity / Priority / DefectStatus / Resolution | glossary §4 | 결함 관리 |
| DefectStatus (New/Open/InProgress/Fixed/Verified/Closed/Reopened/Rejected) | glossary §4.3 | 결함 상태 워크플로우 |
| Severity (Critical/Major/Minor/Trivial) / Priority (Urgent/High/Medium/Low) | glossary §4.1·§4.2 | 결함 분류 enum |
| Requirement / TraceabilityMatrix / Coverage / TestReport / PassRate | glossary §5 | 추적성·리포팅 |
| User / Role (Admin/Manager/Tester/Viewer) / Permission / Project | glossary §6 | 조직·인가 |

> 동의어 금지 규칙(glossary 부록 A)을 테스트 명세에도 적용합니다: 결함은 `Bug`가 아닌 **`Defect`**, 실행 기록은 `Execution`이 아닌 **`TestRun`**으로 표기합니다.

> 도구가 바뀌더라도 **테스트 전략·명명·구조·커버리지·CI 통합·결함 관리의 원칙은 동일하게 적용**됩니다. 도구명은 예시이며 원칙이 본 문서의 본질입니다.

---

## 1. 테스트 전략 개요 (Test Strategy Overview)

### 1.1 목표

- L0 8.3 품질 게이트(Definition of Done)를 테스트 관점에서 보증한다: "신규/변경 로직에 대응하는 테스트가 통과"한다.
- 빠른 피드백(단위 테스트 다수) + 충분한 신뢰(통합/E2E 소수)를 균형 있게 확보한다.
- 커버리지 수치(L0 8.1)를 충족하되, **수치보다 의미 있는 테스트를 우선**한다.

### 1.2 테스트 피라미드 (Test Pyramid)

테스트는 아래 비중으로 구성한다. 하위 계층(단위)이 넓고 빠르며, 상위 계층(E2E)은 좁고 핵심 흐름에 집중한다.

| 계층 | 정의 | 권장 비중 | 속도/안정성 | 도구(정본) |
| --- | --- | --- | --- | --- |
| 단위 (Unit) | 단일 클래스/함수/컴포넌트를 외부 의존성 격리하여 검증 | 약 70% | 매우 빠름 / 매우 안정 | JUnit 5 + AssertJ + Mockito / Vitest + RTL |
| 통합 (Integration) | 여러 구성요소·계층·외부자원(DB/API) 연동 검증 | 약 20% | 보통 / 보통 | `@SpringBootTest`/`@WebMvcTest`/`@DataJpaTest` + Testcontainers / MSW |
| E2E (End-to-End) | 실제 사용자 시나리오를 브라우저/시스템 전체로 검증 | 약 10% | 느림 / 취약(flaky 주의) | Playwright |

> 비중은 권장 기본값이며 도메인 위험도에 따라 조정한다. "역피라미드"(E2E 과다)는 금지한다 — 느리고 깨지기 쉬운 테스트가 피드백을 지연시킨다.

### 1.3 테스트 유형별 책임 매핑

| 검증 대상 | 우선 계층 | 보조 계층 |
| --- | --- | --- |
| 도메인 규칙/상태 전이 (예: `TestRun`의 `ExecutionResult` 전이, `Defect`의 `DefectStatus` 워크플로우) | 단위(domain) | 통합 |
| 유스케이스 오케스트레이션/트랜잭션 경계 (service 레이어) | 단위(서비스, 협력 Mock) | 통합 |
| 영속화/쿼리/매핑/낙관적 락/soft delete | 통합(`@DataJpaTest` + Testcontainers) | - |
| API 계약(요청 검증/직렬화/상태코드/에러 스키마) | 통합(`@WebMvcTest` 슬라이스) | E2E |
| 프론트 상태(서버/전역/지역/URL)·훅·스토어 | 단위 | 통합 |
| 화면 동작/사용자 인터랙션/접근성 | 단위(컴포넌트, RTL) | E2E |
| 핵심 사용자 여정(로그인→TestCase 작성→TestSuite 구성→TestRun 실행→Defect 등록) | E2E | 통합 |
| 보안/인가(Role 기반)/에러 처리(L0 9장) | 단위+통합 | E2E |

---

## 2. 테스트 범위 / 대상 (Test Scope & Targets)

### 2.1 Backend 테스트 대상

Backend 정의서 §2.1 레이어 구조(Presentation `web`/`controller` → Application `service` → Domain `domain` → Infrastructure `repository`/`infra`, 횡단 `common`)에 맞춰 계층별 테스트 대상·유형·경계를 정의한다.

| 레이어(backend §2.1) | 테스트 대상 | 테스트 유형 | 격리/구동 방식 |
| --- | --- | --- | --- |
| Domain (`domain`) | 엔티티(`TestCase`, `TestRun`, `Defect`), VO, 도메인 규칙/불변식, 상태 전이 메서드 | 단위 | 외부 의존성 없음(순수 POJO). **Mock 금지** |
| Application (`service`) | 유스케이스 오케스트레이션, 트랜잭션 경계, Role 기반 권한 검증 | 단위 | 협력 객체(Repository/Mapper)는 Mockito Mock |
| Infrastructure (`repository`) | 리포지토리 쿼리/매핑, N+1, fetch join, `@Version` 낙관적 락, soft delete, `EnumType.STRING` 저장 | 통합 | `@DataJpaTest` + **Testcontainers 실제 DB**(PostgreSQL) |
| Presentation (`web`/`controller`) | 요청 검증(`@Valid`), 직렬화, HTTP 상태코드, **표준 에러 응답 스키마** | 통합(슬라이스) | `@WebMvcTest` + MockMvc, 하위 서비스는 `@MockBean` |
| 전체 와이어링/통합 흐름 | 컨트롤러→서비스→리포지토리 실제 연동, 트랜잭션 롤백, 인증/인가 필터 | 통합 | `@SpringBootTest` + Testcontainers (핵심 흐름 한정) |
| 외부 연동 | 외부 API 클라이언트, 메시징(있을 경우) | 통합 | WireMock/스텁 서버 |
| 횡단(`common`) | `GlobalExceptionHandler`, `ErrorCode` 매핑, `CorrelationIdFilter`(traceId/MDC) | 통합(슬라이스) | `@WebMvcTest` 또는 필터 단위 |

**계층별 경계 원칙(backend §2.1·§4.4·§7.1 정합):**
- **엔티티를 컨트롤러 입출력으로 직접 검증하지 않는다.** 컨트롤러 테스트는 DTO(`~Request`/`~Response`)와 JSON 직렬화 결과를 검증한다(backend §4.4).
- **트랜잭션 경계는 서비스 레이어**이므로(backend §7.1), 트랜잭션 롤백/일관성은 서비스 또는 `@SpringBootTest` 통합 테스트에서 검증한다. 컨트롤러/리포지토리 단독 테스트로 트랜잭션을 검증하지 않는다.
- 상태 변경은 도메인 메서드로만 일어나므로(backend §7.2, setter 남용 금지), 상태 전이 검증은 도메인 단위 테스트가 1차 책임을 진다.

### 2.2 Frontend 테스트 대상

Frontend 정의서 §2(폴더/feature 구조)·§4(상태 분류)·§5(API 연동 계층)에 맞춰 테스트 대상을 정의한다. L0 8.1에 따라 **로직(상태/유틸)을 우선 대상**으로 하고 순수 마크업은 예외로 둔다.

| 분류(frontend 근거) | 테스트 대상 | 테스트 유형 | 격리/모킹 방식 |
| --- | --- | --- | --- |
| 순수 유틸 (`utils/`, frontend §2.4) | 포맷터(`formatDate`), DTO→도메인 매퍼(`toTestCase`), 계산 | 단위(Vitest) | 부수효과 없음 → 직접 입력/출력 검증 |
| 지역 상태 (frontend §4.1 Local) | `useState`/`useReducer` 기반 컴포넌트 내부 상태 | 단위(컴포넌트, RTL) | 렌더 후 사용자 인터랙션으로 검증 |
| 서버 상태 (frontend §4.1 Server) | TanStack Query 쿼리/뮤테이션 훅(`useTestCaseList`) | 단위/통합 | **MSW로 HTTP 레벨 모킹** + `QueryClientProvider` 래퍼 |
| 전역 클라이언트 상태 (frontend §4.1 Global) | Zustand store slice(인증/테마/토스트)의 액션·셀렉터 | 단위 | store 단위 테스트(액션 호출 → 상태 검증) |
| URL 상태 (frontend §4.1 URL) | 필터/페이지/탭 쿼리스트링 동기화 | 통합 | 라우터 래퍼(`MemoryRouter`)로 경로 검증 |
| API 함수 계층 (frontend §5.1) | `testCaseApi.fetchTestCases` 요청/응답 타입, DTO→모델 가공 | 단위/통합 | MSW로 응답 스텁, 매퍼 결과 검증 |
| 공용 컴포넌트 (`components/`) | 조건부 렌더링, 인터랙션, 접근성(a11y) | 컴포넌트(단위, RTL) | props만으로 구동, **동작 기반 검증** |
| 도메인 컴포넌트 (`features/*/components/`) | `DefectStatusBadge`, `TestRunResultCell` 등 도메인 결합 UI | 컴포넌트(단위, RTL) | 필요한 훅/스토어만 모킹 |
| 라우팅/화면 흐름·가드 | 페이지 전환, Role 기반 라우트 가드 | 통합/E2E | - |

**프론트 테스트 원칙(frontend §4.2·§5 정합):**
- **서버 상태와 클라이언트 상태를 혼동하지 않는다**(frontend §4.2). 서버 데이터 훅은 MSW로 네트워크를 모킹하고, 전역 store는 store 단위로 분리 테스트한다. 서버 데이터를 store로 복제하는 테스트 패턴을 작성하지 않는다.
- 컴포넌트는 **구현 디테일이 아닌 관찰 가능한 동작**을 RTL의 role/label 쿼리로 검증한다(접근성 쿼리 우선).
- 모든 비동기 화면은 **loading / empty / error 3상태**를 각각 테스트한다(frontend §5.3).

### 2.3 E2E 테스트 대상

- 비즈니스 임팩트가 큰 **핵심 사용자 여정(Critical User Journey)**에 한정한다.
- 표준 시나리오: **사용자 인증(Role: Tester) → TestCase 작성 → TestSuite 구성 → TestPlan/TestCycle 내 TestRun 실행(ExecutionResult 기록) → Fail 결과로부터 Defect 등록 → Defect 재테스트(Retest)·검증(Verified)** 흐름.
- 모든 분기를 E2E로 검증하지 않는다(분기는 단위/통합이 담당).

### 2.4 테스트 제외 대상 (Out of Scope)

| 제외 대상 | 사유 |
| --- | --- |
| 자동 생성 코드(빌드 산출물, MapStruct 생성 매퍼, OpenAPI 생성물) | 검증 가치 낮음, 커버리지 산정 제외(backend §0) |
| 단순 위임/게터·세터, 불변 DTO(`record`) | L0 8.1 "단순 위임/설정 코드 예외" |
| 순수 UI 마크업(로직 없는 정적 표시) | L0 8.1 "순수 UI 마크업 예외" |
| 프레임워크/서드파티 라이브러리 내부 | 신뢰 가능 외부 책임 |
| 설정/상수 파일(`~Config`, `~Constants`, 디자인 토큰) | 로직 부재 |

---

## 3. 테스트 명명 규칙 (Test Naming Convention)

L0 3장 명명 원칙과 backend §1·frontend §1의 표기 규칙, glossary 도메인 용어를 테스트에 적용한다. **테스트 이름은 "무엇을 검증하는가"를 명확히 드러내야** 하며, 도메인 용어는 정본 표기를 사용한다.

### 3.1 파일/클래스 명명

| 영역 | 규칙 | 예시 |
| --- | --- | --- |
| Backend 단위 테스트 | `<대상클래스>Test` | `TestRunServiceTest`, `DefectTest` |
| Backend 슬라이스/통합 | `<대상>IntegrationTest` 또는 `~IT` | `TestCaseRepositoryIntegrationTest`, `DefectControllerIT` |
| Frontend 단위/컴포넌트 | 원본명 + `.test.ts(x)` (frontend §1.1, co-located) | `formatTestRunDate.test.ts`, `DefectStatusBadge.test.tsx` |
| Frontend 훅/스토어 | `use<도메인>.test.ts`, `<store>.test.ts` | `useTestCaseList.test.ts`, `authStore.test.ts` |
| E2E 스펙 | `<시나리오>.spec.ts` | `testrun-execution.spec.ts`, `defect-workflow.spec.ts` |

> Backend는 소스 패키지를 미러링하여 `src/test/java/com/unione/tms/<도메인>/...`에 배치한다(backend §2.2 도메인 우선 패키징). 도메인 패키지명은 glossary 용어(`testcase`, `testrun`, `defect`, `user`)를 따른다.

### 3.2 테스트 메서드/케이스 명명 — given-when-then

테스트 케이스 명명은 **given-when-then 패턴**(조건-행위-기대결과)을 표준으로 한다.

**Backend (JUnit 5, `@DisplayName` 권장)**

```java
// 메서드명: {대상행위}_{조건}_{기대결과}, @DisplayName은 한글 서술
@Test
@DisplayName("Untested 상태의 TestRun을 Pass로 기록하면 ExecutionResult가 Pass로 전이된다")
void recordResult_givenUntestedTestRun_thenResultBecomesPass() { ... }

@Test
@DisplayName("이미 Closed된 Defect를 다시 Closed로 전이하면 충돌 예외(409)가 발생한다")
void changeStatus_givenClosedDefect_thenThrowsConflict() { ... }
```

> 한글 `@DisplayName`을 1순위 가독성 수단으로, 영문 메서드명으로 검색 가능성을 확보한다(backend §1.1 lowerCamelCase 메서드 규칙). 도메인 용어(`TestRun`, `ExecutionResult`, `Defect`)는 정본 PascalCase로 표기한다.
> 중첩 구조가 필요하면 `@Nested` + 한글 `@DisplayName`("~할 때")으로 given 컨텍스트를 그룹화한다.

**Frontend (Vitest, `describe`/`it`)**

```ts
describe('DefectStatusBadge', () => {
  it('DefectStatus가 InProgress이면 진행 중 배지를 표시한다', () => { ... });
  it('상태 변경 버튼 클릭 시 onChangeStatus 콜백을 호출한다', () => { ... });
});

describe('useTestCaseList', () => {
  it('TestSuite 필터로 TestCase 목록을 조회한다', () => { ... });
  it('서버 오류 시 error 상태를 노출한다', () => { ... });
});
```

### 3.3 명명 원칙 요약

| 원칙 | 내용 |
| --- | --- |
| 행위 중심 | 메서드/함수명이 아니라 "동작과 기대 결과"를 서술한다 |
| 조건 명시 | given(전제 조건)을 이름에 드러낸다 |
| 정본 용어 | 도메인 용어는 glossary 표준 표기(`TestCase`, `TestRun`, `Defect`, `ExecutionResult` 등) 사용. `Bug`/`Execution` 등 금지어 사용 금지(glossary 부록 A) |
| 부정 회피 | L0 3.1에 따라 이중 부정 명명을 피한다 |
| 한 케이스 한 명세 | 하나의 테스트는 하나의 행위/결과만 검증 |

---

## 4. 테스트 코드 작성 규칙 (Test Code Conventions)

### 4.1 구조 — AAA / Given-When-Then 패턴

모든 테스트는 **Arrange-Act-Assert(준비-실행-검증)** 3단 구조를 따른다. 단계 사이에 빈 줄 또는 주석으로 구분한다.

```java
@Test
@DisplayName("Fail로 종료된 TestRun으로 Defect를 등록하면 상태가 New가 된다")
void registerDefect_givenFailedTestRun_thenDefectStatusIsNew() {
    // given (Arrange)
    TestRun failedRun = TestRunFixture.withResult(ExecutionResult.FAIL);
    RegisterDefectCommand command = DefectFixture.commandFrom(failedRun);

    // when (Act)
    Defect defect = defectService.register(command);

    // then (Assert)
    assertThat(defect.getStatus()).isEqualTo(DefectStatus.NEW);
    assertThat(defect.getSourceTestRunId()).isEqualTo(failedRun.getId());
}
```

| 단계 | 책임 |
| --- | --- |
| Arrange (given) | 테스트 대상과 입력/Mock 동작을 준비 |
| Act (when) | 검증 대상 행위를 **단 한 번** 실행 |
| Assert (then) | 결과/상태/상호작용을 검증 |

### 4.2 단언(Assertion) 규칙

| 규칙 | 내용 |
| --- | --- |
| 의미 있는 단언 | 호출만 하고 검증 없는 테스트(no-assert) 금지 |
| 단일 개념 검증 | 하나의 테스트는 하나의 논리적 결과를 검증(연관 필드 묶음은 허용) |
| 풍부한 메시지 | 단언 실패 시 원인이 드러나도록 fluent 단언(AssertJ / `@testing-library/jest-dom` matcher) 사용 |
| 정확한 비교 | 부동소수/시간은 허용 오차/고정 시계(`Clock`) 사용 |
| enum 비교 | 상태 검증은 정본 enum 값(`ExecutionResult.PASS`, `DefectStatus.VERIFIED`)으로 비교, 문자열 매직값 금지 |

### 4.3 Mock / Stub 사용 기준

| 상황 | 권장 |
| --- | --- |
| 외부 시스템(DB/네트워크/시간/랜덤) | Mock/Stub 또는 제어 가능한 추상화로 격리 |
| 순수 도메인 로직(`domain`) | **Mock 사용 금지** — 실제 객체로 검증(backend §2.1 도메인 독립성) |
| 서비스 레이어 단위 테스트 | 협력 Repository/Mapper는 Mockito Mock, 트랜잭션은 통합에서 검증 |
| 통합 테스트의 DB | Mock 대신 **실제 DB(Testcontainers + `@DataJpaTest`)** 사용 |
| 컨트롤러 슬라이스 | 하위 서비스는 `@MockBean`, HTTP 계약은 MockMvc로 실제 직렬화 검증 |
| Frontend 서버 상태/네트워크 | **MSW로 HTTP 레벨 모킹**(axios/fetch 직접 모킹보다 우선, frontend §5.1) |
| Frontend 전역 store | 실제 store 사용(액션→상태 검증), 과도한 모킹 지양 |
| 상호작용 검증(behavior) | 협력 호출 검증이 핵심일 때만 `verify` 사용. 상태 검증 우선 |

**원칙**: 구현 디테일이 아니라 **관찰 가능한 동작**을 검증한다. 과도한 Mock은 리팩터링 시 깨지는 취약 테스트를 만든다.

### 4.4 테스트 데이터 / Fixture 관리

| 규칙 | 내용 |
| --- | --- |
| Fixture 빌더 | 객체 생성은 도메인별 빌더/팩토리(`TestCaseFixture`, `TestRunFixture`, `DefectFixture`)로 중앙화 |
| 도메인 메서드 사용 | 엔티티 setter 남용 금지(backend §7.2). Fixture도 정적 팩토리/빌더·도메인 메서드로 상태를 구성 |
| 의미 있는 기본값 | 빌더는 유효한 기본값(예: `DefectStatus.NEW`)을 제공하고, 테스트는 **관련 필드만 오버라이드** |
| 격리 | 테스트 간 상태 공유 금지. 통합 테스트는 트랜잭션 롤백 또는 데이터 초기화로 독립성 보장 |
| 매직값 금지 | enum/상수/명명 변수 사용(L0 3장, backend §3.1 매직 넘버 금지) |
| 시간 고정 | `Clock`/고정 타임존 주입으로 시간 의존 테스트의 결정성 확보(감사 필드 `createdAt`/`updatedAt` 검증 시 필수) |
| 무작위성 제거 | 랜덤 시드 고정 또는 결정적 입력 사용 |
| 프론트 Fixture | DTO 픽스처(`TestCaseDto`)와 도메인 모델 픽스처(`TestCase`)를 분리하고 매퍼(`toTestCase`)로 변환 검증(frontend §5.2) |

### 4.5 테스트 품질 원칙 (FIRST)

| 원칙 | 의미 |
| --- | --- |
| Fast | 빠르게 실행 (단위 테스트는 ms 단위) |
| Independent | 테스트 간 순서/상태 독립 |
| Repeatable | 어느 환경에서도 동일 결과(시간/네트워크 비의존) |
| Self-validating | 통과/실패가 자동 판정(수동 확인 불필요) |
| Timely | 코드와 함께(또는 직후) 작성 |

### 4.6 안티패턴 (금지)

- flaky 테스트(간헐 실패) 방치 — 즉시 격리/수정한다.
- `sleep` 기반 대기 — 명시적 조건 대기(`Awaitility` / RTL `waitFor`)로 대체.
- 테스트 안의 분기/반복으로 로직 복제 — 데이터 주도 테스트(`@ParameterizedTest` / `it.each`)로 표현. (예: `ExecutionResult` 6값, `DefectStatus` 전이 매트릭스)
- 한 테스트에서 다수 시나리오 검증 — 분할.
- 프로덕션 코드에 테스트 전용 분기 삽입.
- 서버 데이터를 전역 store로 복제하는 테스트(frontend §4.2 위반).
- 엔티티를 컨트롤러 응답으로 직접 검증(backend §4.4 위반).

### 4.7 보안/에러 시나리오 테스트 (L0 9장 · backend §5 연계)

L0 10장 매핑(QA: "보안/에러 시나리오 테스트")과 backend §5(예외/ErrorCode/표준 에러 스키마)에 따라 다음을 **필수 테스트 케이스**로 포함한다.

| 근거 | 필수 테스트 케이스 |
| --- | --- |
| L0 9.1 입력 신뢰 금지 / backend §4.4 | 잘못된/누락/형식 위반 요청(`@Valid` 위반)이 `400 Bad Request`로 거부되고 `errors[]`(field/reason)가 채워지는지 |
| backend §4.3 검증 의미 오류 | 형식은 맞으나 규칙 위반(예: 이미 Closed인 Defect 재종결)이 `409 Conflict`/`422`로 응답되는지 |
| L0 9.1 인가 / glossary Role | 권한 없는 Role(예: `Viewer`)의 쓰기 접근이 `403 Forbidden`, 미인증이 `401 Unauthorized`로 분리 차단되는지(backend §4.3) |
| L0 9.1 워크스페이스 격리 / backend §7.5 | **다른 Workspace 리소스 접근이 차단**되는지(목록 조회는 현재 `workspace_id`로만 필터, 타 워크스페이스 단건 접근은 `404`/`403`), 생성 시 `workspace_id`가 인증 컨텍스트로 강제 주입되어 클라이언트 위조가 무효화되는지(`@SpringBootTest` 통합) |
| backend §4.5/§5.3 공용 응답 래퍼 | 모든 응답이 공용 래퍼(`success`/`code`/`message`/`data`)를 따르고, 에러 시 `success=false`+진단 필드(`traceId`/`timestamp`/`path`/선택 `errors`)가 추가되는지 |
| backend §5.2 ErrorCode 체계 | `code`가 **문자열 의미 코드 `{DOMAIN}_{상황}`**(예: `TESTCASE_NOT_FOUND`, `DEFECT_INVALID_STATUS_TRANSITION`, `AUTH_FORBIDDEN`, `COMMON_INVALID_INPUT`)이고, HTTP 상태와 매핑이 일치하는지 |
| L0 9.3 내부 정보 비노출 / backend §5.3 | 에러 응답에 스택트레이스/SQL/내부 클래스명이 **노출되지 않는지** |
| backend §6.3 traceId | 응답 `traceId`가 MDC/응답 헤더와 동일하고, 상관관계 추적이 가능한지 |
| L0 9.2 민감정보 제외 | 로그/응답에 시크릿·개인정보가 마스킹되는지 |
| L0 9.3 데이터 일관성 / backend §7.1 | 서비스 실패 시 트랜잭션이 롤백되어 일관성이 보존되는지(`@SpringBootTest` 통합) |
| frontend §5.3 에러 처리 | 백엔드 표준 에러 스키마가 인터셉터에서 `AppError`로 정규화되고, 에러 코드→사용자 메시지 매핑/폴백이 동작하며, Error Boundary가 화이트스크린을 방지하는지(MSW로 에러 응답 스텁) |

**공용 응답 래퍼 + 에러 진단 필드 검증 예시 (backend §4.5/§5.3)**

```java
@Test
@DisplayName("존재하지 않는 TestCase 조회 시 공용 래퍼 + 진단 필드로 404를 응답한다")
void getTestCase_givenMissingId_thenStandardErrorResponse() throws Exception {
    mockMvc.perform(get("/api/v1/test-cases/{id}", 999L))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.success").value(false))
        .andExpect(jsonPath("$.code").value("TESTCASE_NOT_FOUND"))   // 문자열 의미 코드
        .andExpect(jsonPath("$.message").exists())
        .andExpect(jsonPath("$.data").doesNotExist())               // 에러 시 data=null
        .andExpect(jsonPath("$.traceId").exists())
        .andExpect(jsonPath("$.timestamp").exists())
        .andExpect(jsonPath("$.path").value("/api/v1/test-cases/999"))
        // 내부 정보 비노출 검증
        .andExpect(jsonPath("$.stackTrace").doesNotExist());
}
```

---

## 5. 커버리지 기준 (Coverage Standard)

L0 8.1의 목표 수치를 **그대로 계승**하고, QA 관점에서 측정 도구·예외·게이트 동작을 구체화한다. (backend §10·frontend §9와 정합)

### 5.1 목표 커버리지 (L0 8.1 일관 — 변경 없음)

| 영역 | 라인/구문 커버리지 목표 | 측정 도구(정본) | 비고 |
| --- | --- | --- | --- |
| Backend 핵심 도메인 로직 | **80% 이상** | JaCoCo | 비즈니스 규칙(상태 전이 등) 최우선 |
| Backend 전체 | **70% 이상** | JaCoCo | 단순 위임/설정 코드 예외 가능 |
| Frontend 로직(상태/유틸) | **70% 이상** | Vitest coverage(v8/istanbul) | 순수 UI 마크업 예외 가능 |
| 신규/변경 코드 (Patch coverage) | **80% 이상** | JaCoCo / Vitest + diff 기반 도구 | PR 단위 신규 코드에 강하게 적용 |

> 본 표는 L0 8.1 및 backend §10·frontend §9와 수치적으로 동일하다. 충돌 시 L0가 우선한다. **수치는 변경하지 않는다.**

### 5.2 커버리지 측정 및 게이트

| 항목 | 정책 |
| --- | --- |
| 측정 기준 지표 | 라인(Line) + 구문/분기(Branch) 커버리지. 분기는 보조 지표로 모니터링 |
| 전체 게이트 | 위 5.1 전체 목표 미달 시 CI 경고. 단계적 상향(점진 도입 시) 허용 |
| 신규/변경 코드 게이트 | **Patch/Diff 커버리지 80% 미달 시 PR 머지 차단** (가장 강하게 적용) |
| 커버리지 하락 방지 | 전체 커버리지가 기준선 대비 하락하면 PR 차단(coverage regression 금지) |
| 리포트 | CI에서 커버리지 리포트(JaCoCo XML/HTML, Vitest lcov) 산출 및 PR 코멘트 게시 |

### 5.3 커버리지 예외 규칙

다음은 커버리지 산정에서 **제외**할 수 있다(2.4 제외 대상과 일관).

| 예외 대상 | 처리 |
| --- | --- |
| 자동 생성 코드(MapStruct/OpenAPI 생성물) | 측정 제외 설정(JaCoCo exclude / Vitest `coverage.exclude`) |
| 불변 DTO(`record`)/단순 게터·세터·`~Config` | 제외 가능 |
| 순수 UI 마크업/디자인 토큰 | 제외 가능 |
| `TmsApplication`/부트스트랩 진입점 | 제외 가능 |
| 의도적 제외 라인 | 코드 주석 근거(`// reason`) 또는 이슈 참조와 함께 명시. 무분별한 제외 금지 |

### 5.4 커버리지 해석 원칙

> **커버리지는 목표가 아니라 신호다.** L0 8.1 "커버리지는 목표일 뿐 맹신하지 않으며, 의미 있는 테스트를 우선한다"를 준수한다. 단언 없는 테스트로 수치를 채우는 행위를 금지하며 리뷰에서 차단한다.

> 본 5장의 "커버리지(Coverage)"는 **코드 커버리지**를 의미한다. glossary §5의 **요구사항 커버리지(Requirement Coverage, RTM 기반)**와는 구분되며, 후자는 7장(추적성)에서 다룬다.

---

## 6. 테스트 실행 / CI 통합 (Test Execution & CI Integration)

### 6.1 테스트 디렉터리 구조 (L0 4장 · backend §2.2 · frontend §2 연계)

| 영역 | 위치(정본) | 비고 |
| --- | --- | --- |
| Backend 단위/통합 | `/backend/src/test/java/com/unione/tms/<도메인>/...` (소스 미러링) | 통합은 `*IntegrationTest`/`*IT`로 분리. 도메인 폴더는 `testcase`/`testrun`/`defect`/`user` |
| Frontend 단위/컴포넌트 | 대상 파일 co-located `*.test.tsx`(권장) 또는 `/frontend/tests` | feature 내부 구조(`features/<도메인>/...`)에 인접 배치 |
| E2E | `/e2e` 또는 `/frontend/e2e` | Playwright 프로젝트 분리 |
| 공용 Fixture/유틸 | 각 영역 `test` 하위 공통 폴더(백엔드), `tests/fixtures`(프론트) | 중복 금지(L0 4.3) |

### 6.2 실행 시점 (When to Run)

| 시점 | 실행 범위 | 목적 |
| --- | --- | --- |
| 로컬 개발 | 변경 관련 단위 테스트 + 린트 | 빠른 피드백 |
| Pre-commit/Pre-push(권장) | 단위 테스트 + 린트/포맷(Spotless/ESLint+Prettier) + `tsc --noEmit` | 깨진 커밋 방지(L0 5.2, frontend §9) |
| PR(필수, CI) | 단위 + 통합 + 커버리지 + 정적분석 + 보안 스캔 | 머지 게이트(L0 6.1) |
| main 머지 후 | 전체 + E2E(핵심 시나리오) | 통합 회귀 검증 |
| 야간/정기(Nightly) | 전체 E2E + 느린/광범위 스위트 | 안정성/회귀 모니터링 |

### 6.3 CI 파이프라인 단계 (게이트)

L0 6.1 "모든 자동 검사(빌드/테스트/린트)가 통과해야 리뷰 요청 가능" 및 8.3 품질 게이트를 구현한다.

| 순서 | 단계 | 도구(정본) | 실패 시 |
| --- | --- | --- | --- |
| 1 | 빌드/컴파일 (경고 0건, L0 8.2) | Maven(BE) / Vite build·`tsc --noEmit`(FE) | 차단 |
| 2 | 린트/포맷 검사 (L0 8.2) | Spotless/Checkstyle(BE) / ESLint+Prettier(FE) | 차단 |
| 3 | 단위 테스트 | JUnit 5(BE) / Vitest(FE) | 차단 |
| 4 | 통합 테스트 | `@SpringBootTest`/`@DataJpaTest`+Testcontainers(BE) / MSW(FE) | 차단 |
| 5 | 커버리지 측정 + 게이트 (5.2) | JaCoCo / Vitest coverage | 신규코드 미달 시 차단 |
| 6 | 정적 분석 (잠재 버그/복잡도) | SpotBugs/PMD(BE) / ESLint 룰(FE) | High↑ 차단(L0 8.2) |
| 7 | **SAST(정적 보안 분석)** | **Sparrow** (BE Java / FE JS·TS 공통) | High↑ 차단(backend §8.1·§10, frontend §9) |
| 8 | 의존성 취약점 스캔 | (BE/FE 공통) | High↑ 차단(L0 8.2) |
| 9 | E2E (PR은 핵심만/스모크, main은 전체) | Playwright | 차단 |

### 6.4 실패 처리 정책 (Failure Policy)

| 정책 | 내용 |
| --- | --- |
| Red build 금지 | `main`은 항상 green 유지. 실패 빌드는 최우선 복구 |
| 머지 차단 | CI 실패 시 머지 불가(L0 6.4 머지 전제) |
| flaky 격리 | 간헐 실패 테스트는 즉시 `@Disabled`/`it.skip` + 이슈 등록 후 수정. 방치 금지 |
| 재시도 정책 | E2E 한정 자동 재시도(최대 1~2회) 허용. 단위/통합은 재시도 금지(결정성 우선) |
| 실패 가시성 | 실패 로그/리포트/스크린샷(Playwright trace)을 CI 아티팩트로 보존 |

---

## 7. 결함 관리 / 리포트 기준 (Defect Management & Reporting)

> 본 장의 결함 용어·상태값은 glossary §4를 정본으로 한다. 결함은 **`Defect`**로 표기하며 `Bug`/`Issue`/`Error`는 금지어이다(glossary 부록 A).

### 7.1 결함 심각도 분류 (Severity — glossary §4.1)

| Severity | 한국어 | 정의(glossary) | 대응 |
| --- | --- | --- | --- |
| Critical | 치명적 | 시스템 중단/데이터 손실 등 핵심 기능 사용 불가 | 즉시 hotfix(L0 5.1), 릴리스 차단 |
| Major | 중대 | 주요 기능 장애, 우회 제한적 | 해당 릴리스 내 수정 |
| Minor | 경미 | 부가 기능 결함, 우회 가능 | 백로그 우선순위화 |
| Trivial | 사소 | 오타/UI 정렬 등 영향 미미 | 여유 시 처리 |

### 7.2 결함 우선순위 (Priority — glossary §4.2)

Severity와 별개로 처리 시급성을 결정한다: `Urgent / High / Medium / Low`(glossary §4.2). PM이 심각도·비즈니스 영향 기준으로 조정한다(L0 2.3 PM 책임).

### 7.3 결함 상태 워크플로우 (DefectStatus — glossary §4.3) 및 검증

결함 상태는 glossary §4.3의 enum을 정본으로 한다. QA는 **상태 전이가 워크플로우 규칙을 따르는지**를 도메인 단위 테스트로 검증한다.

| DefectStatus | 의미 | 허용 전이(예시 규칙) |
| --- | --- | --- |
| New | 등록·미검토 | → Open, Rejected |
| Open | 처리 대상 확정 | → InProgress, Rejected |
| InProgress | 수정 작업 중 | → Fixed |
| Fixed | 수정 완료·검증 대기 | → Verified, Reopened |
| Verified | 재테스트로 수정 확인 | → Closed, Reopened |
| Closed | 완전 종결 | → Reopened |
| Reopened | 재발로 재오픈 | → InProgress |
| Rejected | 결함 아님/중복 등 | (종결) |

**필수 검증 케이스(상태 전이):**
- 정상 전이: `New → Open → InProgress → Fixed → Verified → Closed`가 각 단계에서 허용된다.
- 비정상 전이: 허용되지 않은 전이(예: `New → Closed`, `Closed → New`)는 충돌 예외(409, `ErrorCode` 매핑)로 거부된다.
- 재오픈 루프: `Closed → Reopened → InProgress`가 동작하고 이력이 보존된다.
- Resolution 종결: 종결 시 `Resolution`(Fixed/Won't Fix/Duplicate/Cannot Reproduce/As Designed, glossary §4)이 기록된다.

### 7.4 결함 → TestRun 연계 검증

- `TestRun`의 `ExecutionResult`가 **Fail**일 때만 해당 실행으로부터 `Defect`를 등록할 수 있는지 검증한다.
- `Defect`가 `Verified`로 전이되려면 연계된 `TestRun`이 **Retest → Pass**로 재실행되어야 함을 통합/E2E로 검증한다(glossary §3.1 Retest, §4.3 Verified 정합).

### 7.5 결함 리포트 필수 항목

| 항목 | 내용(정본 용어) |
| --- | --- |
| 제목 | 증상 요약(의미 기반, L0 3장) |
| 환경 | TestEnvironment(버전/브랜치/dev·staging·prod) |
| 재현 절차 | ReproductionSteps(단계별, 입력/TestData 포함) |
| 기대 결과 / 실제 결과 | ExpectedResult / ActualResult 대비(glossary §2) |
| Severity / Priority | 7.1 / 7.2 기준(glossary enum) |
| 연계 | 발생 TestRun, 관련 TestCase, Requirement(추적성) |
| 증거 | 로그(traceId 포함, L0 9.2 / backend §6.3), 스크린샷, 실패 테스트 링크 |
| 관련 이슈/커밋 | `Refs: TMS-###` (L0 5.2) |

> 결함 리포트에는 **민감정보/시크릿을 포함하지 않는다**(L0 9.1/9.2). 로그 첨부 시 마스킹 여부를 확인한다.

### 7.6 결함 → 회귀 테스트 (Regression)

| 규칙 | 내용 |
| --- | --- |
| 재발 방지 | 수정된 Defect는 **반드시 그 Defect를 재현하는 회귀 테스트**를 추가한 뒤 닫는다 |
| 테스트 우선 | 가능하면 실패하는 테스트를 먼저 작성(red) → 수정(green) |
| 커밋 연계 | 수정 커밋은 `fix` type + Defect 이슈 참조(L0 5.2) |

### 7.7 품질 리포트 (Quality Reporting)

| 리포트 | 주기 | 내용(정본 용어) |
| --- | --- | --- |
| CI 테스트 리포트 | PR/머지마다 | 통과/실패 수, 실행 시간, 코드 커버리지(5.2) |
| 커버리지 추이 | 정기 | 영역별 코드 커버리지 변화 + 요구사항 커버리지(RTM, glossary §5) |
| 결함 현황 | 스프린트/릴리스 | Severity/DefectStatus별 미해결 건수, 평균 해결 시간 |
| 실행 현황 | TestCycle 종료 시 | ExecutionResult 분포, PassRate(glossary §5), TestReport 산출 |
| 릴리스 품질 게이트 | 릴리스 전 | L0 8.3 DoD 충족 여부 체크 |

---

## 8. 품질 게이트 체크리스트 (Definition of Done — 테스트 관점)

L0 8.3 및 6.2 리뷰 체크리스트의 "테스트" 항목을 PR 단위로 점검한다.

- [ ] 신규/변경 로직에 대응하는 테스트가 존재하고 통과한다 (L0 8.3).
- [ ] 테스트가 명명 규칙(3장)과 AAA/given-when-then 구조(4장)를 따르며, 도메인 용어를 glossary 정본 표기로 사용한다.
- [ ] 신규/변경 코드 커버리지가 80% 이상이다 (5.1).
- [ ] 전체 커버리지가 기준선 대비 하락하지 않는다 (5.2).
- [ ] 보안/에러 시나리오 테스트가 포함되었다 — 공용 응답 래퍼(success/code/message/data)+에러 진단 필드(traceId/timestamp/path)·문자열 의미 에러코드·인가(401/403)·내부정보 비노출 검증 포함 (4.7, backend §4.5·§5).
- [ ] (워크스페이스 종속 기능) 교차 워크스페이스 접근 차단·`workspace_id` 강제 주입 검증이 포함되었다 (4.7, backend §7.5).
- [ ] 상태 전이(ExecutionResult/DefectStatus) 검증이 도메인 단위 테스트에 포함되었다 (1.3, 7.3).
- [ ] 프론트 비동기 화면은 loading/empty/error 3상태를 테스트했고, 서버 상태는 MSW로 모킹했다 (2.2).
- [ ] flaky/no-assert/안티패턴 테스트가 없다 (4.6).
- [ ] CI(빌드/린트/타입체크/테스트/커버리지/보안 스캔)가 모두 통과한다 (6.3, L0 8.3).
- [ ] (Defect 수정 시) 회귀 테스트가 추가되었다 (7.6).

---

## 부록 A. 용어 정의 (테스트 도구 용어)

> 도메인 용어는 `docs/glossary.md`를 정본으로 한다. 아래는 **테스트 기법/도구** 용어만 정의한다.

| 용어 | 정의 |
| --- | --- |
| 테스트 피라미드 | 단위>통합>E2E 비중 권장 모델 |
| AAA | Arrange-Act-Assert 테스트 구조 |
| given-when-then | 조건-행위-기대결과 명명/서술 패턴 |
| Fixture | 테스트용 고정 입력/객체 데이터 |
| Patch coverage | PR의 신규/변경 라인에 대한 코드 커버리지 |
| flaky test | 동일 코드에서 간헐적으로 실패하는 불안정 테스트 |
| Testcontainers | 테스트용 실제 DB/서비스를 컨테이너로 띄우는 도구 |
| `@DataJpaTest` | JPA 영속성 계층 슬라이스 테스트 (리포지토리/쿼리/매핑 검증) |
| `@WebMvcTest` | 웹(컨트롤러) 계층 슬라이스 테스트 (MockMvc 기반) |
| `@SpringBootTest` | 전체 컨텍스트 통합 테스트 |
| MSW | 네트워크 레벨 HTTP 모킹 라이브러리 (프론트 서버 상태 모킹) |
| Vitest | Vite 기반 프론트엔드 테스트 러너 (Jest 호환 API) |
| RTL | React Testing Library (동작/접근성 기반 컴포넌트 테스트) |

## 부록 B. 정합성 매핑 (Traceability)

### B.1 L0 매핑

| 본 문서 절 | L0 근거 |
| --- | --- |
| 1. 전략 / 2. 범위 | L0 8.1, 10장(QA 참조) |
| 3. 명명 | L0 3장 |
| 4. 작성 규칙 / 4.7 보안 | L0 6.2, 9장 |
| 5. 커버리지 | L0 8.1, 8.2 |
| 6. CI 통합 | L0 6.1, 6.4, 8.2, 8.3 |
| 7. 결함 관리 | L0 2.3, 5.2, 7장, 9장 |
| 8. 품질 게이트 | L0 8.3, 6.2 |

### B.2 Backend(L1) 매핑

| 본 문서 절 | backend-coding-standard.md 근거 |
| --- | --- |
| 0.1 스택 정렬 | §0 가정 기술 스택 |
| 2.1 백엔드 테스트 대상/경계 | §2.1 레이어 정의, §4.4 DTO/엔티티 비노출 |
| 4.3 Mock 기준(도메인 Mock 금지) | §2.1 도메인 독립성 |
| 4.4 Fixture/상태 변경 | §7.2 엔티티 캡슐화 |
| 4.7 에러 시나리오/표준 스키마 | §5.1 예외 계층, §5.2 ErrorCode, §5.3 표준 에러 응답, §5.4 전역 처리 |
| 4.7 traceId 검증 | §6.3 상관관계 ID |
| 2.1·4.7 트랜잭션/영속성 | §7.1 트랜잭션 경계, §7.2~§7.3 데이터 접근/영속성 |
| 5.1 커버리지 | §10 품질 게이트 |

### B.3 Frontend(L1) 매핑

| 본 문서 절 | frontend-coding-standard.md 근거 |
| --- | --- |
| 0.1 스택 정렬(Jest→Vitest) | §0 가정 기술 스택 |
| 2.2 상태 분류별 테스트 대상 | §4.1 상태 분류, §4.2 전역/지역 분리 |
| 2.2 API 함수/훅 테스트 | §5.1 호출 계층, §5.2 DTO↔모델 매핑 |
| 2.2 컴포넌트 동작 기반 검증 | §2.3 컴포넌트 분리, §3.3 React 작성 규칙 |
| 4.7 에러 정규화/Error Boundary | §5.3 에러 처리, §10.3 |
| 6.3 타입체크 게이트 | §9 품질/정적 분석(`tsc --noEmit`) |
| 5.1 커버리지 | §9 커버리지 목표 |

### B.4 Glossary(정본) 매핑

| 본 문서 절 | glossary.md 근거 |
| --- | --- |
| 0.2 도메인 용어 반영 | 전체(§1.3 표기 변환 규칙) |
| 1.3·2.1 상태 전이 검증 | §3.1 ExecutionResult, §4.3 DefectStatus |
| 2.1·2.2 테스트 대상 명명 | §2 테스트 설계, §3 계획/실행, §4 결함 |
| 4.7 Role 기반 인가 테스트 | §6 조직/공통, §6.1 Role enum |
| 7. 결함 관리 전반 | §4 결함 관리(Severity/Priority/DefectStatus/Resolution), 부록 A 금지어 |
| 7.4 TestRun↔Defect 연계 | §3.1 Retest, §4.3 Verified |
| 7.7 리포팅 | §5 추적성/리포팅(TraceabilityMatrix/Coverage/PassRate/TestReport) |

## 부록 C. 문서 변경 이력

| 버전 | 일자 | 변경 내용 | 작성자 |
| --- | --- | --- | --- |
| v1.0 | 2026-06-02 | 최초 작성 (L0 v1.0 기반, B/F 정의서·용어 사전 부재로 도구 기본값 가정) | QA 에이전트 |
| v1.1 | 2026-06-02 | backend/frontend/glossary 정본 반영 개정. ① §0 전제를 "정본 반영"으로 전환하고 스택 정렬표 추가(프론트 테스트 러너 **Jest→Vitest** 확정, 백엔드 슬라이스 `@WebMvcTest`/`@DataJpaTest`/`@SpringBootTest` 구체화). ② 모든 예시·시나리오를 glossary PascalCase 정본 용어(TestCase/TestRun/Defect 등)와 enum(ExecutionResult/DefectStatus/Severity/Priority/Role)으로 통일하고 기존 운송형 Task/배정/정산 예시 제거. ③ 백엔드 레이어(web/service/domain/repository) 기준 테스트 대상·경계, 표준 에러 응답 스키마(code/message/traceId/timestamp/path/errors)·ErrorCode 검증, 트랜잭션/영속성(`@DataJpaTest`) 기준 정렬. ④ 프론트 상태 분류(서버/전역/지역/URL)·API 연동 계층·컴포넌트 동작 기반 테스트 구체화(MSW/Vitest/RTL). ⑤ DefectStatus 워크플로우·TestRun↔Defect 연계 검증, 요구사항 커버리지(RTM) 구분 추가. ⑥ 부록 B에 backend/frontend/glossary 참조 매핑 추가. 커버리지 수치(L0 8.1)는 불변 유지. | QA 에이전트 |
| v1.2 | 2026-06-03 | 이전(legacy) 개발 표준 정의서 통합 정렬 반영. ① §0.1 백엔드 스택 Java 17→**21(LTS)**·Maven 3.9.x. ② §4.7 에러 검증을 **공용 응답 래퍼(success/code/message/data)+에러 진단 필드**로 전환, 에러 코드를 **문자열 의미 코드 `{DOMAIN}_{상황}`**(`TESTCASE_NOT_FOUND` 등)으로 변경, MockMvc 예시에 `$.success=false`/`$.data` 미존재 단언 추가. ③ §8 DoD 체크리스트 문구 정렬. (backend §4.2 GET/POST 전용·§4.5 래퍼·§5.2 코드 정합) | QA 에이전트 |
| v1.3 | 2026-06-03 | **워크스페이스 격리 + SAST(Sparrow)** 반영. ① §6.3 CI 파이프라인에 **SAST(Sparrow, BE/FE 공통)** 단계 추가(High↑ 차단), 단계 재번호. ② §4.7 보안 시나리오에 **교차 워크스페이스 접근 차단·`workspace_id` 강제 주입** 검증 케이스 추가. ③ §8 DoD 체크리스트에 워크스페이스 격리 항목 추가. (glossary `Workspace`, L0 §9.1, backend §7.5 정합) | QA 에이전트 |
