# TMS ↔ Metadata Service 코드 통합 정본

| 항목 | 내용 |
| --- | --- |
| 문서명 | TMS 코드(Codes) 외부 관리 통합 정본 |
| 문서 버전 | v1.0 (P1) |
| 최초 작성일 | 2026-06-08 |
| 작성 주체 | PM 에이전트 |
| 문서 등급 | 정본 — 코드/메타데이터 단일 진실 원 (TMS 측 통합 규약) |
| 외부 시스템 | `metadata-service` (NestJS 10 + Prisma 5 + PG 15 + Redis 7). 위치: `/Users/songzuen/Documents/codes/` |
| 관련 정본 | `docs/dba/erd.md` (코드 컬럼 타입) · `docs/standards/backend-coding-standard.md` (코드 조회 SDK 사용) · `docs/standards/frontend-coding-standard.md` (디자인 토큰·라벨 표시) · `docs/api/openapi.yaml` (코드 의존 enum 타입) |

> TMS 도메인 코드(상태·심각도·우선순위 등)는 **DB enum CHECK 제약을 사용하지 않고** 외부 metadata-service를 진실원으로 한다. 운영자가 Admin UI에서 코드 등록/수정/미사용(soft delete) 변경 가능. ERD 컬럼은 `varchar(50)` + comment로 metadata code_key 참조.

---

## 1. 통합 패턴 결정

### 1.1 패턴 선택 (Soft Enum)

| 선택지 | 정합 보장 | 운영 유연성 | 결정 |
| --- | --- | --- | --- |
| A. ERD enum CHECK 유지 (정적) | 강 (DB 보장) | 약 (마이그레이션 필요) | ❌ |
| B. 하이브리드 (ERD CHECK + metadata 메타정보) | 중 | 중 | ❌ |
| **C. Soft Enum** — varchar + metadata 진실원 | 약 (앱·CI 보장) | 강 (Admin UI 즉시) | ✅ **채택** |

- 정합 보장은 **앱 레이어(metadata cache + validator) + CI(스키마 contract test)** 에서 수행.
- DB 제약 제거로 신규 코드 추가/미사용 시 마이그레이션·배포 없이 즉시 운영 반영.

### 1.2 컬럼 타입 정책

| 항목 | 정책 |
| --- | --- |
| 컬럼 타입 | `varchar(50)` |
| NULL 허용 | 정책에 따름 (e.g. `defects.status` NOT NULL) |
| comment | `'metadata-service code_key: <group_key>'` (예: `tms.defect_status`) |
| 인덱스 | 필요 시 단일/복합 (격리키 선두 원칙 유지) |
| FK | 없음 (외부 시스템, DB FK 불가) |
| 정합 검증 | BE 시작 시 metadata bundle 캐시 + 쓰기 경로에서 validator |

### 1.3 ID 명명

- **CodeGroup key**: `tms.<도메인>` snake_case. 예: `tms.execution_result`, `tms.defect_status`.
- **Code key**: UPPER_SNAKE_CASE. 예: `PASS`, `IN_PROGRESS`.
- DB 저장 값 = `code_key` 그대로 (group prefix 없이). 그룹은 컬럼별로 고정 매핑.

---

## 2. 코드 그룹 카탈로그 (정본)

TMS가 관리하는 CodeGroup 목록. 운영 시 Admin UI에서 코드 추가/수정/미사용 가능. 본 카탈로그는 **그룹 정의 자체의 정본**이며 그룹 추가/제거는 RFC 절차.

