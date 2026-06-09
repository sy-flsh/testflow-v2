# 개발 표준 정의서 (Legacy / 원문 보관)

> **[보관 안내]** 본 문서는 PM이 제공한 **이전(legacy) 개발 표준 정의서 원문**입니다.
> 현재 표준 체계로의 통합·정렬을 위해 출처/추적성 목적으로 `old/`에 보관합니다.
> **정본은 `docs/standards/`의 L0(`development-standard.md`)·L1(backend/frontend/test-standard) 문서입니다.**
> 본 원문과 현재 정본이 충돌할 경우 정본이 우선합니다. (충돌 항목별 결정 내역은 각 정본 문서의 변경 이력 참조)

---

| 항목 | 내용 |
|------|------|
| 문서명 | 개발 표준 정의서 |
| 프로젝트명 | [프로젝트명 기입] |
| 버전 | v1.0 |
| 작성일 | 2026-05-21 |
| 작성자 | 홍길동 |
| 검토자 | 김철수 |
| 승인자 | 이영희 |
| 상태 | 초안 |

---

## 목차

1. 목적 및 범위
2. 개발 환경
3. 명명 규칙
4. 프로젝트 디렉토리 구조
5. DB 설계 규칙
6. 공통 컴포넌트 및 모듈
7. API 설계 규칙
8. 코딩 스타일 규칙
9. 형상 관리 규칙
10. 테스트 규칙
11. 보안 규칙
12. 변경 이력

---

## 1. 목적 및 범위

### 1.1 목적

본 문서는 프로젝트 참여 개발자 전원이 일관된 기준으로 개발할 수 있도록
명명 규칙, 디렉토리 구조, 코딩 스타일, 형상 관리 등 개발 전반의 표준을 정의한다.
본 문서에 정의된 규칙은 개발 착수 전 모든 팀원이 숙지하고 준수하여야 한다.

### 1.2 적용 범위

- 백엔드 : Java 21 / Spring Boot 3.x
- 프론트엔드 : React 18.x (필요 시 별도 정의)
- 데이터베이스 : PostgreSQL 17
- 인프라 : Docker / Kubernetes / GitLab

### 1.3 참조 문서

- 프로젝트 요구사항 정의서 v1.0
- 시스템 아키텍처 설계서 v1.0
- ERD 설계서 v1.0

---

## 2. 개발 환경

### 2.1 개발 도구

| 구분 | 도구 | 버전 | 비고 |
|------|------|------|------|
| IDE | Visual Studio Code | 1.122 | 개별 세팅|
| JDK | Amazon Corretto | 17 LTS | |
| 빌드 도구 | Maven | 3.9.16 | |
| 컨테이너 | Docker Desktop | 최신 | |
| API 테스트 | Bruno | 최신 | |
| DB 클라이언트 | DBeaver | 최신 | |

### 2.2 공통 설정 파일

팀 내 동일한 코드 스타일 유지를 위해 아래 파일을 프로젝트 루트에 포함한다.

```
.editorconfig       ← 들여쓰기, 인코딩 설정
checkstyle.xml      ← Java 코드 스타일 검사
.gitignore          ← Git 제외 파일 목록
.env.example        ← 환경변수 샘플 (실제 값 미포함)
```

### 2.3 .editorconfig 기본 설정

```ini
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

---

## 3. 명명 규칙

### 3.1 Java 코드 명명 규칙

| 대상 | 규칙 | 예시 |
|------|------|------|
| 클래스 | PascalCase | `UserService`, `OrderController` |
| 인터페이스 | PascalCase | `UserRepository`, `PaymentGateway` |
| 메서드 | camelCase | `getUserById()`, `createOrder()` |
| 변수 | camelCase | `userId`, `orderList` |
| 상수 | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`, `DEFAULT_PAGE_SIZE` |
| 패키지 | 소문자 | `com.unioneinc.tms.user` |
| Enum | PascalCase (값은 UPPER_SNAKE_CASE) | `UserStatus.ACTIVE` |

### 3.2 클래스 Suffix 규칙

