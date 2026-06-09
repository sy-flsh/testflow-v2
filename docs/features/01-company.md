# [F-COMPANY] 회사(Company) 관리

| 항목 | 내용 |
| --- | --- |
| 기능 ID | F-COMPANY |
| 상태 | 검토 |
| 우선순위 | High |
| 관련 도메인(glossary) | Company(신규), User, Role |
| Figma | https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=0-1&p=f&m=dev |
| 작성자 | 기능 기획자 에이전트 |
| 최종 수정일 | 2026-06-05 |

> 본 기능은 **테넌트(고객사) 단위의 최상위 격리 경계 `Company`** 의 생성·조회·수정·비활성·소유자 이관을 다룬다. Company 안의 사용자·Workspace·Project 격리는 [`srs.md`](../srs.md) §4.4·[`permissions.md`](../permissions.md)를 정본으로 한다. **Company는 glossary v1.1에 없는 신규 용어**이므로 glossary §6 조직/공통에 추가 필요 (오픈이슈).

## 1. 개요 / 목적
- TMS의 **테넌트(고객사)** 단위 격리 경계를 정의한다. 모든 사용자·Workspace·Project·테스트 자산·결함은 Company 내부에 격리된다.
- 시스템 운영자(Master)는 Company 단위로 신규 고객사를 발급·비활성하며, 회사 내부 관리자(CO)는 본인 Company의 정보와 소유 관계를 관리한다.

## 2. 관련 용어
| 용어 | 정의 요약 |
| --- | --- |
| Company | TMS의 테넌트(고객사) 단위. 사용자·Workspace·Project를 격리하는 최상위 컨테이너. (glossary 추가 필요) |
| Master | 시스템 전역 관리자. Company 생성·비활성 권한 보유 (glossary 추가 필요) |
| CO (Company Owner) | Company 1개를 관리하는 사용자 Role. Company당 N명 가능 |
| 소유자 이관 | `companies.owner_user_id` (주 CO)를 다른 CO에게 넘기는 절차 |

## 3. 사용자 / 권한
| Role | 권한 |
| --- | --- |
| Master | Company 생성(Master 등록 경로), 비활성/활성, 전역 목록 조회 |
| CO | 본인 Company 정보 조회·수정, 소유자 이관, 다른 사용자 CO 승격 |
| WO/PO/Member/Viewer | 본인 Company 정보 **조회만** (이름/연락처 등 공개 필드) |
| 미인증 | 셀프 회원가입 흐름에서 Company 자동 생성 트리거 (F-AUTH 경유, 본 기능 단독 호출 없음) |

> 권한 매트릭스 정본: [`permissions.md`](../permissions.md) §4.1.

## 4. 사용자 스토리
- **Master**로서, 새 고객사(Company)를 발급하기 위해, 회사명·첫 CO 이메일을 입력해 Company를 생성한다. 시스템이 CO에게 임시비번 이메일을 발송한다.
- **Master**로서, 미사용·해약 고객사를 차단하기 위해, Company를 비활성화한다. 비활성 Company 사용자의 로그인은 차단된다.
- **CO**로서, 회사명·연락처·기본 정보를 최신 상태로 유지하기 위해, 회사 정보를 수정한다.
- **CO**로서, 회사 운영 책임자를 변경하기 위해, 다른 CO에게 **주 소유자(owner_user_id)**를 이관한다.
- **CO**로서, 회사 내 다른 운영자를 늘리기 위해, 등록된 사용자에게 **CO 권한을 부여**한다.
- **미인증 사용자**로서, 셀프 회원가입을 시도하면, **신규 Company가 자동 생성**되고 본인이 첫 CO가 된다(F-AUTH §5.2 경로 B와 연계).

## 5. 주요 흐름 / 시나리오

