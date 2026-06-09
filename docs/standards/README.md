# TMS 개발 표준 문서 (Standards Index)

TMS(Test Management System) 프로젝트의 개발 표준·컨벤션 문서 모음입니다.
모든 구현은 본 폴더의 표준을 정본(Single Source of Truth)으로 따릅니다.

---

## 📋 문서 목록

### 전체 / 공통 (L0)

| 문서 | 작성 주체 | 설명 |
|------|------|------|
| [development-standard.md](development-standard.md) | PM | 전 영역 공통 상위 원칙 (L0, 최상위 기준) — 확정 기술 스택·명명·구조·버전관리·리뷰·품질·보안 원칙 |

### Backend (L1)

| 문서 | 작성 주체 | 설명 |
|------|------|------|
| [backend-coding-standard.md](backend-coding-standard.md) | Backend | 백엔드 코딩 표준 — 명명/디렉토리·패키지/API(GET·POST)/공용 응답 래퍼·에러 코드/엔티티·DB/트랜잭션/보안 **정본** |

### Frontend (L1)

| 문서 | 작성 주체 | 설명 |
|------|------|------|
| [frontend-coding-standard.md](frontend-coding-standard.md) | Frontend | 프론트엔드 코딩 표준 |

### DBA / Database (L1)

| 문서 | 작성 주체 | 설명 |
|------|------|------|
| [dba-standard.md](dba-standard.md) | DBA | 데이터베이스 표준 — 물리 스키마 설계·마이그레이션·인덱싱/성능·백업/복구·DB 보안·가용성. 명명/ORM은 backend 정본 참조 |

### QA / Test (L1)

| 문서 | 작성 주체 | 설명 |
|------|------|------|
| [test-standard.md](test-standard.md) | QA | 테스트 표준 |

---

## 🗂 보관 (old/)

아래 문서들은 현재 정본(특히 `backend-coding-standard.md`)으로 **내용이 흡수·통합**되어 `old/`에 보관됩니다. 신규 작업의 기준으로 삼지 않습니다.

| 보관 문서 | 통합처 |
|------|------|
| `old/legacy-development-standard.md` | 이전 개발 표준 정의서 원문(출처/추적성용) |
| `old/error-code-convention.md` | → backend §5 (에러 코드/응답) |
| `old/api-url-convention.md` | → backend §1.8 / §4 (API URL/설계) |
| `old/java21-directory-structure.md` | → backend §2 (패키지·디렉토리 구조) |
| `old/postgresql-naming-convention.md` | → backend §1.7 (DB 명명) |
| `old/spring-entity-convention.md` | → backend §7.3 (엔티티·영속성) |

---

## 🔗 관련 문서

- [../srs.md](../srs.md) — 시스템 요구사항 명세 (Mini SRS): NFR·ERD 개요·IA·공통패턴
- [../glossary.md](../glossary.md) — TMS 공통 용어 사전 (Ubiquitous Language 정본)
- [../features/README.md](../features/README.md) — 기능 백로그·MVP 스코프

---

> 표준 문서는 흩어지면 충돌하므로, 변경 시 본 인덱스도 함께 갱신합니다.