| 역할 | Suffix | 예시 |
|------|--------|------|
| 컨트롤러 | `Controller` | `UserController` |
| 서비스 인터페이스 | `Service` | `UserService` |
| 서비스 구현체 | `ServiceImpl` | `UserServiceImpl` |
| 레포지토리 | `Repository` | `UserRepository` |
| 요청 DTO | `Request` | `CreateUserRequest` |
| 응답 DTO | `Response` | `UserResponse` |
| 예외 클래스 | `Exception` | `UserNotFoundException` |
| 설정 클래스 | `Config` | `SecurityConfig` |
| 유틸 클래스 | `Utils` | `DateUtils` |

### 3.3 DB 명명 규칙

PostgreSQL 기준 데이터베이스 명명 규칙 정리. 핵심은 **소문자 snake_case** 통일.

| 객체 | 규칙 | 예시 |
|------|------|------|
| 테이블 | 소문자, snake_case, 복수형 | `users`, `order_items` |
| 컬럼 | 소문자, snake_case | `created_at`, `is_active` |
| PK | `id` (bigint/uuid) | `id` |
| FK 컬럼 | `{단수}_id` | `user_id`, `parent_id` |
| Boolean | `is_` / `has_` 접두사 | `is_active`, `has_paid` |
| 타임스탬프 | `_at` 접미사 | `created_at`, `deleted_at` |
| 날짜 | `_date` / `_on` 접미사 | `birth_date`, `hired_on` |

> 상세 PostgreSQL 명명 규칙은 `old/postgresql-naming-convention.md` 참조.

### 3.4 API URL 명명 규칙

| 규칙 | 올바른 예 | 잘못된 예 |
|------|----------|----------|
| 소문자 kebab-case | `/api/v1/user-orders` | `/api/v1/userOrders` |
| 복수형 명사 사용 | `/api/v1/users` | `/api/v1/user` |
| 동사 사용 금지 | `/api/v1/users/{id}` | `/api/v1/getUser` |
| 버전 포함 | `/api/v1/users` | `/api/users` |

### 3.5 파일/디렉토리 명명 규칙

| 대상 | 규칙 | 예시 |
|------|------|------|
| Java 소스 파일 | PascalCase | `UserService.java` |
| 설정 파일 | 소문자 케밥 | `application-local.yml` |
| SQL 스크립트 | 소문자 스네이크 | `insert_user_data.sql` |
| 프론트 컴포넌트 | PascalCase | `UserProfile.jsx` |
| 프론트 훅/유틸 | camelCase | `useUserInfo.js`, `dateUtils.js` |

---

## 4. 프로젝트 디렉토리 구조

### 4.1 백엔드 디렉토리 구조

```
src/
├── main/
│   ├── java/
│   │   └── com.unione.tms/
│   │       ├── TmsApplication.java     ← 진입점
│   │       ├── common/                     ← 공통 모듈
│   │       │   ├── config/                 ← 설정 클래스
│   │       │   ├── exception/              ← 공통 예외
│   │       │   ├── response/               ← 공통 응답 포맷
│   │       │   └── utils/                  ← 유틸 클래스
│   │       ├── user/                       ← 도메인 단위 패키지
│   │       │   ├── controller/
│   │       │   ├── service/
│   │       │   ├── repository/
│   │       │   ├── domain/                 ← Entity
│   │       │   └── dto/                    ← Request / Response
│   │       └── order/
│   │           ├── controller/
│   │           ├── service/
│   │           ├── repository/
│   │           ├── domain/
│   │           └── dto/
│   └── resources/
│       ├── application.yml
│       ├── application-local.yml
│       ├── application-dev.yml
│       └── application-prod.yml
└── test/
    └── java/
        └── com.unione.tms/
            ├── user/
            └── order/
```

### 4.2 패키지 레이어 역할 정의

| 패키지 | 역할 | 의존 방향 |
|--------|------|----------|
| `controller` | HTTP 요청/응답 처리, 파라미터 검증 | → service |
| `service` | 비즈니스 로직 | → repository, domain |
| `repository` | DB 접근 (JPA/QueryDSL) | → domain |
| `domain` | Entity 클래스 | 없음 (최하위) |
| `dto` | 요청/응답 데이터 객체 | → domain (변환용) |
| `common` | 전역 설정, 예외, 유틸 | 모든 레이어에서 사용 |

