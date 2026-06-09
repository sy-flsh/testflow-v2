# 에러 코드 체계 (Error Code Convention)

REST API / Spring Boot 기준으로 가장 보편적으로 쓰이는 에러 코드 설계 가이드.
핵심은 **HTTP 상태 코드 + 비즈니스 에러 코드 + 일관된 응답 포맷** 3박자입니다.

---

## 1. 2단계 분리 원칙

| 구분 | 역할 | 예시 |
|------|------|------|
| **HTTP Status Code** | 통신/프로토콜 수준의 결과 | `400`, `401`, `404`, `500` |
| **Business Error Code** | 애플리케이션 도메인 수준의 구체 원인 | `USER_NOT_FOUND`, `U001` |

> HTTP 상태 코드만으로는 "왜" 실패했는지 부족하므로, **별도의 비즈니스 에러 코드**를 함께 내려주는 것이 표준입니다.

---

## 2. HTTP 상태 코드 사용 기준

| 코드 | 의미 | 사용 시점 |
|------|------|-----------|
| `200 OK` | 성공 | 정상 응답 |
| `201 Created` | 생성됨 | 리소스 생성 성공 |
| `204 No Content` | 성공, 본문 없음 | 삭제 성공 등 |
| `400 Bad Request` | 잘못된 요청 | 유효성 검증 실패, 파라미터 오류 |
| `401 Unauthorized` | 인증 안 됨 | 로그인 필요, 토큰 없음/만료 |
| `403 Forbidden` | 권한 없음 | 인증됐지만 접근 권한 부족 |
| `404 Not Found` | 리소스 없음 | 대상 데이터 없음 |
| `409 Conflict` | 충돌 | 중복 데이터, 상태 충돌 |
| `422 Unprocessable Entity` | 처리 불가 | 비즈니스 규칙 위반 |
| `429 Too Many Requests` | 요청 과다 | Rate Limit 초과 |
| `500 Internal Server Error` | 서버 오류 | 처리되지 않은 예외 |
| `503 Service Unavailable` | 서비스 불가 | 점검, 과부하 |

---

## 3. 비즈니스 에러 코드 네이밍 — 2가지 방식

### (A) 문자열 의미 기반 (권장 · 가독성 우수)

```
{도메인}_{상황}
```

| 에러 코드 | HTTP | 설명 |
|-----------|------|------|
| `USER_NOT_FOUND` | 404 | 사용자를 찾을 수 없음 |
| `USER_ALREADY_EXISTS` | 409 | 이미 존재하는 사용자 |
| `INVALID_PASSWORD` | 400 | 비밀번호 형식 오류 |
| `AUTH_TOKEN_EXPIRED` | 401 | 인증 토큰 만료 |
| `ORDER_ALREADY_PAID` | 409 | 이미 결제된 주문 |
| `INSUFFICIENT_STOCK` | 422 | 재고 부족 |

### (B) 코드 번호 기반 (대규모·다국어·외부연동에 유리)

```
{도메인접두사}{일련번호}
```

| 에러 코드 | HTTP | 설명 |
|-----------|------|------|
| `C001` | 500 | 공통 - 서버 내부 오류 |
| `C002` | 400 | 공통 - 잘못된 입력값 |
| `U001` | 404 | User - 사용자 없음 |
| `U002` | 409 | User - 중복 사용자 |
| `A001` | 401 | Auth - 토큰 만료 |
| `O001` | 422 | Order - 재고 부족 |

> **선택 가이드**
> - 내부/중소 서비스, 로그 가독성 중시 → **(A) 문자열 방식**
> - 대규모, 외부 파트너 연동, 다국어 메시지 매핑 → **(B) 번호 방식**
> - 둘을 **혼합**해 `code`(번호) + `name`(문자열) 둘 다 내려주는 곳도 많음

---

## 4. 표준 에러 응답 포맷 (JSON)