| Group Key | 설명 | 사용 컬럼 (ERD) | 초기 코드 (MVP) | 미사용 코드 |
| --- | --- | --- | --- | --- |
| `tms.execution_result` | TC 실행 결과 | `test_runs.result`, `test_run_steps.result` | `PASS`, `FAIL`, `BLOCKED`, `SKIPPED`, `UNTESTED`, `PENDING` | `RETEST` (Phase 2 후보, 초기 비활성) |
| `tms.test_run_status` | TestRun 헤더 상태 | `test_runs.status` | `IN_PROGRESS`, `COMPLETED` | - |
| `tms.defect_status` | 결함 상태 | `defects.status` | `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED` | `REOPENED`, `WONT_FIX` (Phase 2 후보) |
| `tms.defect_severity` | 결함 심각도 | `defects.severity` | `CRITICAL`, `MAJOR`, `MINOR`, `TRIVIAL` | - |
| `tms.priority` | TC/Defect 공용 우선순위 | `test_cases.priority`, `defects.priority` | `HIGH`, `MEDIUM`, `LOW` | `URGENT` (옵션 A 결정으로 제거됨, 운영 추가 가능) |
| `tms.tc_scope` | TestCase Scope | `test_cases.scope_type` | `GLOBAL`, `WORKSPACE`, `PROJECT` | - |
| `tms.role` | (참고) Role 6단 — 시스템 enum, 변경 권장 X | `user_roles.role` | `MASTER`, `CO`, `WO`, `PO`, `MEMBER`, `VIEWER` | - |
| `tms.scope` | (참고) Role Scope 타입 | `user_roles.scope_type`, `invitations.scope_type` | `COMPANY`, `WORKSPACE`, `PROJECT` | - |
| `tms.invite_status` | (derived) 초대 상태 — DB 컬럼 없음, derive 로직 | (`invitations.expires_at`/`accepted_at`/`cancelled_at` 조합) | `PENDING`, `ACTIVE`, `WITHDRAWN`, `EXPIRED` | - |
| `tms.attachment_owner_type` | 첨부 owner type | `attachments.owner_type` | `TESTCASE`, `TESTRUN_STEP`, `DEFECT`, `COMMENT` | - |
| `tms.test_plan_status` | TestPlan 상태 | `test_plans.status` | `DRAFT`, `ACTIVE`, `ARCHIVED` | - |
| `tms.step_history_reason` | TC 변경 step 이력 사유 | `test_run_step_history.reason` | `TC_UPDATED`, `STEP_ADDED`, `STEP_REMOVED`, `STEP_REORDERED` | - |

> Role / Scope는 코드 외부화 대상이지만 **권한 매트릭스 정합 때문에 변경 권장 X** — Admin UI에서 라벨/색상만 변경, 신규 코드 추가는 RFC 절차.

### 2.1 코드 항목 메타 속성

각 코드는 다음 속성 보유 (metadata-service Code 모델 + TMS extension):

| 속성 | 타입 | 용도 |
| --- | --- | --- |
| `codeKey` | string | DB 저장 값 |
| `labels` | JSON (`{ko, en}`) | i18n 라벨 |
| `parentId` | string \| null | 트리 (Defect Status DAG 등에 활용) |
| `path` | string | materialized path (조회 O(depth)) |
| `sortOrder` | int | 표시 순서 |
| `effectiveFrom` / `effectiveTo` | timestamp | 예약 활성 |
| `deletedAt` | timestamp | soft delete (미사용 처리) |
| **TMS extension `data` JSON** | object | 표시 색상·아이콘·배지 variant 등 (아래 §3) |

---

## 3. TMS 확장 메타 속성 (`data` JSON)

metadata-service `Code.data` JSON 필드에 TMS 전용 메타 저장. 디자인 토큰 정본 (`docs/design/00_design_system_v3.md`)과 정합.

```json
{
  "color": "var(--status-pass)",       // 디자인 토큰 변수명 또는 hex
  "bgColor": "var(--feedback-success-bg)",
  "textColor": "var(--feedback-success-text)",
  "icon": "check-circle",              // lucide-react 아이콘 이름
  "badgeVariant": "success",           // BadgeVariant enum (success/warning/danger/info/neutral)
  "sortKey": "01",                     // 보조 정렬
  "active": true                        // FE 표시 토글 (선택)
}
```

### 3.1 그룹별 표시 가이드 (디자이너 정본 §1 컬러 매핑)

| Group | Code | color 토큰 |
| --- | --- | --- |
| `execution_result` | `PASS` | `--status-pass` (green-600) |
| | `FAIL` | `--status-fail` (red-600) |
| | `BLOCKED` | `--status-block` (yellow-600) |
| | `SKIPPED` | `--status-skip` (neutral-600) |
| | `UNTESTED` | `--status-pending` (slate-600) |
| | `PENDING` | `--status-pending` (slate-600) |
| `defect_status` | `OPEN` | `--defect-open` (red-600) |
| | `IN_PROGRESS` | `--defect-inprogress` (blue-600) |
| | `RESOLVED` | `--defect-resolved` (green-600) |
| | `CLOSED` | `--defect-closed` (neutral-600) |
| `defect_severity` | `CRITICAL` | `--severity-critical` (red-400) |
| | `MAJOR` | `--severity-major` (orange-400) |
| | `MINOR` | `--severity-minor` (yellow-400) |
| | `TRIVIAL` | `--severity-trivial` (green-400) |
| `priority` | `HIGH` | red-600 |
| | `MEDIUM` | yellow-500 |
| | `LOW` | green-600 |
| `invite_status` | `PENDING` | `--invite-pending` (yellow-500) |
| | `ACTIVE` | `--invite-active` (green-600) |
| | `WITHDRAWN` | `--invite-withdrawn` (neutral-400) |
| | `EXPIRED` | `--invite-expired` (red-500) |