> **역방향 의존 금지**: Repository가 Service를 참조하거나, Domain이 Controller를 참조하는 구조는 허용하지 않는다.

---

## 5. DB 설계 규칙

### 5.1 공통 컬럼

모든 테이블에는 아래 공통 컬럼을 반드시 포함한다.

| 컬럼명 | 타입 | 설명 | 비고 |
|--------|------|------|------|
| `created_at` | TIMESTAMP | 생성일시 | NOT NULL, DEFAULT now() |
| `updated_at` | TIMESTAMP | 수정일시 | NOT NULL |
| `created_by` | VARCHAR(50) | 생성자 ID | NOT NULL |
| `updated_by` | VARCHAR(50) | 수정자 ID | NOT NULL |
| `del_yn` | CHAR(1) | 삭제 여부 | 'Y'/'N', DEFAULT 'N' |

### 5.2 데이터 타입 사용 기준

| 용도 | 타입 | 비고 |
|------|------|------|
| PK | BIGINT (auto increment) | SERIAL 또는 SEQUENCE |
| 일반 문자열 | VARCHAR(n) | 길이 명시 필수 |
| 긴 텍스트 | TEXT | |
| 날짜+시간 | TIMESTAMP | 타임존 없는 UTC 기준 |
| 날짜만 | DATE | |
| 금액 | DECIMAL(15, 2) | FLOAT 사용 금지 |
| 상태값 | CHAR(1) 또는 VARCHAR(20) | ENUM 타입 지양 |
| 논리 삭제 | CHAR(1) | 'Y'/'N' |

### 5.3 제약 조건 규칙

- PK는 모든 테이블에 반드시 정의한다
- FK는 반드시 인덱스를 함께 생성한다
- NULL 허용 컬럼은 최소화하며, 허용 시 주석으로 사유를 명시한다
- 물리 삭제(DELETE)는 원칙적으로 금지하고 `del_yn = 'Y'`로 논리 삭제한다

---

## 6. 공통 컴포넌트 및 모듈

### 6.1 공통 응답 포맷

모든 API 응답은 아래 형식을 따른다.

```json
{
  "success": true,
  "code": "200",
  "message": "요청이 정상 처리되었습니다.",
  "data": { }
}
```

```java
@Getter
@AllArgsConstructor
public class ApiResponse<T> {
    private boolean success;
    private String code;
    private String message;
    private T data;

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, "200", "요청이 정상 처리되었습니다.", data);
    }

    public static <T> ApiResponse<T> fail(String code, String message) {
        return new ApiResponse<>(false, code, message, null);
    }
}
```

### 6.2 에러 코드 체계

| 에러 코드 | HTTP 상태 | 의미 |
|----------|----------|------|
| `C001` | 400 | 필수 파라미터 누락 |
| `C002` | 400 | 파라미터 형식 오류 |
| `C003` | 401 | 인증 실패 |
| `C004` | 403 | 권한 없음 |
| `C005` | 404 | 리소스 없음 |
| `C006` | 409 | 중복 데이터 |
| `C999` | 500 | 서버 내부 오류 |
| `U001` | 404 | 사용자 없음 |
| `O001` | 404 | 주문 없음 |

> 도메인별 에러 코드는 도메인 영문 약어 + 순번으로 정의한다.

### 6.3 공통 예외 처리

```java
// 최상위 공통 예외 클래스
public class BusinessException extends RuntimeException {
    private final ErrorCode errorCode;
}

// 전역 예외 핸들러
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<?>> handleBusinessException(BusinessException e) {
        return ResponseEntity
            .status(e.getErrorCode().getHttpStatus())
            .body(ApiResponse.fail(e.getErrorCode().getCode(), e.getMessage()));
    }
}
```

### 6.4 로깅 규칙

| 레벨 | 사용 기준 |
|------|----------|
| `ERROR` | 시스템 오류, 예외 발생 시 |
| `WARN` | 비정상이지만 처리 가능한 상황 |
| `INFO` | 주요 비즈니스 이벤트, 외부 API 호출 |
| `DEBUG` | 개발 중 디버깅 목적 (운영 환경 미출력) |

