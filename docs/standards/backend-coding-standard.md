# TMS 백엔드 코딩 스타일 / 명명 규칙 정의서 (Backend Coding Standard)

| 항목 | 내용 |
| --- | --- |
| 문서명 | TMS 백엔드 코딩 스타일 / 명명 규칙 정의서 (Backend Coding Standard) |
| 문서 버전 | v1.3 |
| 최초 작성일 | 2026-06-02 |
| 최종 개정일 | 2026-06-03 |
| 작성 주체 | Backend 개발 에이전트 |
| 문서 등급 | L1 영역별 세부 표준 |
| 상위 문서 | `docs/standards/development-standard.md` (L0, PM) |
| 적용 범위 | Backend (API 서버, 도메인 로직, 데이터 영속화, 인증/인가) |

> 본 문서는 **L0 개발 표준 정의서(`development-standard.md`)의 하위(L1) 정의서**입니다.
> L0의 상위 원칙을 백엔드 영역에 맞게 **구체화**하며, L0과 충돌하는 내용이 발견되면 **L0이 우선**합니다.
> L0이 L1에 위임한 항목(들여쓰기 크기, 어노테이션 사용법, 구체 에러 응답 스키마 등)을 본 문서에서 실제로 정의합니다.
> 본 문서가 L0과 충돌하거나 L0이 모호하다고 판단되면 임의 해석하지 않고 PM에게 명확화를 요청합니다(L0 §10).

---

## 0. 확정 기술 스택 (Confirmed Technology Stack)

핵심 스택은 L0 §2.4에서 **확정**되었습니다(Java 21 / Spring Boot 3.x / Maven / PostgreSQL 17). 본 문서는 이를 기준으로 구체 규칙을 작성합니다. **원칙 자체는 다른 스택에도 응용 가능**하도록 기술 중립적으로 서술하되, 예시는 아래 스택을 기준으로 합니다.

| 구분 | 확정/권장 기술 | 비고 |
| --- | --- | --- |
| 언어 | **Java 21 (LTS)** — Amazon Corretto 21 | record, sealed, switch/pattern matching, virtual thread 등 사용 가능 (L0 §2.4) |
| 프레임워크 | **Spring Boot 3.x** (Spring Framework 6.x) | Web MVC 기준 (WebFlux는 별도 부록 위임) |
| 빌드 도구 | **Maven 3.9.x** | `<maven.compiler.release>21</maven.compiler.release>` 명시 |
| 데이터 접근 | Spring Data JPA (Hibernate) | 복잡 조회는 QueryDSL/네이티브 쿼리 병행 |
| DB | **PostgreSQL 17** | L0 §2.4 |
| 검증 | Jakarta Bean Validation (`jakarta.validation`) | `@Valid`/`@Validated` |
| 로깅 | SLF4J + Logback (JSON 인코더) | 구조화 로깅(L0 §9.2) |
| 매핑 | MapStruct 또는 명시적 매퍼 | 리플렉션 기반 자동 매핑 지양 |
| API 문서 | springdoc-openapi (OpenAPI 3) | 코드 기반 자동 생성(L0 §7.1) |
| 포매터 | Spotless + google-java-format (AOSP 변형) | CI 강제(L0 §8.2) |
| 정적 분석(품질) | Checkstyle, SpotBugs, PMD | High 이상 차단(L0 §8.2) |
| 정적 보안 분석(SAST) | **Sparrow** | 시큐어코딩/취약점 진단, CI 게이트(§10), High↑ 차단 |
| API 테스트(로컬) | Bruno | 개별 검증용 |
| DB 클라이언트 | DBeaver | 개별 |

### 0.1 공통 설정 파일 (프로젝트 루트)

팀 내 동일한 코드 스타일·환경을 유지하기 위해 아래 파일을 백엔드 프로젝트 루트에 포함합니다.

| 파일 | 용도 |
| --- | --- |
| `.editorconfig` | 들여쓰기·인코딩·개행 통일 (Java는 4칸, `*.{json,yml,yaml}`는 2칸) |
| `checkstyle.xml` | Java 코드 스타일 검사(§3.2) |
| `.gitignore` | Git 제외 목록 (`target/`, `.env`, IDE 설정 등) |
| `.env.example` | 환경변수 샘플 (실제 값 미포함, §8 시크릿 관리) |

```ini
# .editorconfig 기본값
root = true

[*]
charset = utf-8
indent_style = space
indent_size = 4
end_of_line = lf
trim_trailing_whitespace = true
insert_final_newline = true

[*.{json,yml,yaml}]
indent_size = 2
```

> 스택 변경이 필요하면 PM과 합의 후 본 문서 §0과 L0 §2.4를 함께 갱신합니다.
> 본 문서는 기존 단독 참조 문서(`error-code-convention`/`api-url-convention`/`java21-directory-structure`/`postgresql-naming-convention`/`spring-entity-convention`)의 내용을 흡수·정렬한 정본입니다. 원본은 `docs/standards/old/`에 보관됩니다.

---

## 1. 명명 규칙 (Naming Convention)

L0 §3의 핵심 원칙(의미 기반·검색 가능성·일관성·발음 가능성·부정형 회피)과 약어 정책을 백엔드 표기 규칙으로 구체화합니다.

### 1.1 표기 케이스 표준

| 대상 | 케이스 | 예시 |
| --- | --- | --- |
| 패키지 | 전부 소문자, 단어 구분 없음 | `com.unione.tms.testcase` |
| 클래스 / 인터페이스 / enum / record / 어노테이션 | UpperCamelCase | `TestCaseService` |
| 메서드 / 지역변수 / 필드 / 파라미터 | lowerCamelCase | `executeTestRun`, `testCaseId` |
| 상수 (`static final`) | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| enum 상수 | UPPER_SNAKE_CASE | `PASS`, `IN_PROGRESS` |
| 제네릭 타입 파라미터 | 단일 대문자(의미 있으면 단어) | `T`, `E`, `K`, `V`, `ID` |
| 타입 미포함 일반 식별자 | lowerCamelCase | - |

### 1.2 약어 대소문자 표기 확정 (L0 §3.2 위임 사항)

L0은 `Id` vs `ID` 등 약어 표기를 L1에서 확정하도록 위임했습니다. 백엔드는 **한 단어로 취급(첫 글자만 대문자)** 을 원칙으로 합니다.

| 약어 | 확정 표기 | 금지 표기 |
| --- | --- | --- |
| Identifier | `Id` / `id` | `ID`, `iD` |
| URL | `Url` / `url` | `URL` |
| URI | `Uri` / `uri` | `URI` |
| HTTP | `Http` / `http` | `HTTP` |
| API | `Api` / `api` | `API` |
| DB | `Db` / `db` | `DB` |
| JSON | `Json` / `json` | `JSON` |
| IO | `Io` / `io` | `IO` |

> 예: `userId`, `findByTestCaseId`, `HttpClientConfig`, `OpenApiConfig`. 임의 축약(`usr`, `cnt`, `mng`)은 L0 §3.2에 따라 금지합니다. 도메인 고유 약어는 `docs/glossary.md` 등록 후에만 사용합니다.

### 1.3 클래스/타입 접미어 규약 (역할 드러내기)

L0 §3.1 "의미 기반 명명"을 레이어별 접미어로 강제합니다.

| 역할 | 접미어/접두어 | 예시 |
| --- | --- | --- |
| REST 컨트롤러 | `~Controller` | `TestCaseController` |
| 비즈니스 서비스 (인터페이스) | `~Service` | `TestCaseService` |
| 서비스 구현체 | `~ServiceImpl` (단일 구현이면 인터페이스 생략 가능, §2.4) | `TestCaseServiceImpl` |
| 영속성 리포지토리 | `~Repository` | `TestCaseRepository` |
| JPA 엔티티 | 접미어 없음(도메인명) | `TestCase`, `Defect` |
| 요청 DTO | `~Request` | `CreateTestCaseRequest` |
| 응답 DTO | `~Response` | `TestCaseResponse` |
| 내부 전달/계층 간 모델 | `~Dto` / `~Command` / `~Query` | `TestCaseSearchQuery` |
| 매퍼 | `~Mapper` | `TestCaseMapper` |
| 설정 클래스 | `~Config` / `~Properties` | `SecurityConfig`, `JwtProperties` |
| 커스텀 예외 | `~Exception` | `TestCaseNotFoundException` |
| enum (상태/유형) | 의미 명사 | `ExecutionResult`, `DefectStatus` |
| 상수 보관 클래스 | `~Constants` | `TestCaseConstants` |
| 유틸 (상태 없는 정적 헬퍼) | `~Utils` | `DateTimeUtils` |

