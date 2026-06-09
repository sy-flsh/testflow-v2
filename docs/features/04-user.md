# [F-USER] 사용자 · 권한 관리 (User & Role Management)

| 항목 | 내용 |
| --- | --- |
| 기능 ID | F-USER |
| 상태 | 검토 |
| 우선순위 | High |
| 관련 도메인(glossary) | User, Role, Permission, Company(신규), Workspace |
| Figma | https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=282-14722&m=dev |
| 작성자 | 기능 기획자 에이전트 |
| 최종 수정일 | 2026-06-05 |

> 본 기능은 Company 내부의 **사용자 등록(초대)·조회·비활성·비번 리셋·(Scope×Role) 부여 매트릭스**를 다룬다. 인증·토큰·메일 발송 자체는 F-AUTH, 권한 매트릭스는 [`permissions.md`](../permissions.md)를 정본으로 한다. **Scope 진입(WS·Project 멤버 초대)**은 WO/PO 권한(F-WS / F-PROJ)에서 수행하며, **Role 승격(WO/PO/Member/Viewer 부여)**은 본 기능의 CO 전용 매트릭스에서 다룬다.

## 1. 개요 / 목적
- CO가 Company 내 사용자 라이프사이클(초대→가입→비활성·탈퇴)을 운영한다.
- CO가 사용자의 **Scope×Role 매트릭스**(`(scope_type, scope_id, role)` 다중 행)를 부여·회수한다.
- 모든 사용자는 본인 프로필·비번을 관리한다.

## 2. 관련 용어
| 용어 | 정의 요약 |
| --- | --- |
| User | Company에 1:N 소속. `users.email`은 `UNIQUE(company_id, email)` |
| Role | (User × Scope) 다중 부여 모델. `user_roles` 다행 |
| Invitation | 초대 토큰(1회용, 24h). CO/WO/PO가 발급 |
| Scope | `COMPANY`/`WORKSPACE`/`PROJECT` |

## 3. 사용자 / 권한
| Role | 권한 |
| --- | --- |
| CO | Company 내 사용자 초대·탈퇴·비번리셋·전체조회, **Scope×Role 매트릭스 부여/회수** |
| WO | 본인 WS에 사용자 초대(기본 Member, CO 사전 부여 Role 있으면 유지, F-WS) |
| PO | 본인 Project에 사용자 초대(기본 Member, CO 사전 부여 Role 있으면 유지, F-PROJ) |
| 본인(모든 Role) | 본인 프로필 조회·이름 수정, 비번 변경 |
| Master | 본 기능 직접 권한 없음 (Company 단위 작업은 CO 책임) |

> 권한 매트릭스 정본: [`permissions.md`](../permissions.md) §4.5·§4.6.

## 4. 사용자 스토리
- **CO**로서, 신규 협업자를 등록하기 위해, 이메일로 초대장을 발송하여 사용자 가입을 유도한다.
- **CO**로서, 사용자 책임 변화에 따라, 사용자의 (Workspace, Project) 별 Role을 **매트릭스 화면에서 일괄 부여·회수**한다.
- **CO**로서, 사용자가 비밀번호를 분실했을 때, 임시비번을 발급해 이메일로 안내한다.
- **CO**로서, 퇴사자를 차단하기 위해, 사용자를 비활성화한다.
- **CO**로서, Company 내 사용자 현황을 한 곳에서 조회·검색한다.
- **사용자(전 Role)**로서, 내 프로필과 권한 보유 현황을 조회한다.
- **사용자**로서, 비밀번호를 변경하여 계정 보안을 유지한다.

## 5. 주요 흐름 / 시나리오

### 5.1 사용자 초대 (CO)
1. CO가 `/company/users` → "초대".
2. 이메일·이름(선택) 입력 → `POST /api/v1/company/invitations`.
3. 서버: 같은 Company의 동일 email 미가입 사용자 검증(이미 가입 시 400 `USER_EMAIL_DUPLICATE`).
4. `invitations` 1행(scope_type=`COMPANY`, scope_id=`{companyId}`, role=`null`(기본)) 생성, 24h 만료, 해시 저장.
5. 초대 메일 발송(SRS §6.4). 토큰 = 원본 비교(서버는 해시만).
6. 수락 흐름은 F-AUTH §5.3 (`/accept-invite`).
7. 수락 완료 시 `users` 생성·`is_email_verified=true`. **이 시점에 Role은 아직 없음**(권한 없는 사용자) → CO가 후속 매트릭스 부여로 권한 결정.