### 5.1 Company 생성 — Master 등록 경로
1. Master 로그인 → `/master/companies` 진입.
2. "신규 생성" → 회사명·slug(자동/수동)·첫 CO 이메일·CO 이름 입력.
3. `POST /api/v1/master/companies` 호출.
4. 서버가 slug 유일성 검증 → `companies` 생성 → `users`에 첫 CO 생성(임시비번 BCrypt 저장) → `user_roles` 에 `(userId, COMPANY, companyId, CO)` 부여.
5. 서버가 **임시비번 이메일** 비동기 발송(SRS §6.4).
6. 응답: 생성된 Company + 첫 CO 메타(임시비번은 응답에 미노출).

### 5.2 Company 생성 — 셀프 가입 경로
- F-AUTH의 셀프 회원가입 흐름에서 트리거. 본 기능은 **트리거 시 생성 규칙**만 정의:
  - 입력: email·password·name·**companyName**.
  - slug 자동 생성(회사명 정규화 + 충돌 시 suffix).
  - 이메일 인증 완료 시점에 비로소 `companies.is_active=true` 활성화. 인증 전엔 비활성 상태.

### 5.3 Company 정보 조회
- Master: `GET /api/v1/master/companies` (목록), `GET /api/v1/master/companies/{id}` (상세).
- 인증된 모든 사용자(본인 Company): `GET /api/v1/company` (자기 회사).
- 응답: id, name, slug, isActive, ownerUser(요약), createdAt 등.

### 5.4 Company 정보 수정 (CO)
1. CO가 `/company/settings` 진입.
2. 이름·연락처(추후 확장 필드) 수정 → `POST /api/v1/company/update`.
3. 서버가 변경 검증 후 저장. slug는 **불변**(시스템 식별자).

### 5.5 소유자 이관 (CO)
1. CO가 `/company/settings` → "소유자 이관".
2. 이관 대상은 **현재 CO 권한을 가진 다른 사용자만 가능**(아니면 400). 후보 목록 노출.
3. 확인 다이얼로그 → `POST /api/v1/company/transfer-ownership`.
4. 서버가 대상자 CO 보유 검증 → `companies.owner_user_id` 갱신.
5. **본인은 CO 권한 유지** (이관은 "주 CO" 표식만 옮김). 본인 CO 회수는 별도 절차(다른 CO가 회수).

### 5.6 사용자 CO 승격 (CO)
1. CO가 `/company/users/{userId}` 진입.
2. "CO 권한 부여" → `POST /api/v1/company/users/{userId}/grant-co`.
3. 서버가 `user_roles`에 `(userId, COMPANY, companyId, CO)` 추가(중복 시 무시).

### 5.7 Company 비활성/활성 (Master)
1. Master가 `/master/companies/{id}` → "비활성화".
2. 확인 다이얼로그 → `POST /api/v1/master/companies/{id}/deactivate`.
3. 서버가 `companies.is_active=false`. 해당 Company의 모든 사용자 로그인은 403 `COMPANY_INACTIVE`. 진행 중 세션은 다음 요청부터 차단.
4. 활성화: `POST /api/v1/master/companies/{id}/activate`.

### 5.8 대안 / 예외 흐름
- slug 중복 → 400 `COMPANY_SLUG_DUPLICATE`.
- 비활성 Company 사용자 로그인 시도 → 403 `COMPANY_INACTIVE` (F-AUTH).
- 마지막 CO 회수/탈퇴 시도 → 400 `COMPANY_LAST_CO_FORBIDDEN`.
- 소유자 이관 시 대상이 CO 아님 → 400 `COMPANY_TRANSFER_TARGET_NOT_CO`.
- 비활성 Company 내 모든 도메인 액션 → 403 `COMPANY_INACTIVE`.
- 다른 Company 자원 접근 → 404 (격리 은닉).

## 6. 입력 / 출력