### 1.4 메서드 명명 규약

| 의도 | 동사 패턴 | 예시 |
| --- | --- | --- |
| 단건 조회(없으면 예외) | `get~` | `getTestCase(id)` |
| 단건 조회(없으면 Optional/null) | `find~` | `findTestCase(id)`, `findByEmail` |
| 다건 조회 | `findAll~` / `search~` | `searchTestCases(query)` |
| 존재 여부 | `exists~` (boolean) | `existsByEmail` |
| 생성 | `create~` / `register~` | `createTestCase`, `registerDefect` |
| 수정 | `update~` / `modify~` | `updateTestCase` |
| 삭제 | `delete~` / `remove~` | `deleteTestCase` |
| 상태 전이 | 도메인 동사 | `execute`, `block`, `reopen` (TestRun/Defect 워크플로우) |
| 변환 | `to~` / `from~` | `toResponse`, `fromEntity` |
| 불리언 반환 | `is/has/can/should~` (L0 §3.4) | `isExecutable`, `hasPermission` |

### 1.5 변수/필드 명명 (L0 §3.4 구체화)

| 대상 | 규칙 | 예시 |
| --- | --- | --- |
| 불리언 | `is/has/can/should` 접두 | `isActive`, `hasNext` |
| 컬렉션 | 복수형 또는 `~List`/`~Set`/`~Map` | `testCases`, `testCaseList`, `idToTestCaseMap` |
| 식별자 | `~Id` 접미 | `testCaseId`, `assigneeId` |
| 시간 값 | 의미+단위/시점 명시 | `createdAt`, `expiresInSeconds`, `dueDate` |
| 금액/수량 | 단위 명시 | `amountKrw`, `totalCount` |

### 1.6 패키지 명명 규칙

- 루트: `com.unione.tms` (조직.프로젝트). 모든 패키지는 소문자, 약어 미사용.
- **도메인(기능) 우선 패키징**을 기본으로 하고(L0 §4.3 "도메인 응집"), 기술 종류만으로 과도 분산하지 않습니다. (§2.2 참조)
- 패키지명은 도메인 용어 사전(L0 §3.3, glossary)과 동일 단어 사용: `testcase`, `testrun`, `defect`, `user`.

### 1.7 DB 테이블/컬럼 명명 규칙

관계형 DB 관례에 따라 **snake_case**를 표준으로 합니다. Java(camelCase) ↔ DB(snake_case) 매핑은 ORM 네이밍 전략(Hibernate `CamelCaseToUnderscoresNamingStrategy`)으로 자동 처리하되, 명시적 `@Column`/`@Table`로 의도를 고정할 수 있습니다.

| 대상 | 규칙 | 예시 |
| --- | --- | --- |
| 테이블 | 소문자 snake_case, **복수형** | `test_cases`, `test_runs` |
| 컬럼 | 소문자 snake_case | `created_at`, `assignee_id` |
| 기본키 | `id` (단일 surrogate key 권장) | `id` |
| 외래키 | `<참조테이블단수>_id` | `test_case_id`, `user_id` |
| 인덱스 | `ix_<table>_<col>[_<col>]` | `ix_test_runs_result` |
| 유니크 제약 | `ux_<table>_<col>` | `ux_users_email` |
| 외래키 제약 | `fk_<table>_<ref>` | `fk_test_runs_test_case` |
| 기본키 제약 | `pk_<table>` | `pk_test_cases` |
| 불리언 컬럼 | `is_~`/`has_~` | `is_active` |

**공통 컬럼(모든 테이블 필수)** — 워크스페이스 격리·감사(audit)·논리 삭제를 위해 아래 컬럼을 모든 (워크스페이스 종속) 테이블에 포함합니다. 타입·구현은 §7.3·§7.5에서 확정합니다.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `workspace_id` | `bigint` | **워크스페이스 격리 키** — 모든 행은 소속 Workspace로 분리(공유 스키마, L0 §9.1). NOT NULL, 인덱스 필수 |
| `created_at` | `timestamptz` | 생성 일시 (NOT NULL, `now()`) |
| `updated_at` | `timestamptz` | 수정 일시 (NOT NULL) |
| `created_by` | `text` | 생성자 ID (감사) |
| `updated_by` | `text` | 수정자 ID (감사) |
| `is_deleted` | `boolean` | 논리 삭제 여부 (DEFAULT false) — 물리 삭제 대신 soft delete |

> Workspace 자체(루트 테이블) 등 전역(global) 테이블은 `workspace_id`에서 제외됩니다. 격리 적용 범위는 §7.5에서 정의합니다.

> 클래스명·테이블명·API 경로·테스트 명세가 동일 도메인 용어를 쓰도록 L0 §3.3을 준수합니다. 엔티티 클래스 `TestCase` → 테이블 `test_cases` → API `/test-cases` → 컬럼 `test_case_id`로 일관 유지합니다.

### 1.8 API 엔드포인트(URI) 명명 규칙

세부 REST 규약은 §4에서 다루며, 명명 측면 규칙은 다음과 같습니다.

| 규칙 | 내용 | 예시 |
| --- | --- | --- |
| 명사·복수형 리소스 | 동사 대신 리소스 명사(복수형) 사용 | `/api/v1/test-cases` |
| 케밥 케이스 | 다단어 경로는 kebab-case | `/api/v1/test-runs` |
| 소문자 | 경로는 전부 소문자 | - |
| 계층 표현 | 하위 리소스는 중첩 | `/api/v1/test-cases/{testCaseId}/steps` |
| 쿼리 파라미터 | lowerCamelCase | `?result=PASS&page=0` |
| 조회 경로 동사 금지 | 조회는 `GET /리소스`로만, `/getTestCase` 금지 | - |
| 액션 경로 동사 허용 | GET/POST만 쓰므로(§4.2) 생성 외 상태 변경은 `POST /리소스/{id}/{action}` 형태로 동사 허용 | `/test-runs/{id}/execute`, `/test-cases/{id}/delete` |
| 버전 접두 | `/api/v{n}` 필수 | `/api/v1` |

> 깊은 중첩은 지양합니다: 리소스 중첩은 **1단계까지** 권장하고, 더 깊어지면 최상위 리소스로 평탄화합니다. 필터·정렬·페이징은 경로가 아닌 **쿼리 스트링**으로 표현합니다(`?status=active&page=0&size=20&sort=createdAt,desc`).

---

## 2. 패키지 / 레이어 구조 (Package & Layer Structure)

L0 §4.2(단방향 의존, 표현/도메인/인프라 분리, 도메인 독립성, 경계 명확화)를 백엔드 레이어로 구체화합니다.

### 2.1 레이어 정의와 책임 분리

| 레이어 | 패키지 | 책임 | 금지 사항 |
| --- | --- | --- | --- |
| Presentation (Web) | `web` / `controller` | HTTP 요청 수신, DTO 검증, 인증 컨텍스트 전달, 응답 매핑 | 비즈니스 로직, 직접 DB 접근, 엔티티 직접 노출 |
| Application (Service) | `service` / `application` | 유스케이스 오케스트레이션, 트랜잭션 경계, 권한 검증 | HTTP/Servlet 의존, SQL 직접 작성 |
| Domain | `domain` | 엔티티, 값 객체(VO), 도메인 규칙/불변식, 도메인 서비스 | 프레임워크·인프라 의존 최소화(L0 §4.2) |
| Infrastructure | `repository` / `infra` | 영속화, 외부 API 연동, 메시징, 캐시 | 비즈니스 규칙 포함 |
| Cross-cutting | `common` / `config` / `global` | 공통 예외, 응답 래퍼, 설정, 필터/인터셉터, 유틸 | 특정 도메인 의존 |

**의존 방향(L0 §4.2 단방향 의존, 순환 금지):**

```
Controller  →  Service  →  Domain
     │            │           ▲
     └────────────┴──────►  Repository(interface, domain 소유) ◄── Infra 구현
```

- 상위→하위 단방향만 허용. 역방향/순환 의존 금지.
- Domain은 다른 레이어에 의존하지 않음(가장 안쪽). Repository **인터페이스는 도메인/애플리케이션 측에 두고**, 구현은 Infra에 둘 수 있습니다(의존성 역전).
- 계층 간 전달은 명시적 모델(DTO/Command/Query)로만 수행(L0 §4.2 경계 명확화). **엔티티를 컨트롤러 응답으로 직접 반환 금지.**

### 2.2 디렉터리 구조 표준 (도메인 우선 패키징)