> CO는 초대 시 **사전 Role을 함께 지정할 수도 있음**(편의 옵션). 지정 시 `invitations.role` 채움 → 수락 시 자동 부여. 미지정 시 가입 후 매트릭스 화면에서 부여.

### 5.2 사용자 목록 조회 (CO)
1. CO가 `/company/users` 진입(`GET /api/v1/company/users`).
2. 쿼리: `q`(이메일·이름), `isActive`, `role`(예: `WO`), `scope`(`WORKSPACE`/`PROJECT`), page·size·sort.
3. 응답: 페이지네이션된 User 목록 + 각 User의 **Scope 단위 요약 Role 카운트**(예: `WS×3 (WO×2, M×1), Project×8 (PO×1, M×2, V×5)`). 카운트는 `user_roles` 행을 `scope_type` 그룹화 후 Role별 집계. Master는 별도 표기(`Master`).

### 5.3 사용자 상세 + Role 매트릭스 부여 (CO)
1. CO가 `/company/users/{userId}` 진입(`GET /api/v1/company/users/{userId}`).
2. 응답: User 정보 + 현재 `user_roles` 행 전체(grouped by Scope).
3. CO가 매트릭스 UI에서 (Workspace, Project, Role) 조합 변경 → 일괄 저장.
4. 변경 적용 엔드포인트(택1):
   - **`POST /api/v1/company/users/{userId}/roles/sync` (권장, 매트릭스 UI 정본 경로)**
     - body: `{ grants: [{scopeType, scopeId, role}, ...], revokes: [{scopeType, scopeId, role}, ...] }`
     - **단일 트랜잭션**: 한 항목이라도 실패 시 전체 롤백.
     - 멱등(idempotent): 이미 있는 grants는 무시(중복 부여 없음), 없는 revokes도 무시(부분 성공 처리). 단 §7 잠금 방지 규칙 위반은 트랜잭션 중단 → 전체 롤백.
     - 매트릭스 UI(`_ux-role-matrix.md`)에서 [저장] 클릭 시 호출.
   - **`POST /api/v1/company/users/{userId}/roles/grant` / `/revoke` (단일 액션 보조 경로)**
     - body: `[{scopeType, scopeId, role}, ...]`
     - 단건/소량 부여·회수용. 자동화/스크립트 친화. 매트릭스 UI는 sync 권장.
5. 서버 검증(공통):
   - scope_type/scope_id가 본인 Company에 속하는지
   - role이 scope_type과 일치 (CO=COMPANY만, WO=WORKSPACE만, PO=PROJECT만, Member/Viewer=WORKSPACE 또는 PROJECT)
   - 마지막 CO/WO/PO 회수 시도 차단(§7 시스템 잠금 방지)
   - 비활성 사용자/Scope 대상 거부
6. 응답: 변경 후 User의 `user_roles` 전체(`rolesByScope` 직렬화).

### 5.4 비밀번호 리셋 — CO 강제
1. CO가 사용자 상세 → "비밀번호 리셋"(`POST /api/v1/company/users/{userId}/reset-password`).
2. 서버: 임시비번 생성 → BCrypt 갱신 → **임시비번 이메일 발송**(SRS §6.4) + `users.must_change_password=true` 플래그.
3. 응답: 200 (임시비번 응답 미노출, 이메일로만 전달).
4. 대상 User의 모든 Refresh Token Redis 폐기 → 자연 만료된 Access 만료 후 재로그인 필요.

### 5.5 사용자 비활성/활성 (CO)
1. CO가 사용자 상세 → "비활성화" → 확인 다이얼로그 → `POST /api/v1/company/users/{userId}/deactivate`.
2. 서버: `users.is_active=false`. 모든 Refresh Token 폐기. 차기 로그인 시 403 `AUTH_FORBIDDEN`.
3. 활성화: `POST /api/v1/company/users/{userId}/activate`.

### 5.6 사용자 탈퇴 (soft, CO)
1. CO가 사용자 상세 → "탈퇴 처리" → `POST /api/v1/company/users/{userId}/withdraw`.
2. 서버: `users.is_deleted=true` + `is_active=false`. 모든 `user_roles` 행 회수. Refresh Token 폐기.
3. 같은 이메일 재초대 시 신규 행으로 재가입(데모 정책).