```java
private static final Logger log = LoggerFactory.getLogger(UserService.class);

@Slf4j
public class UserService { }

log.info("사용자 조회 요청. userId={}", userId);   // 권장
log.info("사용자 조회 요청. userId=" + userId);     // 지양
```

---

## 7. API 설계 규칙

### 7.1 HTTP 메서드 사용 기준

| 메서드 | 용도 | 예시 |
|--------|------|------|
| `GET` | 단건/목록 조회 | `GET /api/v1/users/{id}` |
| `POST` | 리소스 생성 | `POST /api/v1/users` |
| `PUT` | 리소스 전체 수정 | `PUT /api/v1/users/{id}` |
| `PATCH` | 리소스 부분 수정 | `PATCH /api/v1/users/{id}/status` |
| `DELETE` | 리소스 삭제 | `DELETE /api/v1/users/{id}` |

- `GET`, `POST` 방식만 사용한다.

### 7.2 요청/응답 규칙

- 요청 본문(Body)은 JSON 형식만 허용 (`Content-Type: application/json`)
- 날짜/시간은 ISO 8601 형식 사용 (`2026-05-21T09:00:00Z`)
- 페이징은 `page`(0 기반), `size`, `sort` 파라미터 통일
- 목록 응답에는 `totalElements`, `totalPages` 포함

```json
{
  "success": true,
  "code": "200",
  "message": "요청이 정상 처리되었습니다.",
  "data": {
    "content": [ ],
    "totalElements": 100,
    "totalPages": 10,
    "currentPage": 0,
    "size": 10
  }
}
```

### 7.3 파라미터 검증

- 요청 DTO에 Bean Validation 어노테이션 반드시 적용
- Controller에서 `@Valid` 선언 필수

```java
public record CreateUserRequest(
    @NotBlank(message = "이름은 필수입니다.")
    String name,

    @Email(message = "이메일 형식이 올바르지 않습니다.")
    @NotBlank
    String email,

    @Size(min = 8, message = "비밀번호는 8자 이상이어야 합니다.")
    String password
) {}
```

---

## 8. 코딩 스타일 규칙

### 8.1 기본 규칙

| 항목 | 규칙 |
|------|------|
| 들여쓰기 | 스페이스 4칸 (탭 금지) |
| 최대 줄 길이 | 120자 |
| 인코딩 | UTF-8 |
| 줄 끝 | LF (CRLF 금지) |
| 빈 줄 | 메서드 간 1줄, 논리 블록 구분 시 1줄 |

### 8.2 주석 규칙

```java
/**
 * 사용자 단건 조회
 *
 * @param userId 사용자 ID
 * @return 사용자 정보
 * @throws UserNotFoundException 사용자가 존재하지 않는 경우
 */
public UserResponse getUserById(Long userId) {
    return userRepository.findById(userId)
        .map(UserResponse::from)
        .orElseThrow(() -> new UserNotFoundException(userId));
}
```

- 공개 메서드(public)에는 JavaDoc 주석 작성을 원칙으로 한다
- 코드로 의도가 명확한 경우 인라인 주석 생략 가능
- 주석 처리된 코드(Dead Code)는 커밋에 포함하지 않는다
- 주요 로직은 한 줄 주석 추가

### 8.3 금지 사항

- `System.out.println()` 사용 금지 (Logger 사용)
- `e.printStackTrace()` 사용 금지 (Logger로 처리)
- 매직 넘버/문자열 직접 사용 금지 (상수로 선언)
- 미사용 import 방치 금지

```java
// 금지
if (user.getStatus().equals("A")) { ... }

// 권장
if (user.getStatus() == UserStatus.ACTIVE) { ... }
```

---

## 9. 형상 관리 규칙

### 9.1 브랜치 전략 (GitHub Flow 기반)