L0 §4.3 "도메인 응집"에 따라 **기능(도메인) 단위 패키징**을 기본으로 합니다.

```
backend/
└── src/main/java/com/unione/tms/
    ├── TmsApplication.java
    ├── common/                  # 영역 공통(횡단 관심사)
    │   ├── exception/           # 공통 예외, ErrorCode, GlobalExceptionHandler
    │   ├── response/            # ApiResponse, PageResponse 등 공통 래퍼
    │   ├── config/              # SecurityConfig, JpaConfig, OpenApiConfig 등
    │   ├── logging/             # CorrelationIdFilter, 로깅 유틸
    │   └── util/                # 상태 없는 정적 유틸
    ├── testcase/                # 도메인: 테스트 케이스
    │   ├── web/                 # TestCaseController, 요청/응답 DTO
    │   │   └── dto/
    │   ├── service/             # TestCaseService(+Impl)
    │   ├── domain/              # TestCase(엔티티), TestCaseStatus(enum), VO, 도메인 규칙
    │   └── repository/          # TestCaseRepository(인터페이스) + 구현/쿼리
    ├── testrun/                 # 도메인: 테스트 실행(런)
    │   └── ...                  # 동일 하위 구조
    ├── defect/                  # 도메인: 결함
    │   └── ...                  # 동일 하위 구조
    └── user/                    # 도메인: 사용자/인증
        └── ...
```

- 폴더 = 단일 책임(L0 §4.3). `utils` 한 곳에 잡다하게 모으는 분산 금지.
- 도메인 간 공유가 필요한 코드만 `common`으로 승격하고, 무분별한 복제 금지(L0 §4.3 "공통 코드 분리").
- 공개 인터페이스 최소화(L0 §4.3): 도메인 외부에 노출할 타입만 public, 나머지는 package-private.

### 2.3 import 순서

google-java-format 정렬을 CI에서 강제합니다(§3). 와일드카드 import(`import x.*`) 금지, static import는 명시적으로.

```
1) java.* / javax.* / jakarta.*
2) (빈 줄) 외부 라이브러리 (org.springframework.*, com.fasterxml.* 등)
3) (빈 줄) 프로젝트 내부 (com.unione.tms.*)
4) (빈 줄) static import (위 그룹 동일 정렬)
```

### 2.4 인터페이스 사용 기준

- 구현이 단 하나이고 향후 다형성 계획이 없으면 **불필요한 인터페이스를 강요하지 않습니다**(예: 단순 `Service`). 단, 테스트 더블이 필요하거나 외부 연동 경계(외부 API/메시징)는 인터페이스를 둡니다.
- Repository는 Spring Data 인터페이스를 기본으로 사용합니다.

---

## 3. 코딩 스타일 (Code Formatting Style)

L0 §8.2(린터/포매터 CI 강제)를 구체화하며, **포매팅 분쟁을 없애기 위해 자동 포매터 출력이 곧 표준**입니다. 사람이 수동으로 정렬하지 않습니다.

### 3.1 포맷 규칙 (L0 위임: 들여쓰기 크기 등 확정)

| 항목 | 규칙 |
| --- | --- |
| 들여쓰기 | **스페이스 4칸** (탭 금지) |
| 줄 최대 길이 | **120자** |
| 중괄호 위치 | **K&R 스타일**(여는 중괄호 같은 줄), 한 줄짜리 블록도 중괄호 필수 |
| 파일 인코딩 | UTF-8, 개행 LF |
| 파일 끝 | 개행 1개로 종료, 후행 공백 제거 |
| 한 줄 한 문장 | 한 줄에 여러 문장(`;` 연속) 금지 |
| 빈 줄 | 논리 블록 구분에 1줄, 연속 2줄 이상 금지 |
| 변수 선언 | 가급적 사용 직전 선언, 한 줄 한 변수 |
| 매직 넘버 | 상수화(`MAX_RETRY_COUNT`), 리터럴 직접 사용 금지 |
| `var` 사용 | 타입이 우변에서 자명할 때만 허용, 가독성 해치면 금지 |
| 접근 제어자 | 최소 공개 원칙(가능한 한 좁게) |
| `final` | 재할당 없는 지역변수/파라미터/필드에 권장 |

### 3.2 도구 강제

| 도구 | 역할 | CI 동작 |
| --- | --- | --- |
| Spotless + google-java-format(AOSP) | 포맷 자동 적용/검증 | `spotlessCheck` 실패 시 차단 |
| Checkstyle | 명명/구조/import 규칙 | 위반 시 차단 |
| SpotBugs | 잠재 버그 정적 분석 | High 이상 차단(L0 §8.2) |
| PMD | 복잡도/중복/안티패턴 | 임계 초과 시 리뷰 분할 요구 |

- 빌드 경고 0건 유지(L0 §8.2). 컴파일러 `-Werror` 권장.

### 3.3 어노테이션 사용 규칙 (L0 위임 사항)

| 규칙 | 내용 |
| --- | --- |
| 배치 | 어노테이션은 대상 선언 **바로 윗줄**에 한 개씩(파라미터 한정 어노테이션만 인라인 허용) |
| 순서 권장 | `@Override` → 프레임워크 스테레오타입(`@Service` 등) → 횡단(`@Transactional`) → 기타 |
| 생성자 주입 | **생성자 주입 필수.** 필드 주입(`@Autowired` 필드) 금지. 단일 생성자면 `@Autowired` 생략 |
| Lombok | 사용 시 `@Getter`, `@RequiredArgsConstructor`까지 허용. **`@Data`, `@Setter`(엔티티), `@AllArgsConstructor` 남용 금지** (불변성 훼손) |
| 엔티티 | `@Entity`는 protected 기본 생성자 + 정적 팩토리/빌더 사용, 무분별한 setter 금지 |
| 트랜잭션 | `@Transactional`은 **서비스 레이어 public 메서드**에만(§7) |
| 검증 | 요청 DTO에 Bean Validation 어노테이션, 컨트롤러에서 `@Valid` |
| 매핑 | 매핑 어노테이션(`@GetMapping` 등) 사용, `@RequestMapping(method=...)` 지양 |
| Null 계약 | nullable 의도는 `Optional` 반환 또는 `@Nullable`/`@NonNull`로 명시 |

권장 생성자 주입 예시:

```java
@Service
@RequiredArgsConstructor          // 또는 명시적 생성자
public class TestCaseServiceImpl implements TestCaseService {

    private final TestCaseRepository testCaseRepository;
    private final TestCaseMapper testCaseMapper;

    @Override
    @Transactional(readOnly = true)
    public TestCaseResponse getTestCase(Long testCaseId) {
        TestCase testCase = testCaseRepository.findById(testCaseId)
                .orElseThrow(() -> new TestCaseNotFoundException(testCaseId));
        return testCaseMapper.toResponse(testCase);
    }
}
```

---

## 4. API 설계 규칙 (API Design)

L0 §7.1(API 명세 자동 생성)과 §9(보안/에러)와 정합하도록 REST 규약을 정의합니다.

### 4.1 REST 규약

- 리소스 중심 설계, 리소스는 명사·복수형(§1.8).
- 경로 버저닝 `/api/v1` 필수. 하위 호환 깨는 변경은 MAJOR 버전 상승(L0 §5.3).
- 표현 형식은 JSON(`application/json`), 문자 인코딩 UTF-8.
- 컬렉션 조회는 페이지네이션(`page`, `size`, `sort`) 기본 지원, 정렬/필터는 쿼리 파라미터.

### 4.2 HTTP 메서드 사용 기준 — **GET / POST 만 사용**

본 프로젝트는 **`GET`과 `POST` 두 메서드만 사용**합니다(PUT/PATCH/DELETE 미사용). 조회는 `GET`, 그 외 상태를 바꾸는 모든 작업(생성/수정/삭제)은 `POST`로 표현합니다.

| 메서드 | 용도 | 비고 |
| --- | --- | --- |
| GET | 단건/목록 **조회** | 바디 없음, 부수효과 없음, 멱등 |
| POST | **생성·수정·삭제 등 상태 변경 전부** | 바디(JSON)로 의도 전달 |

**POST로 생성/수정/삭제를 표현하는 규칙**

| 동작 | URL 패턴 | 예시 |
| --- | --- | --- |
| 생성 | `POST /리소스` | `POST /api/v1/test-cases` |
| 수정 | `POST /리소스/{id}` | `POST /api/v1/test-cases/{id}` (변경 필드 전달) |
| 논리 삭제 | `POST /리소스/{id}/delete` (액션) | `POST /api/v1/test-cases/{id}/delete` |
| 도메인 액션 | `POST /리소스/{id}/{action}` | `POST /api/v1/test-runs/{id}/execute` |