### 5.7 본인 프로필 조회·수정
- `GET /api/v1/users/me` → 본인 정보 + 보유 Role 목록(권한 가시화).
- `POST /api/v1/users/me/update` (name 수정).

### 5.8 본인 비밀번호 변경
- F-AUTH §5.7 (`POST /api/v1/auth/change-password`). 본 기능은 화면 진입점만 제공(`/me`).

### 5.9 대안 / 예외 흐름
- 같은 Company 내 이메일 중복(미초대 미가입 상태에서 중복 초대 가능) → 활성 미만료 토큰 존재 시 400 `USER_INVITE_PENDING` (재발송 or 취소 후 재초대).
- Scope×Role 부여 시 scope_type/role 불일치 → 400 `USER_INVALID_ROLE_SCOPE`.
- 마지막 CO/WO/PO 회수 시도 → 400 `*_LAST_OWNER_FORBIDDEN`.
- 본인이 본인 CO 회수 시도 → 400 `USER_SELF_CO_REVOKE_FORBIDDEN`.
- 본인이 본인 비활성 시도 → 400 `USER_SELF_DEACTIVATE_FORBIDDEN`.
- 다른 Company 사용자에게 Role 부여 시도 → 400 `USER_NOT_IN_COMPANY`.
- 비활성 사용자에게 Role 부여 → 400 `USER_INACTIVE`.

## 6. 입력 / 출력

### 6.1 입력
| 구분 | 항목 | 설명/제약 |
| --- | --- | --- |
| 초대 | email | 필수, 이메일 형식 |
| 초대 | name | 선택, 1~50자 |
| 초대 | preassignedRoles[] | 선택, `[{scopeType, scopeId, role}]` 형식(편의) |
| 매트릭스 sync (권장) | { grants[], revokes[] } | 둘 중 1개 이상 필요. 단일 트랜잭션 + 멱등 |
| 매트릭스 부여(단일) | grants[] | 필수, `[{scopeType, scopeId, role}]` (보조 경로) |
| 매트릭스 회수(단일) | revokes[] | 필수, `[{scopeType, scopeId, role}]` (보조 경로) |
| 본인 수정 | name | 필수 |
| 목록 | q / isActive / role / scope / page / size / sort | 모두 선택, 기본 page=0/size=20/sort=createdAt,desc |

### 6.2 출력
| 구분 | 항목 | 설명 |
| --- | --- | --- |
| User 표현(공통) | id, email, name, isActive, isEmailVerified, createdAt, updatedAt | **passwordHash 미노출** |
| 상세 응답 | rolesByScope: { COMPANY: [...], WORKSPACE: [{wsId, wsName, role}], PROJECT: [{wsId, projId, projName, role}] } | 매트릭스 UI 직렬화 |
| 목록 응답 항목 | id, email, name, isActive, roleCount(요약) | |
| 초대 응답 | invitationId, expiresAt | 토큰 응답 X |
| 임시비번 리셋 응답 | success: true | 임시비번 응답 X (이메일로만) |
| 공통 응답 래퍼 | `success/code/message/data` | backend §4.5 |

## 7. 비즈니스 규칙
- **Role 부여 권한은 CO 단일**: WO/PO는 Scope 진입(멤버 초대) 권한만 보유. Role 승격은 CO만(답 4 확정, permissions.md §1).
- **부여 단위 = `(scope_type, scope_id, role)` 1행**: 다중 Scope·다중 Role 동시 부여 가능.
- **Role-Scope 정합성**:
  - `CO` ↔ `COMPANY` only
  - `WO` ↔ `WORKSPACE` only
  - `PO`/`MEMBER`/`VIEWER` ↔ `PROJECT` only
- **시스템 잠금 방지** (permissions.md §5):
  - 마지막 CO 회수/탈퇴 불가 (`COMPANY_LAST_CO_FORBIDDEN`)
  - 마지막 WO 회수 불가 (`WS_LAST_WO_FORBIDDEN`)
  - 마지막 PO 회수 불가 (`PROJ_LAST_PO_FORBIDDEN`)
  - 본인이 본인 CO 회수 불가 (`USER_SELF_CO_REVOKE_FORBIDDEN`)
  - 본인이 본인 비활성 불가 (`USER_SELF_DEACTIVATE_FORBIDDEN`)
