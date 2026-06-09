# REST API URL 설계 규칙 (URL Depth / Path Convention)

REST API의 URL 경로(Path) 설계에서 가장 보편적으로 쓰이는 규칙 정리.
핵심은 **리소스 중심 + 명사 복수형 + 적절한 깊이(Depth) 제한**입니다.

---

## 1. 기본 원칙

| 원칙 | 설명 | 예시 |
|------|------|------|
| 리소스는 **명사 복수형** | 동사 대신 자원을 표현 | `/users` (O), `/getUsers` (X) |
| 소문자 + **kebab-case** | 단어 구분은 하이픈 | `/order-items` (O), `/orderItems` (X) |
| 행위는 **HTTP 메서드**로 | URL에 동사 금지 | `GET /users`, `DELETE /users/1` |
| 끝에 슬래시(/) 금지 | 일관성 | `/users` (O), `/users/` (X) |
| 버전 명시 | 경로 또는 헤더로 | `/api/v1/users` |

---

## 2. URL Depth(깊이) 구조 — 가장 많이 쓰이는 형태

### 기본 패턴

```
/api/{version}/{resource}/{id}/{sub-resource}/{sub-id}
   1     2          3        4         5           6
```

| 깊이 | 구성 | 예시 |
|------|------|------|
| 컬렉션 | `/리소스` | `/api/v1/users` |
| 단일 항목 | `/리소스/{id}` | `/api/v1/users/123` |
| 하위 컬렉션 | `/리소스/{id}/하위리소스` | `/api/v1/users/123/orders` |
| 하위 단일 | `/리소스/{id}/하위리소스/{id}` | `/api/v1/users/123/orders/456` |

### ⭐ 깊이는 2단계(리소스 중첩 1회)까지 권장

```
/api/v1/users/123/orders            ✅ 권장 (1단계 중첩)
/api/v1/users/123/orders/456        ✅ 허용 (단일 조회까지)
/api/v1/users/123/orders/456/items/789   ⚠️ 과도한 중첩 → 지양
```

> **규칙**: 리소스 중첩(`/parent/{id}/child`)은 **1단계까지**가 가장 보편적.
> 그 이상 깊어지면 URL이 복잡해지고 결합도가 높아집니다.

---

## 3. 깊은 중첩을 피하는 방법

3단계 이상으로 깊어질 것 같으면, **최상위 리소스로 평탄화(flatten)** 합니다.

```
# ❌ 과도한 중첩
GET /api/v1/users/123/orders/456/items/789

# ✅ 평탄화 — items를 독립 리소스로
GET /api/v1/order-items/789
GET /api/v1/orders/456/items          # 필요한 컨텍스트만 1단계 유지
```

**판단 기준**
- 하위 리소스가 **독립적으로 식별 가능**하면 → 최상위로 분리
- 하위 리소스가 **부모 없이는 의미 없으면** → 중첩 유지 (1단계)

---

## 4. 필터·정렬·페이징은 Path가 아닌 Query String

```
# ❌ 경로 깊이로 표현
GET /api/v1/users/active/page/2/sort/name

# ✅ 쿼리 파라미터로 표현
GET /api/v1/users?status=active&page=2&size=20&sort=name,asc
```

| 용도 | 쿼리 파라미터 |
|------|---------------|
| 필터링 | `?status=active&role=admin` |
| 페이징 | `?page=0&size=20` |
| 정렬 | `?sort=createdAt,desc` |
| 검색 | `?keyword=hong` |

> 경로는 **"무엇(자원)"**, 쿼리는 **"어떻게(조건)"** 를 표현합니다.

---

## 5. HTTP 메서드와 URL 매핑

| 동작 | 메서드 | URL | 설명 |
|------|--------|-----|------|
| 목록 조회 | `GET` | `/users` | 컬렉션 |
| 단건 조회 | `GET` | `/users/{id}` | 단일 |
| 생성 | `POST` | `/users` | 컬렉션에 추가 |
| 전체 수정 | `PUT` | `/users/{id}` | 전체 교체 |
| 부분 수정 | `PATCH` | `/users/{id}` | 일부 변경 |
| 삭제 | `DELETE` | `/users/{id}` | 제거 |
| 하위 목록 | `GET` | `/users/{id}/orders` | 연관 리소스 |

---

## 6. 행위(동사)가 꼭 필요한 경우

CRUD로 표현 안 되는 액션은 하위 경로에 **동사를 예외적으로** 허용합니다.

```
POST /api/v1/users/123/activate        # 사용자 활성화
POST /api/v1/orders/456/cancel         # 주문 취소
POST /api/v1/auth/login                # 로그인
POST /api/v1/articles/789/like         # 좋아요
```

> 남용 금지 — 진짜 CRUD로 표현 불가능한 도메인 액션에만 사용.

---

## 7. 종합 예시 (TMS 가정)

```
# 테스트 케이스
GET    /api/v1/test-cases                      # 목록
POST   /api/v1/test-cases                      # 생성
GET    /api/v1/test-cases/{id}                 # 단건
PATCH  /api/v1/test-cases/{id}                 # 수정
DELETE /api/v1/test-cases/{id}                 # 삭제

# 하위 리소스 (1단계 중첩)
GET    /api/v1/test-cases/{id}/steps           # 케이스의 스텝 목록
GET    /api/v1/test-suites/{id}/test-cases     # 스위트의 케이스 목록

# 액션
POST   /api/v1/test-runs/{id}/execute          # 테스트 실행
POST   /api/v1/test-runs/{id}/abort            # 실행 중단

# 필터/페이징
GET    /api/v1/test-cases?status=active&page=0&size=20&sort=createdAt,desc
```

---

## 요약

> - URL은 **명사 복수형 + kebab-case + HTTP 메서드로 행위 표현**
> - 리소스 중첩(Depth)은 **1단계까지** 권장, 깊어지면 **최상위로 평탄화**
> - 필터·정렬·페이징은 **경로가 아닌 쿼리 스트링**
> - CRUD 불가한 도메인 액션만 **예외적으로 동사** 허용
> - 버전은 `/api/v1/` 형태로 명시