### 6.1 입력
| 구분 | 항목 | 설명/제약 |
| --- | --- | --- |
| Master 생성 | name | 필수, 1~100자 |
| Master 생성 | slug | 선택(자동), kebab-case, 시스템 유일, 3~50자 |
| Master 생성 | firstCoEmail | 필수, 이메일 형식 |
| Master 생성 | firstCoName | 필수, 1~50자 |
| 셀프 생성(F-AUTH) | companyName | 필수, 1~100자 → slug 자동 |
| 수정 | name (+ 연락처 등 확장 필드) | 부분 변경 |
| 이관 | targetUserId | 필수, 현재 CO 보유자 |
| CO 승격 | (Path) userId | 필수, Company 소속 사용자 |
| 비활성/활성 | (Path) companyId | 필수 |

### 6.2 출력
| 구분 | 항목 | 설명 |
| --- | --- | --- |
| Company 표현 | id, name, slug, isActive, createdAt, updatedAt | 공통 |
| Master 응답 | ownerUser(id, email, name) 요약 | Master·CO 노출 |
| 일반 사용자 응답 | name, slug, isActive | 공개 필드만 |
| 공통 응답 래퍼 | `success/code/message/data` | backend §4.5 |

## 7. 비즈니스 규칙
- **slug 불변**: 생성 후 변경 불가. 충돌 회피 위해 자동 생성 시 suffix(`-2`, `-3`).
- **마지막 CO 보호**: 마지막 CO 1명은 강등·비활성·탈퇴 불가(`COMPANY_LAST_CO_FORBIDDEN`).
- **소유자 이관 후에만 본인 CO 해제 가능**: 본인이 본인 CO를 회수할 수 없음 → 다른 CO가 수행해야 함.
- **비활성 Company 격리**: 비활성 Company 사용자·자원에 대한 모든 액션은 차단(조회는 격리 위반이 아니라 비활성 상태 안내).
- **셀프 가입 자동 생성 게이트**: 이메일 인증 완료 전까지 Company는 비활성. 미인증 만료(예: 24h) 시 자동 삭제(Phase 2 정리 작업).
- **격리키 보존**: 모든 도메인 테이블의 `company_id`는 NOT NULL + 인덱스(SRS §4.1).
- **물리 삭제 금지**: 비활성으로만 종결. Hard delete는 운영 정리 작업 별도(Phase 2).

## 8. 예외 / 에러
| 상황 | 처리 | 에러 코드 |
| --- | --- | --- |
| 미인증 | 401 | `AUTH_UNAUTHORIZED` |
| Master 권한 부족 | 403 | `AUTH_FORBIDDEN` |
| CO 권한 부족 | 403 | `AUTH_FORBIDDEN` |
| 미존재 Company | 404 | `COMPANY_NOT_FOUND` |
| slug 중복 | 400 | `COMPANY_SLUG_DUPLICATE` |
| slug 형식 오류 | 400 | `COMPANY_SLUG_INVALID` |
| 마지막 CO 강등/비활성/탈퇴 | 400 | `COMPANY_LAST_CO_FORBIDDEN` |
| 이관 대상이 CO 아님 | 400 | `COMPANY_TRANSFER_TARGET_NOT_CO` |
| 비활성 Company 내 액션 | 403 | `COMPANY_INACTIVE` |
| 입력 형식 오류 | 400 | `COMMON_INVALID_INPUT` |

> 신규 코드(`COMPANY_*`)는 backend `ErrorCode` enum 등록 필요.