- **이메일 unique**: `UNIQUE(company_id, email)`. 다른 Company에서는 같은 이메일 가능.
- **비밀번호 미노출**: `passwordHash` 응답 직렬화 금지(backend §6.4).
- **임시비번 응답 미노출**: 이메일로만 전달. UI에 평문 노출 금지(보안 강화).
- **물리 삭제 금지**: `is_active=false` + `is_deleted=true` (soft). Hard delete는 Phase 2.
- **격리 검증**: 모든 매트릭스 부여 대상 Scope는 본인 Company 소속 검증.
- **사전 부여 옵션**: 초대 발급 시 `preassignedRoles[]` 지정 시, 수락 시점에 자동 매트릭스 부여(편의 기능). 사전 지정 없으면 가입 후 CO가 후속 부여.

## 8. 예외 / 에러
| 상황 | 처리 | 에러 코드 |
| --- | --- | --- |
| 미인증 | 401 | `AUTH_UNAUTHORIZED` |
| CO 권한 부족 | 403 | `AUTH_FORBIDDEN` |
| 미존재 User | 404 | `USER_NOT_FOUND` |
| 같은 Company 내 이메일 중복(기존 사용자) | 409 | `USER_EMAIL_DUPLICATE` |
| 활성 초대 토큰 미만료 중복 발송 | 400 | `USER_INVITE_PENDING` |
| 비활성 사용자에게 Role 부여 | 400 | `USER_INACTIVE` |
| Scope×Role 불일치 | 400 | `USER_INVALID_ROLE_SCOPE` |
| 다른 Company Scope에 Role 부여 시도 | 400 | `USER_NOT_IN_COMPANY` |
| 마지막 CO/WO/PO 회수 시도 | 400 | `COMPANY_LAST_CO_FORBIDDEN` / `WS_LAST_WO_FORBIDDEN` / `PROJ_LAST_PO_FORBIDDEN` |
| 본인 CO 회수 시도 | 400 | `USER_SELF_CO_REVOKE_FORBIDDEN` |
| 본인 비활성 시도 | 400 | `USER_SELF_DEACTIVATE_FORBIDDEN` |
| 비밀번호 정책 미충족 | 400 | `USER_WEAK_PASSWORD` |
| 입력 형식 오류 | 400 | `COMMON_INVALID_INPUT` |

## 9. 수용 기준 (Acceptance Criteria)
- [ ] **AC-1** Given CO 로그인, When 이메일로 초대 발송하면, Then 200 + `invitations` 1행 + 메일 발송 큐 적재.
- [ ] **AC-2** Given 이미 가입된 같은 Company 이메일, When 초대하면, Then 409 `USER_EMAIL_DUPLICATE`.
- [ ] **AC-3** Given 활성 미만료 초대가 있는 이메일, When 재초대하면, Then 400 `USER_INVITE_PENDING` (재발송 별도 액션).
- [ ] **AC-4** Given CO, When `preassignedRoles=[{WS#1, WO}]`로 초대 후 수락하면, Then 가입 시 `user_roles`에 자동 부여.
- [ ] **AC-5** Given CO, When `(WS, WO)` Role을 부여하면, Then `user_roles`에 `(userId, WORKSPACE, wsId, WO)` 추가.
- [ ] **AC-6** Given CO, When PO를 WORKSPACE Scope로 부여 시도하면, Then 400 `USER_INVALID_ROLE_SCOPE`.
- [ ] **AC-7** Given Company의 마지막 CO, When 본인 CO 회수 시도하면, Then 400 `USER_SELF_CO_REVOKE_FORBIDDEN`.
- [ ] **AC-8** Given 다른 사용자가 회수하더라도 그 사람이 마지막 CO인 경우, When 회수하면, Then 400 `COMPANY_LAST_CO_FORBIDDEN`.
- [ ] **AC-9** Given CO, When 사용자 비밀번호 리셋하면, Then 200 + 임시비번 이메일 발송 + 대상 사용자 Refresh Token 폐기. 응답에 임시비번 미노출.
- [ ] **AC-10** Given CO, When 사용자 비활성화하면, Then `users.is_active=false` + 모든 Refresh 폐기. 그 사용자의 차기 로그인은 403 `AUTH_FORBIDDEN`.
- [ ] **AC-11** Given CO, When 사용자 탈퇴 처리하면, Then `is_deleted=true` + `user_roles` 전부 회수. 같은 이메일 재초대 가능.
- [ ] **AC-12** Given 비CO, When `/company/users` 호출하면, Then 403 `AUTH_FORBIDDEN`.
- [ ] **AC-13** Given CO, When 다른 Company의 wsId로 부여 시도하면, Then 400 `USER_NOT_IN_COMPANY`.
- [ ] **AC-14** Given 응답 직렬화, When User 객체 반환 시, Then `passwordHash` 미포함.
- [ ] **AC-15** Given Member·Viewer 로그인, When `GET /users/me` 호출하면, Then 본인 정보 + 보유 Role 목록을 받는다.
- [ ] **AC-16** Given CO, When 매트릭스 화면에서 `roles/sync` 호출(grants 5건 + revokes 3건)하면, Then 단일 트랜잭션으로 일괄 적용. 한 건이라도 검증 실패(예: 마지막 CO 회수)하면 전체 롤백.
- [ ] **AC-17** Given `roles/sync`로 이미 부여된 grant + 없는 revoke 포함, When 호출, Then 200 + 멱등 처리(중복·부재 무시) + 잠금 방지 위반 없으면 정상 응답.