> 물리 삭제는 금지하며(§7.3 soft delete), 삭제는 `is_deleted` 전환 액션으로 처리합니다.

### 4.3 HTTP 상태 코드 사용 기준

메서드는 GET/POST만 쓰되, **HTTP 상태 코드는 의미에 맞게 다양하게** 사용합니다(상태 코드로 결과를 정확히 표현).

| 상황 | 코드 |
| --- | --- |
| 조회/수정 성공(바디 있음) | `200 OK` |
| 생성 성공 | `201 Created` |
| 검증 실패/잘못된 요청 | `400 Bad Request` |
| 인증 실패(미인증) | `401 Unauthorized` |
| 인가 실패(권한 없음) | `403 Forbidden` |
| 리소스 없음 | `404 Not Found` |
| 상태 충돌/중복 | `409 Conflict` |
| 검증 의미 오류(형식은 맞으나 규칙 위반) | `422 Unprocessable Entity` |
| 요청 한도 초과 | `429 Too Many Requests` |
| 서버 내부 오류 | `500 Internal Server Error` |
| 다운스트림 실패/타임아웃 | `502/503/504` |

> 인증(401)과 인가(403)를 명확히 구분합니다(L0 §9.1 "인증과 인가 분리").

### 4.4 요청/응답 DTO 규칙

| 규칙 | 내용 |
| --- | --- |
| 엔티티 비노출 | 컨트롤러 입출력에 JPA 엔티티 직접 사용 금지. DTO 전용 |
| 불변 DTO | 요청/응답 DTO는 `record` 또는 불변 객체 권장 |
| 검증 위치 | 입력 검증은 DTO + Bean Validation, 컨트롤러 `@Valid`. 서버 측 검증 필수(L0 §9.1) |
| 명명 | 요청 `~Request`, 응답 `~Response`(§1.3) |
| Null 정책 | 응답에서 의미 없는 null 필드 노출 최소화, 일관된 직렬화 정책(`NON_NULL` 등) |
| 시간 표기 | ISO-8601(UTC, `2026-06-02T12:00:00Z`) 문자열 |
| 페이지 응답 | 공통 `PageResponse<T>`(content, totalElements, totalPages, currentPage, size) |
| 마스킹 | 응답에서 개인정보/인증정보 마스킹(L0 §9.1) |

### 4.5 공통 응답 래퍼 (필수)

모든 API 응답은 **단일 공용 응답 래퍼 `ApiResponse<T>`**를 사용합니다(L0 §9.3). 성공/실패가 동일 구조를 공유하며, **에러 시 진단 필드(`traceId`/`timestamp`/`path`/`errors`)를 추가**합니다.

| 필드 | 타입 | 성공 | 에러 | 설명 |
| --- | --- | --- | --- | --- |
| `success` | boolean | O | O | 처리 성공 여부 |
| `code` | string | O | O | 성공=`SUCCESS`, 에러=문자열 의미 코드(§5.2, 예: `TESTCASE_NOT_FOUND`) |
| `message` | string | O | O | 사용자 친화·안전 메시지 |
| `data` | T | O | `null` | 응답 페이로드 |
| `traceId` | string | - | O | 상관관계/추적 ID(§6.3) |
| `timestamp` | string(ISO-8601 UTC) | - | O | 발생 시각 |
| `path` | string | - | O | 요청 경로 |
| `errors` | array | - | 선택 | 필드 검증 실패 상세(`field`, `reason`) |

```json
// 성공
{ "success": true, "code": "SUCCESS", "message": "요청이 정상 처리되었습니다.", "data": { "testRunId": 1, "result": "PASS" } }
```
```json
// 성공 - 목록(페이지)
{
  "success": true, "code": "SUCCESS", "message": "요청이 정상 처리되었습니다.",
  "data": { "content": [], "totalElements": 100, "totalPages": 10, "currentPage": 0, "size": 10 }
}
```

```java
@Getter
@RequiredArgsConstructor(access = AccessLevel.PRIVATE)
public class ApiResponse<T> {
    private final boolean success;
    private final String code;
    private final String message;
    private final T data;
    // 에러 시에만 채워지는 진단 필드 (null이면 직렬화 제외: @JsonInclude(NON_NULL))
    private final String traceId;
    private final String timestamp;
    private final String path;
    private final List<FieldError> errors;

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, "SUCCESS", "요청이 정상 처리되었습니다.", data, null, null, null, null);
    }
    // 에러 응답 생성은 GlobalExceptionHandler에서 ErrorCode + 진단 필드로 구성(§5.3)
}
```

### 4.6 API 문서화

- springdoc-openapi로 OpenAPI 3 명세를 코드에서 자동 생성하고 `/docs/api`에 산출합니다(L0 §7.1).
- 공개 엔드포인트/DTO에 요약·설명·예시 작성. 공개 API는 시그니처 수준 문서 주석 필수(L0 §7.3).

### 4.7 페이지네이션 (Offset / Cursor 선택 기준)

목록 API는 두 가지 페이지네이션 전략을 데이터 규모에 따라 선택한다. OpenAPI 정본(`docs/api/openapi.yaml`)에 전략별 파라미터를 일관 적용한다.

#### 4.7.1 전략 선택 기준

| 전략 | 사용 케이스 | 적용 대상(예) | 사유 |
| --- | --- | --- | --- |
| **Offset 기반** (`page`, `size`, `sort`) | 페이지 수 가시화 필요 + 전체 행 수 작음(≤ 10K 행) | Workspace 목록, Project 멤버, Suite 트리, 설정 목록 | UI 페이지 번호 표시 가능. 구현 단순 |
| **Cursor 기반** (`cursor`, `size`, `sort` 고정) | 전체 행 수 큼(> 10K 예상) / 무한 스크롤 / 동시 INSERT 빈번 | TestCase, TestRun, TestRunStep, Defect, Attachment, 활동 로그 | offset > 50K 시 PG 성능 급락(`LIMIT/OFFSET` 풀스캔), 동시 INSERT 시 행 중복/누락 |

기준 수치는 권장값. PoC 시 EXPLAIN ANALYZE로 검증.

#### 4.7.2 공통 응답 형식

```json
// Offset
{ "items": [...], "page": 0, "size": 20, "total": 134, "totalPages": 7 }

// Cursor
{ "items": [...], "size": 20, "nextCursor": "eyJpZCI6MTIzNCwidHMiOiIyMDI2LTA2LTA4VDE0OjMwOjAwWiJ9", "hasMore": true }
```

- Cursor 값은 **불투명 문자열**(base64 JSON). 클라이언트는 파싱·생성 금지. 다음 요청에 그대로 echo.
- Cursor 페이로드(내부): `{ "id": <last id>, "sortKey": <last sort key value> }`. 정렬 키 + 행 ID로 keyset 페이지네이션.
- `nextCursor === null` ↔ `hasMore === false` ↔ 마지막 페이지.

#### 4.7.3 구현 규칙

| 규칙 | 내용 |
| --- | --- |
| 정렬 키 고정 | Cursor 페이지네이션은 정렬 키가 변경되지 않는 컬럼(`createdAt DESC, id DESC` 등) 사용. 사용자 선택 정렬 금지(또는 정렬 변경 시 cursor reset) |
| 인덱스 정합 | Cursor 정렬 키 컬럼 조합으로 복합 인덱스 (격리키 선두 후) 보장 — `(workspace_id, created_at DESC, id DESC)` 등 |
| size 상한 | 모든 페이지네이션 `size` 상한 100 (기본 20). 초과 시 `400 INVALID_PAGE_SIZE` (§5.2 ErrorCode) |
| offset 상한 (offset 전략) | `(page+1)*size ≤ 10000`. 초과 시 `400 OFFSET_TOO_DEEP` + "큰 데이터셋은 검색·필터로 좁히거나 cursor API 사용" 안내 |
| total 비용 | Offset 전략의 `total`은 별도 `COUNT(*)` — 매번 계산은 비용. 1000건 미만은 무료, 그 이상은 `?includeTotal=false` 옵션으로 생략 가능 |
| Cursor 안정성 | Cursor 페이로드에 정렬 키와 ID 모두 포함하여 동률(tie) 해소. `WHERE (created_at, id) < (?, ?)` 형태 |
| 검증 게이트 | OpenAPI에 전략별 파라미터 일관 적용. 통합 테스트로 (a) 50K 행에서 cursor API p95 < 500ms, (b) offset API page=0 p95 < 200ms 검증 |

#### 4.7.4 OpenAPI 정합 (정본 갱신 항목)

