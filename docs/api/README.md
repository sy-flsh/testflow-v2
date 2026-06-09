# TMS API (HTTP API 계약 정본)

TMS Backend HTTP API의 **OpenAPI 3.1 계약 정본**.

- **정본**: [`openapi.yaml`](openapi.yaml)
- **버전**: 0.1.0 (P1 초안)
- **베이스 URL**: `https://api.tms.dev.unione.example/api/v1` (dev) · `…stg…` (staging)

---

## 📋 핵심 규약

| 항목 | 규칙 |
| --- | --- |
| HTTP 메서드 | **GET / POST 전용** (backend-standard §4.2) |
| URL 패턴 | 생성 `POST /resources` · 수정 `POST /resources/{id}` · 액션 `POST /resources/{id}/{action}` |
| 응답 래퍼 | `ApiResponse<T>` 단일 (success / code / message / data + traceId / timestamp / path / errors) |
| 페이지네이션 | `PagedResponse<T>` (content / totalElements / totalPages / currentPage / size) + Cursor (TC/Run/Defect/Attachment/StepHistory, 락 v2.6) |
| 인증 | JWT Bearer `Authorization: Bearer <AccessToken>` (SRS §6.2) |
| 인가 | (User × Scope) 다중 Role 매트릭스 (`../permissions.md`) |
| 에러 코드 | `ErrorCode` 문자열 의미 코드 `{DOMAIN}_{상황}` (backend-standard §5.2 / `../integration/error-code-mapping.md`) |

---

## 🔗 정합 의존

- 도메인 락: `../features/README.md` v2.7 (3-tier 격리 · Role 6단 · 가입 2경로 · Project `code` · TestCase Scope 3종 · TestRun 단계별 + duration · TC 변경 시 영향 Run UNTESTED · 삭제 작성자 한정 ★16)
- ERD 정합: `../dba/erd.md`
- 코드/Enum: `../integration/codes.md` (Soft Enum, varchar(50) + Code SDK validator)
- 에러 코드 ↔ FE i18n: `../integration/error-code-mapping.md`
- 외부 metadata-service: `../integration/openapi.yaml`
