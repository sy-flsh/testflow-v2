# TMS Integration (외부 시스템 통합 정본)

TMS와 외부 시스템 간 통합 규약 + 영역간 정합(BE ↔ FE) 매핑.

---

## 📋 파일 목록

| 문서 | 역할 | 등급 |
| --- | --- | --- |
| [`codes.md`](codes.md) | TMS ↔ `metadata-service` 코드 통합 정본 (Soft Enum) | 정본 |
| [`error-code-mapping.md`](error-code-mapping.md) | BE `ErrorCode` ↔ FE i18n 키 매핑 정본 | L1 (영역간 정합) |
| [`openapi.yaml`](openapi.yaml) | 외부 `metadata-service` OpenAPI 계약 | 외부 |

---

## 🔌 외부 시스템

### metadata-service (코드/메타데이터 진실원)

- **위치**: `/Users/songzuen/Documents/codes/`
- **스택**: NestJS 10 + Prisma 5 + PostgreSQL 15 + Redis 7
- **역할**: TMS 도메인 코드(상태/심각도/우선순위 등) 단일 진실원
- **패턴**: **Soft Enum** — DB enum CHECK 제거, `varchar(50)` + 앱 레이어 validator (락 v2.4 채택)
- **운영**: Admin UI에서 코드 등록/수정/미사용(soft delete) 즉시 반영 (마이그/배포 불필요)

### SMTP (메일 발송)

- **용도**: 이메일 인증 · 초대 토큰 · 임시비번 · 비번리셋 발송
- **데모**: Mailtrap / Mailhog · **운영**: SendGrid / SES
- **상세**: `../srs.md` §2.1 · `../features/03-authentication.md`

---

## 🔗 정합 의존

- ERD 코드 컬럼 타입: `../dba/erd.md` (`varchar(50)` + comment로 metadata code_key 참조)
- BE 코드 조회 SDK: `../standards/backend-coding-standard.md` (Code SDK validator)
- FE 라벨 표시 / 디자인 토큰: `../standards/frontend-coding-standard.md` · `../design/00_design_system_v3.md` §6 i18n
- API 코드 의존 enum 타입: `../api/openapi.yaml`
- 누락 시 **CI 게이트 차단** (error-code-mapping 규칙)