`docs/api/openapi.yaml`에 공통 파라미터 추가:

```yaml
components:
  parameters:
    pageQuery: { name: page, in: query, schema: { type: integer, minimum: 0 } }     # offset
    sizeQuery: { name: size, in: query, schema: { type: integer, minimum: 1, maximum: 100 } }
    sortQuery: { name: sort, in: query, schema: { type: string } }                  # 예: "createdAt,desc"
    includeTotalQuery: { name: includeTotal, in: query, schema: { type: boolean, default: true } }  # offset 전략 옵션
    cursorQuery: { name: cursor, in: query, schema: { type: string } }              # cursor (opaque)
  schemas:
    OffsetPage:  { type: object, properties: { items: { type: array }, page: { type: integer }, size: { type: integer }, total: { type: integer, nullable: true }, totalPages: { type: integer, nullable: true } } }
    CursorPage:  { type: object, properties: { items: { type: array }, size: { type: integer }, nextCursor: { type: string, nullable: true }, hasMore: { type: boolean } } }
```

#### 4.7.5 락 v2.4 적용 대상 전환

| 엔드포인트 | 이전 | 이후 |
| --- | --- | --- |
| `GET /test-cases`, `GET /test-runs`, `GET /defects`, `GET /attachments`, `GET /test-run-step-history` | Offset | **Cursor** |
| `GET /workspaces`, `GET /projects`, `GET /workspaces/{id}/members`, `GET /test-suites/tree`, `GET /users` | Offset 유지 | Offset 유지 |

전환 시점에 OpenAPI + BE 구현 + FE 클라이언트 동시 갱신 (CI drift 검출).

---

## 5. 예외 / 에러 처리 (Exception & Error Handling)

L0 §9.3(명시적 처리, 예측 가능한 응답, 내부 정보 비노출, 사용자 친화 메시지, 실패 격리, 데이터 일관성)을 구체화합니다. **L0이 L1에 위임한 "구체 에러 응답 스키마"를 본 절에서 확정**합니다.

### 5.1 예외 계층 전략

| 구분 | 규칙 |
| --- | --- |
| 기반 예외 | 비즈니스 예외는 `BusinessException`(unchecked, `RuntimeException` 상속) 단일 루트 |
| 도메인 예외 | `BusinessException`을 상속한 구체 예외(`TestCaseNotFoundException` 등), `ErrorCode` 보유 |
| 검사 예외 지양 | 도메인/서비스 흐름에는 unchecked 예외 사용(보일러플레이트 감소) |
| silent catch 금지 | 예외를 삼키지 않음. 처리하거나 의미 있게 전파(L0 §9.3) |
| 변환 경계 | 인프라 예외(SQL/IO)는 도메인/애플리케이션 예외로 변환해 전파 |
| 내부 정보 비노출 | 스택트레이스/내부 구조를 응답에 노출 금지(L0 §9.3) |

### 5.2 ErrorCode 체계 — 문자열 의미 코드

에러는 **식별 가능한 코드**를 갖습니다(L0 §9.3). 코드는 **도메인명을 보존한 문자열 의미 코드 `{DOMAIN}_{상황}`**(UPPER_SNAKE_CASE)로 정의해 자기설명적이고 로그에서 바로 검색·추적이 쉽게 합니다. 번호식(`U001`) 대신 의미 기반 문자열을 표준으로 합니다. `ErrorCode` enum이 코드·HTTP 상태·기본 메시지를 묶습니다.

| 필드 | 내용 |
| --- | --- |
| code | `{DOMAIN}_{상황}` 문자열. 예: `TESTCASE_NOT_FOUND`, `DEFECT_INVALID_STATUS_TRANSITION`, `AUTH_TOKEN_EXPIRED`, `COMMON_INVALID_INPUT` |
| status | 매핑되는 HTTP 상태(§4.3) |
| message | 외부 노출용 **안전한** 기본 메시지(민감정보 없음) |

- 도메인 접두어는 패키지/도메인 용어(L0 §3.3, glossary)와 일치시킵니다: `TESTCASE_`, `TESTRUN_`, `DEFECT_`, `AUTH_`, `USER_`, 공통은 `COMMON_`.
- 코드 값은 **불변**입니다. 한 번 배포된 코드의 의미를 바꾸지 않습니다(클라이언트가 의존).

```java
@Getter
@RequiredArgsConstructor
public enum ErrorCode {
    // Common
    COMMON_INVALID_INPUT(HttpStatus.BAD_REQUEST, "입력값이 올바르지 않습니다."),
    COMMON_INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "일시적인 오류가 발생했습니다."),
    // Domain
    TESTCASE_NOT_FOUND(HttpStatus.NOT_FOUND, "요청한 테스트 케이스를 찾을 수 없습니다."),
    DEFECT_INVALID_STATUS_TRANSITION(HttpStatus.CONFLICT, "허용되지 않은 결함 상태 전이입니다."),
    // Auth
    AUTH_UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "인증이 필요합니다."),
    AUTH_FORBIDDEN(HttpStatus.FORBIDDEN, "권한이 없습니다.");

    private final HttpStatus status;
    private final String message;

    // code 문자열은 enum 상수명(name())을 그대로 사용 → 코드=식별자 일관
    public String getCode() { return name(); }
}
```

> `code`는 enum 상수명(`name()`)을 그대로 사용하므로 enum 이름 = 응답 코드 = 로그 키워드가 일치합니다.

### 5.3 표준 에러 응답 (공용 래퍼 + 진단 필드)

에러 응답은 §4.5의 **공용 응답 래퍼 `ApiResponse`를 그대로 사용**하되 `success=false`, `data=null`로 두고 **진단 필드(`traceId`/`timestamp`/`path`/`errors`)를 추가**합니다(별도 스키마를 두지 않음 — 성공/실패 단일 구조).

```json
{
  "success": false,
  "code": "COMMON_INVALID_INPUT",
  "message": "입력값이 올바르지 않습니다.",
  "data": null,
  "traceId": "b1f3c2a4-8e7d-4a11-9f0c-2d3e4f5a6b7c",
  "timestamp": "2026-06-03T12:00:00Z",
  "path": "/api/v1/test-cases",
  "errors": [
    { "field": "title", "reason": "필수 항목입니다." }
  ]
}
```

> 모든 에러 응답은 이 단일 구조를 사용합니다. 스택트레이스·SQL·내부 클래스명은 절대 포함하지 않으며, 상세 원인은 로그에만 기록합니다(L0 §9.3).

### 5.4 전역 예외 처리