## 9. 수용 기준 (Acceptance Criteria)
- [ ] **AC-1** Given Master 로그인, When 회사명·CO 이메일로 신규 Company 생성하면, Then 200 + Company + 첫 CO가 생성되고 임시비번 메일이 큐에 적재된다.
- [ ] **AC-2** Given Master, When 중복 slug로 생성하면, Then 400 `COMPANY_SLUG_DUPLICATE`이다.
- [ ] **AC-3** Given CO 로그인, When 본인 회사 정보 수정하면, Then 200 + 변경 반영. slug는 변경되지 않는다.
- [ ] **AC-4** Given Company에 CO가 2명, When 한 명을 다른 CO에게 이관하면, Then `owner_user_id`가 변경되고 본인은 CO 유지된다.
- [ ] **AC-5** Given Company에 CO가 1명(본인), When 본인 CO 회수 시도하면, Then 400 `COMPANY_LAST_CO_FORBIDDEN`이다.
- [ ] **AC-6** Given CO 로그인, When 대상자 X에게 CO 부여하면, Then `user_roles`에 `(X, COMPANY, companyId, CO)` 1행이 추가된다.
- [ ] **AC-7** Given Master, When Company를 비활성화하면, Then 해당 Company 사용자 로그인 시 403 `COMPANY_INACTIVE`이다.
- [ ] **AC-8** Given 비활성 Company, When 그 안에서 어떤 API라도 호출하면, Then 403 `COMPANY_INACTIVE`이다.
- [ ] **AC-9** Given CO 로그인, When 다른 Company의 자원에 접근하면, Then 404(은닉)이다.
- [ ] **AC-10** Given 일반 사용자(WO/PO/Member/Viewer), When `GET /company`로 본인 회사 조회하면, Then 200 + 공개 필드(name·slug·isActive)만 받는다.
- [ ] **AC-11** Given 셀프 가입 흐름에서 이메일 인증 미완료, When 그 Company로 로그인 시도하면, Then 403 `COMPANY_INACTIVE` 또는 F-AUTH의 미인증 코드.
- [ ] **AC-12** Given 비CO, When 이관/CO 부여 API 호출하면, Then 403 `AUTH_FORBIDDEN`이다.

## 10. 추적성
| Requirement ID | 설명 | 관련 기능/화면 | 관련 API(개념) | 연관 TestCase |
| --- | --- | --- | --- | --- |
| REQ-COMPANY-001 | Master의 Company 발급(첫 CO + 임시비번 메일) | /master/companies | `POST /master/companies` | (QA) |
| REQ-COMPANY-002 | 셀프 가입 시 Company 자동 생성 (이메일 인증 게이트) | /signup | F-AUTH 연계 | (QA) |
| REQ-COMPANY-003 | CO의 회사 정보 수정 | /company/settings | `POST /company/update` | (QA) |
| REQ-COMPANY-004 | CO의 소유자 이관 (주 CO 변경) | /company/settings | `POST /company/transfer-ownership` | (QA) |
| REQ-COMPANY-005 | CO의 사용자 CO 승격 | /company/users/{id} | `POST /company/users/{id}/grant-co` | (QA) |
| REQ-COMPANY-006 | Master의 Company 비활성/활성 | /master/companies/{id} | `POST /master/companies/{id}/(de)activate` | (QA) |
| REQ-COMPANY-007 | 마지막 CO 보호 규칙 | 전역 | (서비스 규칙) | (QA) |
| REQ-COMPANY-008 | 비활성 Company 전역 차단 | 전역 | (인증/필터) | (QA) |

## 11. 오픈 이슈 / 비고
- **glossary 추가 필요**: `Company`, `Master`, `Company Owner(CO)` 용어를 glossary §6 조직/공통에 신규 등록 필요. PM v1.2 개정 예정.
- **slug 정책**: 한글 회사명의 slug 자동 변환 룰(음차/영문 변환). 데모는 단순 trim+lower+ASCII 변환 + 충돌 시 suffix.
- **임시비번 길이·정책**: 데모는 12자 무작위(영문+숫자+특수). 운영 강화는 Phase 2.
- **이메일 인증 만료 후 미활성 Company 자동 삭제**: Phase 2 정리 배치.
- **연락처/대표자 필드**: MVP는 name·slug만. 운영 도입 시 사업자번호·대표자명 등 추가.
- **Master 다수 운영**: Master 계정 다수 시 책임 분할 규칙(미정).
- **Company 데이터 export**: 해약 시 Company 데이터 일괄 내보내기/삭제 절차 — Phase 2.