```
main          ← 운영 배포 브랜치 (직접 push 금지)
  └── develop ← 개발 통합 브랜치
        ├── feature/이슈번호-기능명    ← 기능 개발
        ├── bugfix/이슈번호-버그명     ← 버그 수정
        └── hotfix/이슈번호-긴급수정명 ← 운영 긴급 패치
```

### 9.2 브랜치 명명 예시

```
feature/123-user-login
bugfix/456-order-null-pointer
hotfix/789-payment-timeout
```

### 9.3 커밋 메시지 규칙

형식: `{타입}: {제목} (#{이슈번호})`

| 타입 | 설명 |
|------|------|
| `feat` | 새로운 기능 추가 |
| `fix` | 버그 수정 |
| `refactor` | 코드 리팩토링 (기능 변경 없음) |
| `docs` | 문서 수정 |
| `test` | 테스트 코드 추가/수정 |
| `chore` | 빌드, 설정 변경 |
| `style` | 코드 포맷팅, 세미콜론 등 |

```bash
# 올바른 예
feat: 사용자 로그인 API 구현 (#123)
fix: 주문 생성 시 재고 차감 누락 수정 (#456)
refactor: UserService 메서드 분리 (#789)

# 잘못된 예
수정함
작업중
fix

# 주석 처리
- 수정한 내용 분석해서 한 줄 커밋 메세지 생성
```

### 9.4 PR(Pull Request) or MR(Merge Request) 규칙

- PR 제목은 커밋 메시지 형식과 동일하게 작성
- PR 본문에 작업 내용, 테스트 결과, 관련 이슈 번호 포함
- 최소 1명 이상의 코드 리뷰 승인 후 머지
- `main` 브랜치 머지는 반드시 PR을 통해서만 수행
- Merge 방식: **Squash and Merge** 사용 (커밋 이력 정리)

---

## 10. 테스트 규칙

### 10.1 테스트 도구

| 구분 | 도구 |
|------|------|
| 단위 테스트 | JUnit 5 + Mockito |
| 통합 테스트 | Spring Boot Test + MockMvc |
| 커버리지 | JaCoCo |

### 10.2 커버리지 목표

| 레이어 | 목표 |
|--------|------|
| Service | 80% 이상 |
| Controller | 70% 이상 |
| 전체 평균 | 75% 이상 |

> 커버리지 미달 시 CI 빌드 실패 처리

### 10.3 테스트 작성 원칙

- 테스트 메서드명: `{메서드명}_{시나리오}_{기댓값}` 형식
- AAA 패턴 준수 (Arrange → Act → Assert)
- 테스트 간 독립성 보장 (`@Transactional`로 롤백)
- 외부 의존성은 Mock 처리

---

## 11. 보안 규칙

### 11.1 인증/인가

- 인증은 JWT Bearer 토큰 방식 사용
- 토큰 만료 시간: Access Token 30분, Refresh Token 7일
- 권한 체크는 `@PreAuthorize` 어노테이션으로 선언적 처리
- redis로 세션 관리

### 11.2 민감정보 처리

| 항목 | 처리 방법 |
|------|----------|
| 비밀번호 | BCrypt 단방향 암호화 |
| 개인정보 (주민번호 등) | AES-256 양방향 암호화 |
| API Key / Secret | 환경변수로 관리 (코드에 하드코딩 금지) |
| 로그 | 개인정보 마스킹 후 출력 |

### 11.3 환경변수 관리

- DB 접속 정보, API Key 등 민감 정보는 반드시 환경변수로 관리
- `.env` 파일은 `.gitignore`에 포함하여 Git에 커밋하지 않음
- 팀 내 공유는 별도 보안 채널(1Password, Vault 등) 활용

```yaml
# 잘못된 예 (application.yml에 하드코딩)
spring:
  datasource:
    password: mypassword123

# 올바른 예 (환경변수 참조)
spring:
  datasource:
    password: ${DB_PASSWORD}
```

---

## 12. 변경 이력

| 버전 | 변경일 | 변경 내용 | 작성자 |
|------|--------|----------|--------|
| v1.0 | 2026-05-21 | 최초 작성 | 홍길동 |

---

> **문의** : 개발 표준 관련 문의는 Slack `#dev-standard` 채널 또는 아키텍트에게 직접 문의
