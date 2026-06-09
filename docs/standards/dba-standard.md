# TMS 데이터베이스 표준 정의서 (DBA Standard)

| 항목 | 내용 |
| --- | --- |
| 문서명 | TMS 데이터베이스 표준 정의서 (DBA Standard) |
| 문서 버전 | v1.0 |
| 최초 작성일 | 2026-06-03 |
| 작성 주체 | DBA 에이전트 |
| 문서 등급 | L1 (영역별 세부 표준) |
| 상위 문서 | `docs/standards/development-standard.md` (L0, PM) |
| 참조 정본 | `docs/standards/backend-coding-standard.md` (DB 명명/엔티티/마이그레이션/ERD), `docs/glossary.md` (도메인 용어) |
| 적용 범위 | PostgreSQL 17 물리 스키마 설계 · 마이그레이션 운영 · 성능 · 백업/복구 · DB 보안 · 가용성 |

> 본 문서는 **L0 개발 표준 정의서의 하위(L1) 정의서**입니다. L0의 상위 원칙과 Backend 정의서의 DB 규칙을 **데이터베이스 운영(DBA) 관점**으로 구체화합니다.
> **중복 금지 원칙**: DB 명명·ORM 매핑·애플리케이션 쿼리 등 **Backend 정의서가 정한 항목은 재정의하지 않고 참조**합니다. 본 문서는 물리 스키마/운영/성능/백업/보안 관점만 다룹니다.
> L0·Backend 정의서와 충돌하면 **L0가 우선**하고, 도메인 용어는 **glossary가 우선**합니다. 모호하면 임의 해석하지 않고 PM에게 명확화를 요청합니다.

---

## 0. 확정 환경 (Confirmed Environment)

| 구분 | 확정 | 비고 |
| --- | --- | --- |
| DBMS | **PostgreSQL 17** | L0 §2.4 |
| 마이그레이션 | **Flyway 또는 Liquibase** (택1, 팀 단일 도구로 통일) | backend §7.3 정합 |
| 격리 모델 | **공유 스키마 + `workspace_id` 행 단위 격리** | backend §7.5, L0 §9.1 |
| 클라이언트(운영) | DBeaver | 조회/진단/ERD |
| 환경 | dev / staging / prod 분리 | §9.4 |

---

## 1. 역할 / 책임 경계 (DBA ↔ Backend)

물리 스키마와 운영은 DBA, 애플리케이션 매핑/쿼리는 Backend가 소유합니다. 경계를 명확히 해 중복·충돌을 방지합니다.

| 영역 | 소유 | 비고 |
| --- | --- | --- |
| 논리 명명 규칙(테이블/컬럼/제약/인덱스) | **Backend §1.7 (정본)** | DBA는 준수·검증만, 재정의 금지 |
| 엔티티/ORM 매핑, JPA 설정, 애플리케이션 쿼리 | **Backend §7.1~§7.2** | DBA 미관여(성능 피드백은 제공) |
| 물리 스키마 설계(타입/제약/인덱스/파티션) | **DBA** | 본 문서 §3·§5 |
| 마이그레이션 스크립트 리뷰/승인 | **DBA** (작성은 Backend 가능) | §4 |
| ERD 정합성 검증 | **DBA** (작성은 backend §7.6 절차) | §6 |
| 성능 튜닝(인덱스/실행계획/슬로우 쿼리) | **DBA 주도 + Backend 협업** | §5 |
| 백업/복구·가용성·DB 보안/권한·모니터링 | **DBA** | §7·§8·§9 |

> 명명·매핑 규칙은 **Backend가 정본**입니다. 본 문서가 명명을 다룰 때는 항상 backend §1.7을 인용하며 새 규칙을 만들지 않습니다.

---

## 2. 데이터 모델링 원칙

| 원칙 | 내용 |
| --- | --- |
| 정규화 기준 | 3NF를 기본으로 하고, 성능상 필요한 경우에만 **의도적 비정규화**(근거를 ERD/주석에 명시) |
| 단일 책임 테이블 | 한 테이블은 하나의 도메인 개념(glossary 용어)만 표현 |
| 도메인 용어 일치 | 테이블/컬럼명은 glossary 정본 용어와 일치(backend §1.7): `TestCase`→`test_cases`, `test_case_id` |
| 명시적 관계 | 모든 관계는 FK로 명시하고 ERD에 표현(§6). 암묵적/문자열 참조 금지 |
| 이력/추적성 | 변경 추적이 필요한 도메인은 논리 삭제 + 감사 컬럼(§3.2)으로 보존 |

---

## 3. 물리 스키마 설계 표준

### 3.1 데이터 타입 (PostgreSQL 17)

