# TMS DBA (Database Index)

TMS의 **PostgreSQL 17 물리 스키마 정본**.

- **정본**: [`erd.md`](erd.md) — MVP 12 feature + 2 UX 도메인 ERD (v1.0)
- **상위 정본**: `../srs.md` §4 (개요 ERD) · `../glossary.md` (용어) · `../permissions.md` (격리 매칭) · `../features/_lock-review.md` (락 v2.3 도메인 범위)
- **표준**: `../standards/dba-standard.md` (L1 운영 표준) · `../standards/backend-coding-standard.md` §1.7 / §7 (명명·ORM·격리)

---

## 📋 핵심 규약

| 항목 | 규칙 |
| --- | --- |
| 격리 | 3-tier: `company_id` / `workspace_id` / `project_id` (테이블별 적용 범위는 §4 참조) |
| 명명 | snake_case, 테이블 복수형 (backend §1.7 정본, 본 문서 재정의 금지) |
| 공통 컬럼 | `BaseEntity` (감사 컬럼) + `is_deleted` soft delete + 낙관락 |
| 복합 인덱스 | 격리키 선두 원칙 (backend §7.5) |
| Enum 정책 | **Soft Enum** — DB CHECK 제거, `varchar(50)` + Code SDK validator (락 v2.4, `../integration/codes.md`) |
| ERD 동기화 | 스키마 변경 ↔ ERD 갱신은 **단일 PR** (backend §7.6) |
| 충돌 처리 | SRS §4.3과 다른 부분은 feature 락 v2.3을 우선, 본 문서 §7 검증 체크리스트에 명시 |

---

## 🔗 다운스트림

- Backend 매핑: `../standards/backend-coding-standard.md` §7.6 "ERD 정본"은 본 파일로 갱신
- 인덱스/페이지네이션 가드: 락 v2.6 (N+1 가드 + Cursor 페이지네이션) — 자세한 룰은 backend §4.7 / §7.2
- TestRun 단계별 결과 + duration · TC 변경 시 영향 Run UNTESTED + step 이력: 락 v2.2 도메인 모델 반영
- 락 v2.7 변경: `user_roles` CHECK 확장 + UNIQUE `(user_id, scope_type, scope_id)` 강화 (라디오 모델)