---

## 4. Tenant / ApiKey 정책

| 항목 | 값 |
| --- | --- |
| Tenant slug | `tms` |
| Tenant name | `TMS (Test Management System)` |
| 환경별 분리 | dev/staging/prod 각각 별도 Tenant 또는 별도 metadata-service 인스턴스 (운영 결정) |
| ApiKey scope 매핑 | BE 서버용 `READ` 키 (캐시 워밍/조회) / 운영 콘솔용 `WRITE` 키 (인프라 보안 키 보관) / 운영자용 `ADMIN` 키 (Admin UI 로그인) |
| 키 회전 | 분기별 1회 또는 유출 시 즉시 |
| 키 저장 | TMS BE: `.env` `METADATA_API_KEY` (Vault/Secret Manager 권장) / FE: 키 미노출 (BE 프록시 통한 응답만 사용) |

### 4.1 BE → Metadata 호출 흐름

```
TMS BE 부팅 → Bundle GET /v1/bundles?groups=tms.execution_result,tms.defect_status,...
            → 응답 캐싱 (in-memory + Redis, TTL 5분 또는 version polling)
            → 코드 검증/표시 시 캐시 hit
            → version INCR 감지 시 캐시 무효화 + re-fetch
```

### 4.2 FE 호출 흐름 — BE 프록시 권장

- FE는 metadata-service 직접 호출 X (CORS·키 노출 회피).
- BE가 `/v1/me/codes/:groupKey` 엔드포인트로 프록시 + 응답 캐싱.
- 또는 빌드 시 SSG/CSR 초기 번들 prefetch.

---

## 5. ERD 매핑 (§7 ERD 정합 보강)

ERD `docs/dba/erd.md` §4 enum 사전을 본 문서 §2 카탈로그로 대체. ERD §4의 enum 표는 **참조용 캐시 스냅샷**으로만 유지하고 정본은 본 문서.

### 5.1 ERD 컬럼 → CodeGroup 매핑 표

| 테이블 | 컬럼 | 타입 (변경 후) | CodeGroup | 인덱스 |
| --- | --- | --- | --- | --- |
| `test_runs` | `result` | `varchar(50)` | `tms.execution_result` | (필요 시) |
| `test_run_steps` | `result` | `varchar(50)` NOT NULL | `tms.execution_result` | (격리 선두 복합) |
| `test_runs` | `status` | `varchar(50)` NOT NULL | `tms.test_run_status` | |
| `defects` | `status` | `varchar(50)` NOT NULL | `tms.defect_status` | (격리 선두 복합) |
| `defects` | `severity` | `varchar(50)` NOT NULL | `tms.defect_severity` | |
| `defects` | `priority` | `varchar(50)` NOT NULL | `tms.priority` | |
| `test_cases` | `priority` | `varchar(50)` NOT NULL | `tms.priority` | |
| `test_cases` | `scope_type` | `varchar(50)` NOT NULL | `tms.tc_scope` | (CHECK 제거) |
| `user_roles` | `role` | `varchar(50)` NOT NULL | `tms.role` | |
| `user_roles` | `scope_type` | `varchar(50)` NOT NULL | `tms.scope` | |
| `invitations` | `scope_type` | `varchar(50)` NOT NULL | `tms.scope` | |
| `attachments` | `owner_type` | `varchar(50)` NOT NULL | `tms.attachment_owner_type` | |
| `test_plans` | `status` | `varchar(50)` NOT NULL | `tms.test_plan_status` | |
| `test_run_step_history` | `reason` | `varchar(50)` NOT NULL | `tms.step_history_reason` | |

### 5.2 CHECK 제약 제거

- ERD 기존 CHECK 제약(예: `CHECK (result IN ('PASS','FAIL',...))`) 모두 제거.
- 정합은 앱 레이어(BE validator + CI contract test) 책임.

### 5.3 마이그레이션 절차

1. `varchar(50)` 컬럼 추가 (nullable 임시)
2. enum 값 → varchar 복사
3. NOT NULL 전환 + 기본값 설정
4. CHECK 제약 제거
5. enum 타입 DROP
6. metadata-service에 그룹·코드 seed (`scripts/seed-metadata.ts` 작성)

---

## 6. BE 통합 (backend-coding-standard 보강)

### 6.1 SDK 의존

- `@yourorg/metadata-client` (위치: `/Users/songzuen/Documents/codes/metadata-client/`) Java/Kotlin 포트 또는 Node SDK 직접 사용.
- 단, BE 스택이 Spring Boot라면 별도 Java/Kotlin SDK 빌드 또는 직접 REST 호출 + 캐시 구현.