backend §1.7·§7.3과 정합한 타입을 물리 표준으로 확정합니다.

| 용도 | 표준 타입 | 비고 |
| --- | --- | --- |
| 기본키(PK) | `bigint GENERATED ALWAYS AS IDENTITY` | `serial` 지양 |
| 외래키(FK) | `bigint` | 참조 PK와 동일 타입 |
| 문자열 | `text` | `varchar(n)` 대비 성능 동일, 길이 제약은 `CHECK`로 |
| 시간 | `timestamptz` | timezone 포함 (UTC 저장). `timestamp` 금지 |
| 날짜 | `date` | |
| 금액/정밀수 | `numeric(p,s)` | `float`/`double` 금지 |
| 불리언 | `boolean` | `'Y'/'N'` CHAR 대신 boolean |
| 상태/유형 | `text` + `CHECK` (또는 앱 enum 문자열) | DB enum 타입은 변경 비용이 커 지양, 값은 glossary enum과 일치 |
| 대용량 텍스트/JSON | `text` / `jsonb` | 검색 필요 시 `jsonb` + GIN 인덱스 |

### 3.2 공통 컬럼 (모든 워크스페이스 종속 테이블 필수)

backend §1.7 공통 컬럼의 **물리 정의**입니다(정의 정본은 backend).

