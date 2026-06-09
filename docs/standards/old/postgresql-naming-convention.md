# PostgreSQL DB 명명 규칙 (Naming Convention)

PostgreSQL 기준 데이터베이스 명명 규칙 정리. 핵심은 **소문자 snake_case** 통일입니다.

## 1. 가장 중요한 원칙: 항상 소문자 snake_case

PostgreSQL은 따옴표로 감싸지 않은 식별자를 **자동으로 소문자로 변환**합니다.

```sql
CREATE TABLE Users (userName text);   -- 실제로는 users, username 으로 저장됨
SELECT "userName" FROM "Users";        -- 따옴표를 강제로 써야만 접근 가능 → 비추천
```

→ 처음부터 **소문자 snake_case만 사용**하세요. `camelCase` / `PascalCase`는 피합니다.

## 2. 객체별 규칙

| 객체 | 규칙 | 예시 |
|------|------|------|
| 테이블 | 소문자, snake_case, 복수형 | `users`, `order_items` |
| 컬럼 | 소문자, snake_case | `created_at`, `is_active` |
| PK | `id` (bigint/uuid) | `id` |
| FK 컬럼 | `{단수}_id` | `user_id`, `parent_id` |
| Boolean | `is_` / `has_` 접두사 | `is_active`, `has_paid` |
| 타임스탬프 | `_at` 접미사 | `created_at`, `deleted_at` |
| 날짜 | `_date` / `_on` 접미사 | `birth_date`, `hired_on` |

## 3. 제약조건 / 인덱스 — PostgreSQL 기본 패턴

PostgreSQL이 자동 생성하는 이름 규칙을 따르면 일관성이 좋습니다.

```
{테이블}_{컬럼들}_{접미사}
```

| 종류 | 접미사 | 예시 |
|------|--------|------|
| Primary Key | `_pkey` | `users_pkey` |
| Unique | `_key` | `users_email_key` |
| Foreign Key | `_fkey` | `orders_user_id_fkey` |
| Index | `_idx` | `users_email_idx` |
| Check | `_check` | `users_age_check` |
| Exclusion | `_excl` | `bookings_room_id_excl` |

명시적으로 직접 지을 때 예시:

```sql
CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
CREATE INDEX users_email_idx ON users (email);
CREATE UNIQUE INDEX users_email_key ON users (lower(email));
```

> 참고: 일부 팀은 `idx_`, `fk_`처럼 **접두사** 스타일을 쓰기도 합니다. 둘 다 유효하지만,
> PostgreSQL 자동생성 규칙과 맞추려면 접미사 스타일(`_idx`, `_fkey`)이 더 자연스럽습니다.

## 4. PostgreSQL 특화 주의사항

- **식별자 길이 제한: 63 바이트** — 초과분은 잘림(truncate). 긴 테이블명+컬럼명 조합 시 인덱스명 충돌 주의.
- **예약어 회피** — `user`, `order`, `group`, `table` 등은 예약어. 복수형(`users`, `orders`)으로 자연스럽게 회피.
- **스키마 적극 활용** — `public`에 몰아넣지 말고 도메인별 분리: `auth.users`, `billing.invoices`.

### 타입 선택 관례

| 용도 | 권장 | 비고 |
|------|------|------|
| PK | `bigint GENERATED ALWAYS AS IDENTITY` 또는 `uuid` | 구식 `serial`보다 권장 |
| 문자열 | `text` | `varchar(n)` 대비 성능 차이 없음 |
| 시간 | `timestamptz` | timezone 포함, `timestamp`보다 강력 권장 |
| 금액 | `numeric` | `float` 금지 |

## 5. 종합 예시

```sql
CREATE TABLE orders (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      bigint NOT NULL REFERENCES users(id),
    status       text NOT NULL DEFAULT 'pending',
    total_amount numeric(12,2) NOT NULL,
    is_paid      boolean NOT NULL DEFAULT false,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX orders_user_id_idx ON orders (user_id);
CREATE INDEX orders_created_at_idx ON orders (created_at);
```

## 요약

> **소문자 snake_case + 복수형 테이블 + `timestamptz`/`text`/`numeric` 타입 + PostgreSQL 자동생성 네이밍(`_pkey`/`_fkey`/`_idx`)**
>
> 규칙 자체보다 **팀 내 일관성**이 가장 중요합니다.