```json
{
  "timestamp": "2026-06-03T14:30:00+09:00",
  "status": 404,
  "code": "USER_NOT_FOUND",
  "message": "해당 사용자를 찾을 수 없습니다.",
  "path": "/api/v1/users/123",
  "errors": []
}
```

유효성 검증 실패 시 (`errors` 활용):

```json
{
  "timestamp": "2026-06-03T14:30:00+09:00",
  "status": 400,
  "code": "INVALID_INPUT",
  "message": "입력값이 올바르지 않습니다.",
  "path": "/api/v1/users",
  "errors": [
    { "field": "email",    "reason": "이메일 형식이 아닙니다." },
    { "field": "password", "reason": "8자 이상이어야 합니다." }
  ]
}
```

| 필드 | 설명 |
|------|------|
| `timestamp` | 에러 발생 시각 (ISO-8601) |
| `status` | HTTP 상태 코드 |
| `code` | 비즈니스 에러 코드 |
| `message` | 사용자/개발자용 메시지 |
| `path` | 요청 경로 |
| `errors` | 필드별 상세 오류 (유효성 검증 시) |

---

## 5. Spring Boot 구현 예시

### ErrorCode Enum (중앙 집중 관리)

```java
@Getter
@RequiredArgsConstructor
public enum ErrorCode {

    // Common
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "C001", "서버 내부 오류가 발생했습니다."),
    INVALID_INPUT(HttpStatus.BAD_REQUEST,            "C002", "입력값이 올바르지 않습니다."),

    // User
    USER_NOT_FOUND(HttpStatus.NOT_FOUND,             "U001", "사용자를 찾을 수 없습니다."),
    USER_ALREADY_EXISTS(HttpStatus.CONFLICT,         "U002", "이미 존재하는 사용자입니다."),

    // Auth
    TOKEN_EXPIRED(HttpStatus.UNAUTHORIZED,           "A001", "인증 토큰이 만료되었습니다.");

    private final HttpStatus status;
    private final String code;
    private final String message;
}
```

### 커스텀 예외

```java
@Getter
public class BusinessException extends RuntimeException {
    private final ErrorCode errorCode;

    public BusinessException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }
}
```

### 전역 예외 핸들러

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ErrorResponse> handleBusiness(BusinessException e,
                                                        HttpServletRequest request) {
        ErrorCode ec = e.getErrorCode();
        ErrorResponse body = ErrorResponse.of(ec, request.getRequestURI());
        return ResponseEntity.status(ec.getStatus()).body(body);
    }
}
```

---

## 6. 설계 원칙 (Best Practice)

1. **에러 코드는 한 곳(Enum)에서 중앙 관리** — 흩어지면 중복·충돌 발생.
2. **코드는 불변(immutable)** — 한 번 배포된 코드 값은 의미를 바꾸지 말 것 (클라이언트가 의존).
3. **도메인별 접두사**로 그룹핑 — `U`, `A`, `O` / `USER_`, `AUTH_`.
4. **민감 정보 노출 금지** — 스택트레이스·내부 쿼리·시스템 경로를 응답에 포함하지 말 것.
5. **메시지와 코드 분리** — 코드는 식별자, 메시지는 다국어 매핑 대상으로 취급.
6. **HTTP 상태와 의미 일치** — `200`에 에러 코드를 담는 안티패턴 지양.
7. **문서화** — 에러 코드 목록을 API 문서(Swagger 등)에 반드시 명시.

---

## 요약

> - **HTTP 상태 코드(통신) + 비즈니스 에러 코드(도메인)** 2단계 분리
> - 에러 코드는 **`{도메인}_{상황}` 문자열** 또는 **`{접두사}{번호}`** 방식
> - **일관된 JSON 응답 포맷** (`timestamp`/`status`/`code`/`message`/`path`/`errors`)
> - **ErrorCode Enum + 전역 예외 핸들러(@RestControllerAdvice)** 로 중앙 관리