| 컬럼 | 타입 | 제약 | 설명 |
| --- | --- | --- | --- |
| `id` | `bigint` IDENTITY | PK | 대리키 |
| `workspace_id` | `bigint` | NOT NULL, FK→`workspaces(id)`, 인덱스 | 워크스페이스 격리 키(§ 워크스페이스, backend §7.5) |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` | 생성 일시 |
| `updated_at` | `timestamptz` | NOT NULL | 수정 일시 |
| `created_by` | `text` | | 생성자 ID(감사) |
| `updated_by` | `text` | | 수정자 ID(감사) |
| `is_deleted` | `boolean` | NOT NULL, DEFAULT `false` | 논리 삭제(물리 DELETE 금지) |

### 3.3 제약 조건 (Constraints)

| 규칙 | 내용 |
| --- | --- |
| PK | 모든 테이블에 단일 대리키 PK(`id`) 정의 |
| FK | 참조 무결성은 FK로 강제, **FK 컬럼에는 반드시 인덱스 생성**(§5) |
| NOT NULL | 기본적으로 NOT NULL 지향, NULL 허용 시 사유를 주석/ERD에 명시 |
| UNIQUE | 워크스페이스 내 유일성은 `workspace_id` 포함 복합 유니크(backend §7.5) 예: `ux_test_cases_workspace_id_code` |
| CHECK | 값 도메인 제약(상태값 화이트리스트, 범위)은 `CHECK`로 방어 |
| 명명 | 제약/인덱스 명명은 backend §1.7 규칙(`pk_`/`fk_`/`ux_`/`ix_`) 준수 |
| ON DELETE | 운영은 논리 삭제이므로 물리 `CASCADE` 남용 금지. 필요 시 `RESTRICT` 기본 |

---

## 4. 마이그레이션 관리 (Schema Migration)

### 4.1 기본 원칙

| 규칙 | 내용 |
| --- | --- |
| 도구 | Flyway 또는 Liquibase로 **모든 스키마 변경을 버전 관리**. 수동 운영 DDL 금지 |
| 운영 자동생성 금지 | `spring.jpa.hibernate.ddl-auto`는 운영 `validate`/`none`만 허용(backend §7.3). `update`/`create` 금지 |
| 단방향 누적 | 마이그레이션은 추가(append)만, 이미 적용·배포된 스크립트는 수정하지 않음 |
| 멱등/원자 | 한 마이그레이션은 하나의 논리적 변경, 가능한 한 트랜잭션 단위로 적용 |
| 명명 | 버전·설명 규칙을 팀 내 통일(예: `V20260603_01__add_workspace_id_to_test_cases.sql`) |

### 4.2 변경 절차 (Workflow)

1. Backend/DBA가 마이그레이션 스크립트 작성 → 2. **ERD 동반 갱신**(backend §7.6) → 3. **DBA 리뷰/승인**(영향·인덱스·락·롤백 점검) → 4. dev→staging 적용·검증 → 5. PR 머지(스키마+ERD 동일 PR) → 6. prod 배포(릴리스 절차).

### 4.3 무중단 마이그레이션 (Expand-Contract)

운영 중 호환성을 깨지 않도록 **확장→이행→축소** 단계로 분리합니다.

| 단계 | 내용 |
| --- | --- |
| Expand | 새 컬럼/테이블 추가(Nullable/기본값), 기존과 병존 |
| Migrate | 데이터 백필(batch), 애플리케이션이 신규 구조 사용하도록 배포 |
| Contract | 구 컬럼/제약 제거(모든 인스턴스가 신규 구조 사용 확인 후) |
| 위험 작업 | 대용량 테이블 인덱스 생성은 `CREATE INDEX CONCURRENTLY`, 컬럼 타입 변경/`NOT NULL` 추가는 락 시간 점검 |
| 롤백 | 각 변경에 롤백 전략(역마이그레이션 또는 보상) 명시 |

---

## 5. 인덱싱 / 성능 (Indexing & Performance)

| 규칙 | 내용 |
| --- | --- |
| FK 인덱스 | 모든 FK 컬럼에 인덱스 필수(조인/삭제 성능) |
| 워크스페이스 선두 | 워크스페이스 종속 조회 인덱스는 **`workspace_id`를 선두 컬럼**으로(복합 인덱스), 격리 필터와 정렬/검색 컬럼을 뒤에 배치 |
| 선택도 우선 | 카디널리티 높은 컬럼 우선, 불필요·중복 인덱스 제거(쓰기 비용 고려) |
| 부분/표현식 인덱스 | 논리 삭제 제외 조회가 잦으면 `WHERE is_deleted = false` 부분 인덱스, 대소문자 무시 검색은 `lower(col)` 표현식 인덱스 |
| 슬로우 쿼리 | 슬로우 쿼리 로깅 활성화, 주기적 리뷰. `EXPLAIN (ANALYZE, BUFFERS)`로 실행계획 검증 |
| 통계/유지 | `ANALYZE`/autovacuum 정상 동작 확인, 대용량 변경 후 통계 갱신 |
| N+1 | 애플리케이션 N+1은 Backend 책임(§backend §7.2). DBA는 인덱스/실행계획으로 지원 |
| 대용량 | 초대용량 테이블은 파티셔닝(범위/리스트) 검토(§9.3) |

---

## 6. ERD 정합성 (Schema ↔ ERD)

backend §7.6 "ERD 동기화"를 DBA 관점에서 보강합니다.

| 규칙 | 내용 |
| --- | --- |
| 동반 갱신 | 스키마 변경 시 ERD를 같은 PR에서 갱신(backend §7.6). DBA는 머지 전 **스키마-ERD 일치를 검증** |
| 보관 | ERD는 `docs/design/erd/`(L0 §7.1) |
| 표현 범위 | 모든 테이블·컬럼·타입·PK/FK/UNIQUE·인덱스·관계(카디널리티)와 공통 컬럼(`workspace_id`/감사/`is_deleted`) 포함 |
| 정합 검증 | DDL/마이그레이션과 ERD가 일치하는지(누락 컬럼/관계 없음) 리뷰 시 확인 |

---

## 7. 백업 / 복구 (Backup & Disaster Recovery)

| 항목 | 표준 |
| --- | --- |
| 정기 백업 | 일 1회 이상 전체 백업 + WAL 아카이빙으로 **PITR(Point-In-Time Recovery)** 구성 |
| 보관 주기 | 백업 보관 기간 정의(예: 일 7 / 주 4 / 월 6), 오프사이트/별도 스토리지 보관 |
| 복구 목표 | **RPO/RTO를 명시**하고 정기 **복구 훈련(restore drill)**으로 실제 복구 가능성 검증 |
| 무결성 검증 | 백업 성공/무결성 자동 점검, 실패 알림 |
| 보안 | 백업본 암호화 저장, 접근 권한 최소화(개인정보 포함 가능) |

---

## 8. DB 보안 / 권한 (Security & Privileges)

L0 §9.1과 backend §8을 DB 계층에서 구체화합니다.

| 항목 | 표준 |
| --- | --- |
| 계정 분리 | 애플리케이션 계정(DML 전용)과 마이그레이션/관리 계정(DDL) 분리, 슈퍼유저 상시 사용 금지 |
| 최소 권한 | 계정·롤에 필요한 최소 권한만 부여(deny by default). 스키마/테이블 단위 GRANT 관리 |
| 접속 제한 | `pg_hba.conf`/네트워크로 접근 출처 제한, 운영 직접 접속 통제 |
| 전송 암호화 | 모든 연결 **TLS** 강제 |
| 저장 암호화 | 개인정보(주민번호 등)는 애플리케이션단 **AES-256**(backend §8.3)으로 저장, DB에는 평문 비저장. 필요 시 디스크/TDE 병행 |
| 비밀번호 | 사용자 비밀번호는 앱에서 BCrypt 해시(backend §8.3), DB에 평문 금지 |
| 시크릿 | DB 자격증명은 환경변수/시크릿 매니저(L0 §9.1), 코드·로그 비저장 |
| 감사 로깅 | 접속/DDL/권한 변경 등 감사 로그 활성화, 민감정보 마스킹 |
| 워크스페이스 격리 | `workspace_id` 행 단위 격리(backend §7.5). 강한 격리가 필요하면 **Row Level Security(RLS)** 적용 검토 |

---

## 9. 가용성 / 운영 (Availability & Operations)

### 9.1 커넥션 / 리소스

| 항목 | 표준 |
| --- | --- |
| 커넥션 풀 | 애플리케이션 풀 상한을 DB `max_connections`와 정합되게 설정(과다 연결 방지). 필요 시 PgBouncer 등 풀러 검토 |
| 타임아웃 | `statement_timeout`/`idle_in_transaction_session_timeout` 설정으로 장시간 점유 차단 |

### 9.2 모니터링

| 지표 | 내용 |
| --- | --- |
| 핵심 지표 | 커넥션 수, 슬로우 쿼리, 캐시 적중률, 락/대기, replication lag, 디스크/테이블 팽창(bloat) |
| 알림 | 임계 초과 시 알림, autovacuum/백업 실패 알림 |

### 9.3 용량 / 파티셔닝

| 항목 | 표준 |
| --- | --- |
| 용량 계획 | 증가율 모니터링, 인덱스/테이블 팽창 정기 점검(VACUUM/REINDEX 계획) |
| 파티셔닝 | 대용량 이력성 테이블(예: 실행 기록)은 시간/범위 파티셔닝 검토 |
| 아카이빙 | 오래된 데이터의 아카이브/콜드 스토리지 전략 |

### 9.4 환경 분리

| 환경 | 원칙 |
| --- | --- |
| dev / staging / prod | 분리 운영, prod 데이터의 하위 환경 복제 시 **개인정보 마스킹/익명화** 필수 |
| 변경 흐름 | 마이그레이션은 dev→staging→prod 순서로만 승격(§4.2) |

---

## 10. 품질 게이트 (DBA Quality Gate)

스키마/운영 변경이 "완료"로 인정되기 위한 조건입니다(L0 §8.3 DoD의 DB 관점).

- [ ] 모든 스키마 변경이 마이그레이션 도구로 버전 관리되었는가(§4.1)
- [ ] **ERD가 스키마와 일치하도록 동일 PR에서 갱신되었는가**(§6, backend §7.6)
- [ ] 워크스페이스 종속 테이블에 `workspace_id`(NOT NULL·인덱스)와 복합 유니크가 적용되었는가(§3.2·§3.3)
- [ ] FK에 인덱스가 있고, 워크스페이스 선두 복합 인덱스 원칙을 따르는가(§5)
- [ ] 위험 작업(대용량 인덱스/타입 변경/NOT NULL 추가)의 락·롤백 전략이 검토되었는가(§4.3)
- [ ] 타입이 표준(`timestamptz`/`text`/`numeric`/`bigint` IDENTITY)을 따르는가(§3.1)
- [ ] 최소 권한 계정·TLS·민감정보 암호화/마스킹이 적용되었는가(§8)
- [ ] 백업/PITR·복구 목표(RPO/RTO)가 정의·검증되었는가(§7)
- [ ] DBA 리뷰/승인을 거쳤는가(§4.2)

---

## 부록 A. 정합성 매핑 (Traceability)

| 본 문서 절 | 근거 |
| --- | --- |
| 1 역할 경계 | L0 §2.3 이해관계자, backend §1.7·§7 |
| 3 물리 스키마/공통 컬럼 | backend §1.7·§7.3, L0 §9.1 |
| 4 마이그레이션 | backend §7.3, L0 §5·§6 |
| 5 인덱싱/성능 | backend §7.2·§7.5, L0 §8.2 |
| 6 ERD | backend §7.6, L0 §7.1 |
| 8 보안/워크스페이스 | L0 §9.1, backend §7.5·§8 |
| 9 환경 분리 | L0 §4.1 |

## 부록 B. 문서 변경 이력

| 버전 | 일자 | 변경 내용 | 작성자 |
| --- | --- | --- | --- |
| v1.0 | 2026-06-03 | 최초 작성. DBA 역할 경계, 물리 스키마 표준(PostgreSQL 17), 마이그레이션(무중단/롤백), 인덱싱/성능, ERD 정합, 백업/복구, DB 보안/권한, 가용성/환경 분리, 품질 게이트 정의. backend(명명/엔티티/워크스페이스/ERD)·L0·glossary 정합. | DBA 에이전트 |