- `@RestControllerAdvice` + `@ExceptionHandler`로 전역 처리해 응답을 일관화합니다(예측 가능한 응답, L0 §9.3).
- 처리 우선순위: `BusinessException`(코드별 매핑) → 검증 예외(`MethodArgumentNotValidException`/`ConstraintViolationException` → 400/422 + `errors`) → 인증/인가 예외(401/403) → 그 외 미분류(`Exception` → 500 `COMMON_INTERNAL_ERROR`).
- 500급 이상은 `ERROR` 로그 + traceId 기록, 4xx 클라이언트 오류는 `WARN`/`INFO`로 과도 로깅 방지(§6, L0 §9.2).

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<?>> handleBusiness(BusinessException e, HttpServletRequest request) {
        ErrorCode ec = e.getErrorCode();
        // ApiResponse 에러 빌더가 success=false, code=ec.getCode(), traceId/timestamp/path 채움
        return ResponseEntity.status(ec.getStatus())
            .body(ApiResponse.error(ec, request.getRequestURI()));
    }
}
```

### 5.5 실패 격리 / 데이터 일관성 (L0 §9.3)

| 항목 | 규칙 |
| --- | --- |
| 외부 호출 | 타임아웃 필수 설정, 필요 시 재시도(지수 백오프)·서킷브레이커·폴백 |
| 부분 실패 | 경계를 두어 전체 장애 전파 차단 |
| 일관성 보존 | 실패 시 트랜잭션 롤백, 분산 작업은 보상 처리/멱등 설계 |
| 멱등성 | 재시도 가능한 외부 트리거 작업은 멱등 키로 중복 방지 |

---

## 6. 로깅 규칙 (Logging)

L0 §9.2(구조화 로깅, 로그 레벨, 상관관계 ID, 민감정보 제외, 맥락 포함, 과도 로깅 금지)를 백엔드 구현 규칙으로 구체화합니다.

### 6.1 로깅 기본 규칙

| 규칙 | 내용 |
| --- | --- |
| 파사드 | SLF4J 인터페이스만 사용(`org.slf4j.Logger`). 구현 직접 의존 금지 |
| 로거 선언 | 클래스당 `private static final Logger log` (Lombok `@Slf4j` 허용) |
| 구조화 출력 | 운영 환경은 **JSON 구조화 로그**(Logback JSON 인코더) |
| 파라미터 바인딩 | `log.info("test case created: {}", testCaseId)` 형태. 문자열 연결(`+`) 금지 |
| 예외 로깅 | 예외는 마지막 인자로 전달해 스택 포함: `log.error("...", e)` |
| `System.out`/`printStackTrace` 금지 | 표준 로거만 사용 |

### 6.2 로그 레벨 사용 기준 (L0 §9.2 준수)

| 레벨 | 백엔드 적용 예 |
| --- | --- |
| ERROR | 처리 불가 예외, 500 응답, 외부 연동 최종 실패 |
| WARN | 복구 가능 이상(재시도 성공), 4xx 중 주의가 필요한 경우, 임계 근접 |
| INFO | 주요 비즈니스 이벤트/상태 전이(작업 생성·배정·완료), 애플리케이션 기동 |
| DEBUG | 진단용 상세(파라미터, 분기). **운영 기본 비활성** |

### 6.3 상관관계 ID (Correlation/Trace ID)

| 규칙 | 내용 |
| --- | --- |
| 진입 생성/전파 | 요청 진입 필터(`CorrelationIdFilter`)에서 `X-Request-Id`/`traceId`를 읽거나 생성 |
| MDC 저장 | SLF4J **MDC**에 `traceId`로 저장하여 전 로그에 자동 포함 |
| 응답 반영 | 응답 헤더 및 에러 응답 `traceId`(§5.3)에 동일 값 노출 |
| 전파 | 외부 호출 시 헤더로 전파해 전 구간 추적(L0 §9.2) |
| 정리 | 요청 종료 시 MDC clear |

### 6.4 민감정보 보호 (L0 §9.1/§9.2)

| 규칙 | 내용 |
| --- | --- |
| 비기록 항목 | 비밀번호/토큰/키/주민번호/카드번호 등 로그 기록 금지 |
| 마스킹 | 부분 노출 불가피한 개인정보는 마스킹(`hong***@***.com`)(추후에 적용)) |
| 페이로드 주의 | 요청/응답 바디 전체 로깅 지양, 필요 시 민감 필드 제거 후 기록 |
| 과도 로깅 금지 | 루프/고빈도 경로의 INFO 로깅 자제, 의미 있는 이벤트 중심(L0 §9.2) |

---

## 7. 트랜잭션 / 데이터 접근 규칙 (Transaction & Data Access)

L0 §9.3(데이터 일관성)과 §8.2(N+1 등 비효율 제거), §4.2(레이어 분리)를 데이터 계층 규칙으로 구체화합니다.

### 7.1 트랜잭션 경계

| 규칙 | 내용 |
| --- | --- |
| 경계 위치 | 트랜잭션 경계는 **서비스(애플리케이션) 레이어**. 컨트롤러/리포지토리에 `@Transactional` 두지 않음 |
| 조회 전용 | 읽기 메서드는 `@Transactional(readOnly = true)` |
| 쓰기 | 상태 변경 메서드는 `@Transactional`(쓰기) |
| 메서드 범위 | public 메서드에만 적용(프록시 한계로 self-invocation 무효 주의) |
| 짧게 유지 | 트랜잭션 내 외부 API 호출/장시간 작업 지양(커넥션 점유 최소화) |
| 롤백 정책 | unchecked 예외 발생 시 롤백(기본). 필요 시 `rollbackFor` 명시 |
| 전파 | 기본 `REQUIRED`. 독립 커밋 필요 시 `REQUIRES_NEW` 신중 사용 |

### 7.2 데이터 접근(ORM) 규칙

| 규칙 | 내용 |
| --- | --- |
| 리포지토리 책임 | Repository는 영속화/조회만. 비즈니스 규칙 포함 금지(§2.1) |
| 엔티티 캡슐화 | setter 남용 금지, 상태 변경은 도메인 메서드로(`defect.assignTo(assignee)`, `testRun.recordResult(PASS)`) |
| 연관관계 로딩 | 컬렉션/다대일은 기본 **`LAZY`**. `EAGER` 지양 |
| N+1 방지 (필수 검증) | 목록 조회는 fetch join / `@EntityGraph` / 배치 사이즈로 N+1 제거(L0 §8.2). **검증 의무**: ① 모든 목록 API 통합 테스트에 Hibernate Statistics 또는 datasource-proxy로 `queryCount ≤ N` 어설션 (예: TC 목록 100건 → 쿼리 ≤ 5건). ② 로컬 개발: `spring.jpa.show-sql=true` + `p6spy`로 PR 리뷰 시점 쿼리 수 확인. ③ CI: PR 마다 N+1 정적 룰(`hibernate-types-no-n-plus-one` 등) 또는 통합 테스트 실패 시 차단. 위반 시 머지 차단. |
| 동적·복잡 조회 | QueryDSL 또는 명시적 쿼리. 문자열 결합 쿼리 금지 |
| 페이지네이션 | §4.7 페이지네이션 룰 (offset / cursor 선택 기준) 정합. 무한정 전체 조회 금지 |
| 프로젝션 | 응답에 필요한 컬럼만 DTO 프로젝션으로 조회(과다 조회 방지) |
| SQL 인젝션 방지 | 파라미터 바인딩만 사용, 외부 입력 문자열 직접 결합 금지(L0 §9.1) |
| 매핑 | 엔티티↔DTO 변환은 매퍼 레이어(`~Mapper`)에서 명시적으로 |

### 7.3 영속성 모델 규칙

| 규칙 | 내용 |
| --- | --- |
| 기본키 | surrogate key(`id`, `bigint` IDENTITY) 권장, 생성 전략 명시 |
| 공통/감사 필드 | **모든 테이블 공통 컬럼**(§1.7)을 `BaseEntity`(`@MappedSuperclass`) + JPA Auditing으로 자동 관리: `createdAt`/`updatedAt`(`@CreatedDate`/`@LastModifiedDate`), `createdBy`/`updatedBy`(`@CreatedBy`/`@LastModifiedBy` + `AuditorAware`) |
| 낙관적 락 | 동시 수정 가능 엔티티는 `@Version`으로 낙관적 락 적용 검토 |
| 삭제 정책 | **물리 삭제(DELETE) 금지, 논리 삭제(`is_deleted=true`)** 원칙. 조회 시 `is_deleted=false` 필터 기본 적용(L0 §2.1 추적성) |
| 엔티티 골격 | `@NoArgsConstructor(access = PROTECTED)` + `@Builder`/정적 팩토리, `@Getter`. **`@Data`/무분별 `@Setter` 금지**(순환참조·캡슐화 붕괴) |
| 연관관계 | `@ManyToOne`/`@OneToOne`은 기본 EAGER이므로 **반드시 `FetchType.LAZY` 명시**, 단방향 우선, 주인은 FK 보유 측, 컬렉션은 `new ArrayList<>()`로 초기화 |
| enum 저장 (Soft Enum 정책, 락 v2.4) | **DB 컬럼은 `varchar(50)`** + metadata-service code_key 참조. JPA 매핑은 `String` 또는 코드 VO. **`@Enumerated`/DB enum 타입 사용 금지** — 운영 자율 등록/수정/미사용을 위해 외부 metadata-service가 진실원. 정합 검증은 §7.7 metadata-client validator. 정본: [`docs/integration/codes.md`](../../integration/codes.md) |
| 스키마 변경 | 운영 스키마는 마이그레이션 도구(Flyway/Liquibase)로 버전 관리, `ddl-auto=update` 운영 사용 금지 |
| **ERD 동기화** | **DB 스키마(테이블·컬럼·제약·관계)를 생성하거나 변경하면 ERD를 반드시 함께 생성·갱신**한다. 스키마와 ERD가 불일치한 상태로 머지하지 않는다(§7.6) |

```java
@Getter
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class BaseEntity {

    @CreatedDate
    @Column(name = "created_at", updatable = false, nullable = false)
    private OffsetDateTime createdAt;        // PostgreSQL timestamptz 매핑

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @CreatedBy
    @Column(name = "created_by", updatable = false)
    private String createdBy;

    @LastModifiedBy
    @Column(name = "updated_by")
    private String updatedBy;

    @Column(name = "is_deleted", nullable = false)
    private boolean deleted = false;         // 논리 삭제 플래그

    public void markDeleted() { this.deleted = true; }   // 물리 삭제 대신 사용
}
```

> 메인 애플리케이션에 `@EnableJpaAuditing`을 선언하고 `AuditorAware<String>`(인증 주체 → `created_by`/`updated_by`)을 등록합니다.

### 7.4 외부 연동 데이터 접근

| 규칙 | 내용 |
| --- | --- |
| 타임아웃 | 모든 외부 호출에 연결/읽기 타임아웃 필수 |
| 회복성 | 재시도/서킷브레이커/폴백으로 실패 격리(§5.5, L0 §9.3) |
| 시크릿 | 외부 자격증명은 환경변수/시크릿 매니저, 코드·로그 비저장(L0 §9.1) |

### 7.5 워크스페이스 격리 (Workspace Isolation)

L0 §9.1 "워크스페이스 격리"를 데이터 계층 규칙으로 구체화합니다. **공유 스키마 + `workspace_id` 행 단위 격리** 방식을 채택합니다(별도 DB/스키마 분리 아님).

| 규칙 | 내용 |
| --- | --- |
| 격리 방식 | 공유 스키마, 워크스페이스 종속 테이블은 `workspace_id`(§1.7) 보유. NOT NULL + 인덱스(복합 인덱스 선두 권장) |
| 현재 워크스페이스 | 인증 컨텍스트(JWT 클레임/세션)에서 현재 `workspaceId`를 확정하고 요청 스코프로 보관 |
| 자동 필터 | **모든 조회/변경은 현재 워크스페이스로 자동 필터**한다. Hibernate `@Filter`(+`@FilterDef`) 또는 공통 베이스 리포지토리/인터셉터로 강제하여 누락을 방지(수동 `where` 의존 금지) |
| 쓰기 시 주입 | 엔티티 생성 시 `workspace_id`를 현재 워크스페이스로 강제 주입(클라이언트 입력값 신뢰 금지) |
| 교차 접근 차단 | 다른 워크스페이스 리소스 접근은 `404`(존재 은닉) 또는 `403`으로 차단. 경로/입력의 `workspace_id`와 인증 컨텍스트 불일치 시 거부 |
| 전역 테이블 예외 | Workspace 루트·시스템 공통 코드 등 전역 테이블은 격리에서 제외(명시적으로 표시) |
| 유니크 제약 | 워크스페이스 내 유일성은 `workspace_id`를 포함한 복합 유니크로 정의(예: `ux_test_cases_workspace_id_code`) |
| 테스트 | 교차 워크스페이스 접근 차단을 통합 테스트로 검증(QA `test-standard` §4.7) |

### 7.6 ERD 생성·갱신 (Schema ↔ ERD 동기화)

**DB 스키마를 새로 만들거나 변경할 때는 ERD를 반드시 함께 생성·갱신**합니다. 스키마(마이그레이션)와 ERD는 항상 같은 PR에서 함께 변경되어야 하며, 코드 리뷰는 둘의 일치를 확인합니다.

| 규칙 | 내용 |
| --- | --- |
| 동반 갱신 | 테이블/컬럼/제약/인덱스/관계(FK)를 추가·수정·삭제하면 ERD를 동일 변경에 맞춰 갱신한다 |
| 단일 PR 원칙 | 마이그레이션(Flyway/Liquibase) 변경과 ERD 갱신을 **같은 PR**에 포함한다. 스키마-ERD 불일치 상태로 머지 금지 |
| 보관 위치 | ERD 정본은 [`docs/dba/erd.md`](../dba/erd.md)에 둔다 (락 v2.4). 위치 변경은 PM 합의 |
| 작성 방식 | DDL/마이그레이션을 기준으로 생성(DBeaver ERD, dbdiagram.io, ERDCloud 등 택1, 팀 내 단일 도구로 통일). 가능하면 DDL→ERD 자동 생성을 우선 |
| 표기 일관성 | ERD의 테이블/컬럼명은 §1.7 명명(소문자 snake_case)·glossary 용어와 일치. 공통 컬럼(`workspace_id`/감사/`is_deleted`)도 누락 없이 표기 |
| PR 본문 | 스키마 변경 PR 본문에 변경 요약과 ERD 갱신 여부를 명시(L0 §6.1) |
| 정의 | "DB 생성·수정"은 신규 테이블 생성뿐 아니라 기존 테이블의 컬럼/제약/관계 변경을 모두 포함한다 |

> ERD는 데이터 모델의 정본 가시화 자료다. 스키마만 바꾸고 ERD를 방치하면 설계 추적성이 깨지므로, **스키마 변경 = ERD 변경**을 한 단위로 취급한다.

### 7.7 metadata-service 통합 (Soft Enum 정책 — 락 v2.4)

**정본**: [`docs/integration/codes.md`](../../integration/codes.md). 도메인 코드(상태/심각도/우선순위/타입 등)는 외부 `metadata-service`(NestJS+Postgres+Redis)에서 동적 관리. 신규 코드 추가/수정/미사용은 운영자가 Admin UI에서 즉시 반영.

| 규칙 | 내용 |
| --- | --- |
| SDK / 호출 | `@yourorg/metadata-client` (Node SDK) 또는 Java/Kotlin 포트. 미보유 시 REST 직접 호출 + 자체 캐시 구현 |
| API 키 | 환경변수 `METADATA_API_KEY` (Vault/Secret Manager 권장). 코드/로그 노출 금지 |
| 부팅 캐시 | 부팅 시 `GET /v1/bundles?groups=<TMS 전체 그룹>` 1회 호출 → in-memory + Redis 캐시 |
| 갱신 정책 | TTL 5분 또는 `GET /v1/version` polling으로 INCR 감지 → 캐시 무효화 + re-fetch |
| 캐시 키 | `(tenantId, groupKey, version)` |
| 쓰기 검증 | 코드 컬럼 포함 요청은 활성 코드 목록 ∈ 검증. 위반 시 `400` + ErrorCode `CODE_NOT_ACTIVE`(§5.2 ErrorCode 체계 정합) |
| 미사용 코드 | 기존 저장 데이터는 표시 가능(라벨 조회), 신규 입력 차단. 표시는 deprecated 표기 권장 |
| 장애 fallback | 캐시 만료 + metadata-service 5xx → 마지막 성공 캐시 유지 (가용성). 부팅 시 도달 불가 → 디스크 캐시 또는 hard-coded fallback |
| FE 프록시 | FE는 metadata-service 직접 호출 금지. `GET /api/codes/:groupKey` 엔드포인트로 프록시 제공 + 응답 캐싱 |
| 코드 컬럼 타입 | `varchar(50)` (§7.3 enum 저장 정책). DB CHECK 제약·DB enum 타입 미사용 |
| 통합 시드 | `scripts/seed-metadata.ts` (작성 예정)로 초기 카탈로그(codes.md §2) idempotent 등록 |
| CI Contract Test | local fixture metadata-service 띄워 카탈로그 정합 + validator 동작 검증 (codes.md §9.1) |

---

## 8. 보안 구체 규칙 (Backend Security Specifics)

L0 §9.1을 서버 측 구체 규칙으로 정리합니다.

### 8.1 일반 원칙

| 영역 | 규칙 |
| --- | --- |
| 입력 검증 | 서버 측 Bean Validation 필수, 화이트리스트 검증, 신뢰 경계에서 정제(L0 §9.1) |
| 인증/인가 | 인증(401)·인가(403) 분리, 메서드/엔드포인트 단위 권한 부여, deny by default |
| 최소 권한 | 토큰/계정/DB 사용자에 최소 권한만 부여 |
| 시크릿 | 코드·저장소·로그에 시크릿 금지, 환경변수/시크릿 매니저 사용 |
| 암호화 | 전송 TLS, 비밀번호 단방향 해시(BCrypt 등), 민감 데이터 저장 암호화 |
| 응답 마스킹 | 개인정보/인증정보 응답·로그 마스킹 |
| 워크스페이스 격리 | 모든 데이터 접근을 현재 워크스페이스로 제한, 교차 워크스페이스 접근 차단(§7.5, L0 §9.1) |
| 정적 보안 분석(SAST) | **Sparrow**로 소스 취약점/시큐어코딩 진단을 CI에 포함, High↑ 차단(§10) |
| 의존성 | 의존성 취약점 스캔 CI 포함, High 이상 머지 차단(L0 §8.2) |
| 헤더/CORS | 보안 헤더 설정, CORS 허용 출처 최소화 |

### 8.2 인증 / 인가 (Authentication & Authorization)

| 항목 | 규칙 |
| --- | --- |
| 인증 방식 | **JWT Bearer 토큰** 사용 (`Authorization: Bearer <token>`) |
| 토큰 만료 | **Access Token 30분, Refresh Token 7일** |
| 세션/토큰 저장 | **Redis로 세션/Refresh Token·토큰 블랙리스트 관리** (무효화·로그아웃 처리) |
| 권한 체크 | **`@PreAuthorize`로 선언적 인가** (메서드 단위), 인가 실패는 403 |
| 미인증/인가실패 | 미인증 401(`AUTH_UNAUTHORIZED`), 권한 부족 403(`AUTH_FORBIDDEN`)로 분리(§5.2) |
| Role | 인가는 glossary §6 Role(Admin/Manager/Tester/Viewer) 기준 |

### 8.3 민감정보 처리

| 항목 | 처리 방법 |
| --- | --- |
| 비밀번호 | **BCrypt 단방향 해시** (평문/가역 저장 금지) |
| 개인정보(주민번호 등) | **AES-256 양방향 암호화** 저장 |
| API Key / Secret | **환경변수로 관리**(코드 하드코딩 금지) |
| 로그/응답 | 개인정보·인증정보 마스킹 후 출력(§6.4) |

### 8.4 환경변수 / 시크릿 관리

- DB 접속 정보·API Key 등 민감 정보는 반드시 **환경변수**로 주입하고 `application.yml`에는 `${ENV}` 참조만 둡니다.
- `.env`는 **`.gitignore`에 포함하여 커밋 금지**, 샘플은 `.env.example`(값 미포함, §0.1)로 공유합니다.
- 팀 내 실제 값 공유는 별도 보안 채널(1Password/Vault 등)을 사용합니다.

```yaml
# 잘못된 예 (하드코딩)
spring:
  datasource:
    password: mypassword123