## 10. 추적성
| Requirement ID | 설명 | 관련 기능/화면 | 관련 API(개념) | 연관 TestCase |
| --- | --- | --- | --- | --- |
| REQ-USER-001 | CO의 사용자 초대(이메일+사전 Role 옵션) | /company/users | `POST /company/invitations` | (QA) |
| REQ-USER-002 | CO의 사용자 목록 조회·검색·필터·요약 Role 카운트 | /company/users | `GET /company/users` | (QA) |
| REQ-USER-003 | CO의 (User × Scope × Role) 매트릭스 일괄 sync(권장) + 단일 grant/revoke(보조) | /company/users/{id} | `POST /company/users/{id}/roles/sync` (정본) · `/roles/grant` · `/roles/revoke` | (QA) |
| REQ-USER-004 | CO의 비밀번호 리셋(임시비번 메일) | /company/users/{id} | `POST /company/users/{id}/reset-password` | (QA) |
| REQ-USER-005 | CO의 사용자 비활성/활성/탈퇴 | /company/users/{id} | `POST /company/users/{id}/(de)activate`·`withdraw` | (QA) |
| REQ-USER-006 | 본인 프로필 조회·이름 수정 | /me | `GET /users/me`·`POST /users/me/update` | (QA) |
| REQ-USER-007 | 본인 비밀번호 변경(F-AUTH 연계) | /me | `POST /auth/change-password` | (QA) |
| REQ-USER-008 | 시스템 잠금 방지(마지막 CO/WO/PO·본인 CO/비활성) | 전역 | (서비스 규칙) | (QA) |
| REQ-USER-009 | `passwordHash` 응답 직렬화 금지 | 전역 | (DTO/직렬화) | (QA) |
| REQ-USER-010 | 격리 검증(다른 Company 자원 Role 부여 차단) | 전역 | (서비스 규칙) | (QA) |

## 11. 오픈 이슈 / 비고
- **권한 매트릭스 UI 디자인**: CO가 한 사용자에 대해 (Workspace, Project) 다중 Role을 부여하는 화면 — 트리 + 체크박스/드롭다운 매트릭스 vs 행 추가형 폼. **별도 UI 명세(`docs/features/_ux/user-role-matrix.md` 또는 본 문서 부록) 작성 필요** (답 12 확정).
- **사전 부여(preassignedRoles) UI**: 초대 발송 시점에 Role 지정 단계 추가 vs 단순 이메일 초대 후 매트릭스 부여 — 데모는 두 흐름 모두 지원.
- **사용자 탈퇴 후 같은 이메일 재초대 정책**: 신규 행 vs 기존 `is_deleted=true` 행 복구 — 데모는 신규 행. 운영은 Phase 2.
- **권한 변경 알림**: 사용자가 Role 부여/회수 받았을 때 인앱·메일 알림 — Phase 2 F-NOTIFY.
- **CO 책임 감사 로그**: Role 부여·비번 리셋·탈퇴는 감사 대상. Phase 2 F-AUDIT.
- **다중 기기 Refresh 폐기 범위**: 데모는 전부 폐기. 운영은 디바이스 기반 선택 폐기 — Phase 2.
- **이메일 변경**: 본인 이메일 변경 흐름 미지원(F-AUTH 오픈이슈와 동일).