### 6.2 캐시 계층

- 부팅 시 `GET /v1/bundles?groups=<TMS 그룹 전체>` 1회 호출 → in-memory cache
- TTL 5분 또는 `GET /v1/version` polling으로 INCR 감지
- 캐시 hit 우선, miss 시 metadata-service 호출 + 재캐싱
- 캐시 키: `(tenantId, groupKey, version)`

### 6.3 쓰기 경로 검증

- `POST /defects` 등 코드 컬럼 포함 요청 시 BE validator:
  - 그룹별 활성 코드 목록 조회 (캐시) → 요청 값 ∈ 활성 목록 검증
  - 아니면 `400 INVALID_CODE` 반환 (errorCode: `CODE_NOT_ACTIVE`)

### 6.4 미사용 코드 처리

- metadata-service에서 `deletedAt` 처리 (soft delete) → BE는 활성 코드 목록에서 제외
- 기존 데이터(이미 저장된 미사용 코드 값)는 표시 가능 (labels 조회). 신규 입력만 차단.
- 표시 시 회색 처리 (deprecated 라벨) 권장.

### 6.5 metadata-service 장애 시 fallback

- 캐시 만료 + metadata-service 5xx → 마지막 성공 캐시 유지 (TTL 무시)
- 부팅 시 metadata-service 도달 불가 → 디스크 캐시 또는 hard-coded fallback (가용성)

---

## 7. FE 통합 (frontend-coding-standard 보강)

### 7.1 코드 조회 훅

```ts
const { data: statuses } = useCodes('tms.defect_status');
// 응답: { code, labels, data: { color, badgeVariant }, ... }[]
```

- BE 프록시 엔드포인트 사용 (`GET /api/codes/tms.defect_status`).
- React Query queryKey: `['codes', groupKey, locale]`.
- staleTime: 5분, cacheTime: 30분.

### 7.2 표시 컴포넌트

- `<StatusBadge codeGroup="tms.defect_status" codeKey={defect.status} />` — 라벨·색상 자동 적용.
- `<CodeSelect codeGroup="tms.priority" value={value} onChange={...} />` — 셀렉트 입력.
- frontend-coding-standard 카탈로그 §2 공통 컴포넌트로 포함.

### 7.3 i18n

- 라벨은 metadata `labels.ko` / `labels.en` 우선.
- 키 폴백: `code.<groupKey>.<codeKey>` 형식 (없으면 codeKey 그대로).

---

## 8. 운영 절차

### 8.1 코드 등록 (Admin UI)

1. Admin UI 로그인 (ADMIN 키)
2. CodeGroup 선택 (예: `tms.defect_status`)
3. `+ 코드 추가` → codeKey / labels / data JSON 입력
4. 미리보기 확인
5. `발행` → version INCR + 캐시 무효화 + 전 사이트 polling 감지 → 즉시 반영

### 8.2 코드 수정

- labels·data·sortOrder 등 mutable 필드 변경 가능
- codeKey 변경 불가 (revision 추적 위해)
- 변경 시 revision 자동 생성

### 8.3 미사용 처리 (soft delete)

- `DELETE` → `deletedAt` 기록, 신규 입력 차단
- 기존 저장 데이터는 표시 가능
- 복원 가능 (`POST /restore`)

### 8.4 RFC 절차 (그룹 자체 변경)

- CodeGroup 추가/삭제 = ERD/BE 영향 큼 → RFC + PR (본 문서 §2 카탈로그 갱신)
- Code 추가/수정/미사용 = 운영 결정 (RFC 불요)

---

## 9. 검증 / 테스트

### 9.1 CI Contract Test

- TMS BE 빌드 시 fixture metadata-service(local docker) 띄움
- 본 문서 §2 카탈로그 초기 코드 전부 존재 + 활성 검증
- BE Validator 동작 검증 (활성 코드 통과 / 미사용 코드 차단 / 미존재 코드 차단)

### 9.2 캐시 정합 테스트

- version INCR 시 캐시 무효화 동작 검증
- metadata-service 장애 시 stale cache 폴백 검증

### 9.3 통합 시드 스크립트

- `scripts/seed-metadata.ts` (작성 예정) — metadata-service에 본 문서 §2 카탈로그 + §3 data JSON 자동 등록
- 환경별 idempotent 실행

---

## 10. 변경 이력

| 버전 | 일자 | 변경 | 작성 |
| --- | --- | --- | --- |
| v1.0 | 2026-06-08 | 최초 작성. Soft Enum 패턴 채택. 12 CodeGroup 카탈로그 + ERD 컬럼 매핑 + BE/FE/운영 절차. metadata-service v1 SDK 통합. | PM 에이전트 |