# 올바른 예 (환경변수 참조)
spring:
  datasource:
    password: ${DB_PASSWORD}
```

---

## 9. 문서화 / 주석 (Documentation in Backend)

L0 §7을 백엔드에 적용합니다.

| 항목 | 규칙 |
| --- | --- |
| 공개 API 주석 | 외부 노출 클래스/메서드는 **Javadoc**(목적, 파라미터, 반환, 예외) 작성(L0 §7.3) |
| Why 중심 | 주석은 "왜"를 설명, 자명한 코드 주석 지양(L0 §7.3) |
| TODO 규칙 | `// TODO(이름, TMS-123): 설명` 형식, 담당/이슈 참조 필수 |
| 죽은 코드 금지 | 주석 처리된 코드 커밋 금지(L0 §7.3) |
| API 명세 | OpenAPI 자동 생성 + `/docs/api`(L0 §7.1) |
| README | 백엔드 루트 README에 개요/요구환경/실행/구조/기여(L0 §7.2) |
| 주석 최신화 | 코드 변경 시 관련 주석/문서 동시 갱신(L0 §7.3) |

---

## 10. 품질 게이트 (Backend Quality Gate)

L0 §8을 백엔드 기준으로 명시합니다(세부 테스트 규칙은 QA 정의서 위임).

| 항목 | 기준 |
| --- | --- |
| 핵심 도메인 커버리지 | 라인/구문 80% 이상(L0 §8.1) |
| 백엔드 전체 커버리지 | 70% 이상(L0 §8.1) |
| 신규/변경 코드 커버리지 | 80% 이상(L0 §8.1) |
| 포매터/린터 | Spotless/Checkstyle/SpotBugs/PMD CI 통과(L0 §8.2) |
| 빌드 경고 | 신규 경고 0건(L0 §8.2) |
| SAST(Sparrow) | Sparrow 정적 보안 분석 통과, High↑ 차단(§8.1) |
| 취약점 스캔 | 의존성 스캔 통과, High 이상 차단(L0 §8.2) |
| 워크스페이스 격리 | 교차 워크스페이스 접근 차단 검증 통과(§7.5) |
| ERD 동기화 | 스키마(마이그레이션) 변경 PR에 ERD 갱신 포함(§7.6) |
| 복잡도/중복 | 임계 초과 시 분할/제거(L0 §8.2) |
| Definition of Done | L0 §8.3 전 항목 충족 시 완료 인정 |

> 본 표는 L0 §8의 기본값을 따릅니다. 도구·예외 규칙의 최종 확정은 QA 정의서(`test-standard.md`)와 정합을 맞춥니다.

---

## 부록 A. 백엔드 표준 빠른 점검표 (Checklist)

- [ ] 클래스/메서드/변수 명명이 §1 표기·접미어 규칙을 따르는가
- [ ] 엔티티를 컨트롤러 입출력에 직접 노출하지 않았는가(§4.4)
- [ ] 트랜잭션 경계가 서비스 레이어에 있고 readOnly가 적절한가(§7.1)
- [ ] N+1·과다 조회가 없는가(§7.2)
- [ ] 에러 응답이 표준 스키마(code/message/traceId/timestamp/path)인가(§5.3)
- [ ] 예외를 silent catch 하지 않았는가(§5.1)
- [ ] 로그에 민감정보가 없고 traceId가 포함되는가(§6)
- [ ] 입력 검증이 서버 측에 존재하는가(§8)
- [ ] 시크릿이 코드/로그에 노출되지 않았는가(§8)
- [ ] 생성자 주입을 사용했는가(§3.3)
- [ ] 워크스페이스 종속 테이블에 `workspace_id`가 있고 격리가 적용되는가(§7.5)
- [ ] **DB 스키마를 생성/변경했다면 ERD를 함께 갱신했는가(§7.6)**

## 부록 B. L0 ↔ L1 매핑 (추적성)

| L0 절 | 본 문서 대응 절 |
| --- | --- |
| §3 명명 규칙 원칙 | §1 명명 규칙 |
| §4 구조 원칙 | §2 패키지/레이어 구조 |
| §7 문서화 | §4.6, §9 |
| §8 품질 | §3.2, §10 |
| §9.1 보안 | §5.5, §7.4, §8 |
| §9.2 로깅 | §6 |
| §9.3 에러 처리 | §5 |

## 부록 C. 문서 변경 이력

| 버전 | 일자 | 변경 내용 | 작성자 |
| --- | --- | --- | --- |
| v1.0 | 2026-06-02 | 최초 작성 (L0 v1.0 기반 구체화) | Backend 에이전트 |
| v1.1 | 2026-06-03 | 이전(legacy) 개발 표준 정의서 통합 및 단독 참조 문서 5종 흡수. ① §0 스택 Java 17→**21(Corretto)**, Maven 3.9.x/PostgreSQL 17 확정, §0.1 공통 설정 파일(.editorconfig/checkstyle/.gitignore/.env.example) 추가. ② §1.7 공통 컬럼(created_at/updated_at/created_by/updated_by/is_deleted) 추가. ③ §4 **HTTP 메서드 GET/POST 전용**으로 개정, §4.5 **단일 공용 응답 래퍼 `ApiResponse`(성공/실패 공유 + 에러 진단 필드)** 확정. ④ §5.2 ErrorCode를 **문자열 의미 코드 `{DOMAIN}_{상황}`**(번호식 폐기), §5.3 에러 응답을 공용 래퍼로 통합. ⑤ §7.3 BaseEntity(감사 컬럼 created_by/updated_by + JPA Auditing)·**물리삭제 금지/soft delete** 구체화. ⑥ §8 보안에 JWT(Access 30분/Refresh 7일)·Redis 세션·`@PreAuthorize`·BCrypt·AES-256·환경변수 관리 추가. (legacy 원문·참조 문서는 `old/`) | Backend 에이전트 |
| v1.2 | 2026-06-03 | **워크스페이스 격리 + SAST(Sparrow)** 반영. ① §1.7 공통 컬럼에 **`workspace_id`** 추가(공유 스키마 행 단위 격리), §7.5 워크스페이스 격리 규칙 신설(자동 필터·쓰기 주입·교차 접근 차단·복합 유니크). ② §0 스택에 **Sparrow(SAST)** 추가, §8.1 보안에 워크스페이스 인가·SAST 행, §10 품질 게이트에 SAST·워크스페이스 격리 검증 추가. (glossary `Workspace`, L0 §9.1 정합) | Backend 에이전트 |
| v1.3 | 2026-06-03 | **ERD 동기화** 규칙 추가. §7.3에 "ERD 동기화" 행, **§7.6 ERD 생성·갱신 규칙 신설**(스키마 변경 시 ERD 동반 갱신·동일 PR·보관 위치 `docs/design/erd`·DDL 기반 생성·표기 일관성), §10 품질 게이트 및 부록 A 점검표에 ERD 항목 추가. (L0 §7.1 정합) | Backend 에이전트 |
