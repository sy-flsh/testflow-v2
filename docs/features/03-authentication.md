# [F-AUTH] 인증 (Authentication)

| 항목 | 내용 |
| --- | --- |
| 기능 ID | F-AUTH |
| 상태 | 검토 |
| 우선순위 | High |
| 관련 도메인(glossary) | User, Role, Company(신규), Workspace |
| Figma | https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=0-1&p=f&m=dev |
| 작성자 | 기능 기획자 에이전트 |
| 최종 수정일 | 2026-06-05 |

> 본 기능은 **회원가입(2경로)·이메일 인증·로그인·토큰 갱신·로그아웃·초대 수락·비밀번호 리셋**을 다룬다. 인가(권한 매트릭스)는 [`permissions.md`](../permissions.md), 사용자 관리(초대 발급·Role 부여)는 F-USER, Company/Workspace는 F-COMPANY/F-WS에서 다룬다. 본 문서는 **인증의 흐름·토큰·이메일 발송 게이트**까지 정의한다.

## 1. 개요 / 목적
- 사용자가 자격증명으로 신원을 인증받고, 인증된 컨텍스트(`userId`·`companyId`)와 Scope 권한(매 요청 `user_roles` 조회)을 기반으로 기능을 사용하게 한다.
- 회원가입은 **Master 등록 경로(A)**·**CO 셀프 가입 경로(B)**·**초대 수락 경로(C)** 3종을 지원한다.
- SMTP 발송을 통해 **이메일 인증·초대 토큰·임시비번·비밀번호 리셋**을 제공한다.

## 2. 관련 용어
| 용어 | 정의 요약 |
| --- | --- |
| User | 시스템에 인증되어 활동하는 주체 (Company 1:N 소속) |
| Master | 시스템 전역 관리자 (별도 테이블 `master_admins`) |
| Company | 테넌트(고객사) 단위 격리 경계. 인증 컨텍스트에 포함 |
| Access Token | 30분 만료 JWT (Authorization 헤더) |
| Refresh Token | 30일 만료 (데모 자동 로그인 정책). Redis 저장 + 해시 |
| 초대 토큰 | 1회용, 24h 만료. 초대 메일 링크 |
| 이메일 인증 토큰 | 셀프 가입 후 이메일 인증, 24h 만료 |
| 비밀번호 리셋 토큰 | 본인 비번 분실 시 사용, 24h 만료 |

## 3. 사용자 / 권한
| Role | 권한 |
| --- | --- |
| 미인증 | 공개 엔드포인트(`/login`·`/signup`·`/verify-email`·`/accept-invite`·`/forgot-password`·`/reset-password`)만 접근 |
| 인증된 모든 Role(Master 포함) | 본인 토큰 갱신·로그아웃·비밀번호 변경 |
| Master | 별도 로그인 경로 또는 동일 로그인 + 시드 식별로 진입 (구현 결정: 동일 경로 + 사용자 테이블 분리) |

> Master 로그인 단순화 정책: `master_admins`와 `users`를 **동일 로그인 엔드포인트에서 처리하되 토큰 클레임에 `isMaster=true` 플래그**로 식별. Master는 `companyId` 클레임 없음.

## 4. 사용자 스토리
- **신규 CO 후보**로서, 회사명·이메일·비밀번호로 셀프 회원가입하면, 인증 메일을 받아 클릭한 뒤 Company가 자동 생성되고 본인이 첫 CO가 된다.
- **Master가 등록한 CO**로서, 발급 메일의 임시비번으로 첫 로그인 후 비밀번호를 강제 변경한다.
- **초대받은 사용자**로서, 초대 메일 링크에서 비밀번호를 설정하면 즉시 가입·로그인된 상태가 된다.
- **사용자**로서, 이메일·비밀번호로 로그인해 인증 토큰을 받고, Access Token으로 보호된 기능을 사용한다.
- **사용자**로서, Access Token이 만료되면 Refresh Token으로 갱신하여 재로그인 없이 작업한다.
- **사용자**로서, 비밀번호를 잊으면 이메일로 리셋 링크를 받아 새 비번을 설정한다.
- **사용자**로서, 로그아웃하여 Refresh Token을 무효화한다.

## 5. 주요 흐름 / 시나리오

### 5.1 회원가입 경로 A — Master 등록 (CO 신규)
1. Master가 F-COMPANY §5.1에서 Company + 첫 CO 생성.
2. 서버가 임시비번 생성 → BCrypt 저장 → 임시비번 이메일 발송 (SRS §6.4).
3. CO가 임시비번으로 `POST /api/v1/auth/login`.
4. 서버가 인증 성공 → **`mustChangePassword=true` 플래그** 응답에 포함.
5. CO가 새 비번 설정(`POST /api/v1/auth/change-password`) → 플래그 해제.

### 5.2 회원가입 경로 B — CO 셀프 가입
1. `/signup` 진입 → email·password·name·**companyName** 입력 → `POST /api/v1/auth/signup`.
2. 서버 검증:
   - email 전역(시스템 전역 자체 unique는 아님; per-Company unique지만 셀프 가입은 **신규 Company 생성**이므로 충돌 가능성 없음)
   - companyName 길이/형식, slug 자동 생성
   - 비밀번호 정책(8자+영문+숫자+특수)
3. `companies` 생성(`is_active=false`), `users` 생성(`is_email_verified=false, is_active=true`), `user_roles`에 `(userId, COMPANY, companyId, CO)` 부여.
4. `email_verification_tokens` 1행 생성(24h 만료) → 인증 메일 발송.
5. 응답: 200 (자동 로그인 X). 인증 메일 안내.
6. 사용자가 메일의 링크 클릭 → `GET/POST /api/v1/auth/verify-email?token=...` → 토큰 검증·소비 → `users.is_email_verified=true`, `companies.is_active=true`.
7. 인증 완료 후 로그인 화면으로 안내(자동 로그인은 옵션, MVP는 수동).

### 5.3 회원가입 경로 C — 초대 수락
1. CO/WO/PO가 F-USER에서 `invitations` 발급 → 초대 메일 발송.
2. 사용자가 메일 링크 → `/accept-invite?token=...` 화면 진입.
3. 화면에서 이름(선택 사전입력)·비밀번호 입력 → `POST /api/v1/auth/accept-invite`.
4. 서버 검증:
   - 토큰 해시 일치·만료 안 됨·미사용
   - 같은 email의 기존 `users` 행이 있으면 그 행 사용(이름 갱신 옵션), 없으면 신규 생성(`is_email_verified=true`(초대=이메일 소유 검증), `is_active=true`)
   - `user_roles`에 초대된 Scope×Role 추가(중복 시 무시)
   - `invitations.accepted_at` 기록 → 토큰 무효화
5. 응답: Access/Refresh Token + 사용자 컨텍스트 (자동 로그인 처리).

### 5.4 로그인
1. `POST /api/v1/auth/login` (email·password).
2. 사용자 검색 우선순위:
   - `master_admins`에서 email 검색 → 일치 시 Master 인증 경로
   - 아니면 `users.email = ?` 검색 (Company 사용자)
3. 검증:
   - 사용자 존재
   - BCrypt 일치
   - `is_active=true`
   - `is_email_verified=true` (셀프 가입 경로 미인증 시 차단)
   - Company `is_active=true` (Master는 해당 없음)
4. 성공 시:
   - Access Token 30분 발급 (claims: `userId`, `companyId`(Master는 null), `isMaster`)
   - Refresh Token 30일 발급(자동 로그인 정책), Redis에 `refresh:{userId}:{tokenHash}` 저장(만료 TTL)
   - `mustChangePassword` 플래그 동봉(Master 등록 경로 임시비번 미변경 시 true)
5. Rate Limit (SRS §3.2): IP 분당 10회, 계정 분당 10회.

### 5.5 토큰 갱신
1. `POST /api/v1/auth/refresh` (refreshToken 본문).
2. 서버: Refresh Token 해시로 Redis 조회 → 일치·미만료·미폐기 확인 → 새 Access Token 발급.
3. **Refresh 회전(rotate) 정책**: 신규 Refresh도 함께 발급, 기존 Refresh 즉시 폐기(보안 강화).

### 5.6 로그아웃
1. `POST /api/v1/auth/logout` (Authorization + refreshToken 본문).
2. 서버: 해당 Refresh Token Redis에서 삭제. Access Token은 자연 만료(블랙리스트 미사용, MVP).

### 5.7 비밀번호 변경 (인증 사용자)
1. `POST /api/v1/auth/change-password` (currentPassword·newPassword).
2. 검증: 현재 비번 일치, 신규 정책 충족.
3. BCrypt 갱신, `mustChangePassword=false`.
4. **타 세션 Refresh Token 일괄 무효화 옵션**: 데모는 무효화(보안 보수).

### 5.8 비밀번호 리셋 — 본인 요청
1. `/forgot-password` 진입 → email 입력 → `POST /api/v1/auth/forgot-password`.
2. 서버: email 존재 여부와 무관하게 **항상 200 + 동일 안내 응답**(존재 은닉). 존재하면 토큰 생성·메일 발송.
3. `password_reset_tokens` 1행 생성(24h 만료) → 리셋 메일 발송 (Rate Limit: 5분당 3회).
4. 사용자가 메일 링크 → `/reset-password?token=...` → 새 비번 입력 → `POST /api/v1/auth/reset-password`.
5. 검증: 토큰 일치·미만료·미사용 → BCrypt 갱신 → 토큰 소비 → 모든 Refresh Token 폐기.

> **UX — 요청 결과 모달** (Figma [node 342-13221](https://www.figma.com/design/5G8kNWGjSSPaG3OepCfU55/TMS?node-id=342-13221&t=GRqPvuntD2S5NKmP-4)):
> `/forgot-password` 제출 시 **메일 정상 발송·서버/SMTP 오류 모두 동일한 모달** 노출 (존재 은닉 정책 AC-17과 정합).
> - 제목: `이메일이 전송되었습니다`
> - 본문: `재설정 링크 메일이 발송되었습니다. 새로운 비밀번호를 설정하고 다시 로그인을 시도해주세요.`
> - 닫기 → `/login` 이동.
> - 프로토타입: [`docs/design/prototypes/s-auth-forgot-password.html`](../design/prototypes/s-auth-forgot-password.html)
> - Rate Limit 초과(`AUTH_TOO_MANY_ATTEMPTS`, 429)는 예외 — 별도 인라인 에러로 처리(존재 은닉 비대상).

### 5.9 비밀번호 리셋 — CO 강제 (다른 사용자)
- F-USER §5.4 (Admin/CO 리셋)에서 임시비번 생성 → 메일 발송. 본 기능 단독 호출 X (F-USER 참조).

### 5.10 대안 / 예외 흐름
- 자격증명 불일치 → 401 `AUTH_INVALID_CREDENTIALS`(이메일 존재 여부 은닉).
- 미인증 이메일 → 403 `AUTH_EMAIL_NOT_VERIFIED`.
- 비활성 계정 → 403 `AUTH_FORBIDDEN`.
- 비활성 Company → 403 `COMPANY_INACTIVE`.
- Refresh 만료/무효/폐기 → 401 `AUTH_TOKEN_EXPIRED`.
- 초대 토큰 만료/소비/잘못된 토큰 → 400 `AUTH_INVITE_TOKEN_INVALID`.
- 이메일 인증 토큰 만료/소비/잘못된 토큰 → 400 `AUTH_EMAIL_TOKEN_INVALID`.
- 리셋 토큰 만료/소비/잘못된 토큰 → 400 `AUTH_RESET_TOKEN_INVALID`.
- Rate Limit 초과 → 429 `AUTH_TOO_MANY_ATTEMPTS`.
- 비밀번호 정책 미충족 → 400 `USER_WEAK_PASSWORD`.

## 6. 입력 / 출력

### 6.1 입력
| 구분 | 항목 | 설명/제약 |
| --- | --- | --- |
| 로그인 | email / password | 필수 |
| 셀프 가입 | email / password / name / companyName | 필수, 정책 충족 |
| 이메일 인증 | token | 필수, 1회용 |
| 초대 수락 | token / password / name(선택) | 필수, 정책 충족 |
| Refresh | refreshToken | 필수 |
| Logout | refreshToken | 필수 |
| 비번 변경 | currentPassword / newPassword | 필수, 정책 충족 |
| 비번 리셋 요청 | email | 필수 |
| 비번 리셋 확정 | token / newPassword | 필수 |

### 6.2 출력
| 구분 | 항목 | 설명 |
| --- | --- | --- |
| 로그인 성공 | accessToken / refreshToken / user (id·email·name·isMaster·companyId) / mustChangePassword | |
| 갱신 성공 | accessToken / refreshToken(rotate) | |
| 셀프 가입 | message(이메일 안내) | 토큰 미반환 |
| 이메일 인증 | success: true | |
| 초대 수락 | accessToken / refreshToken / user | 자동 로그인 |
| 비번 변경/리셋 | success: true | |
| 공통 응답 래퍼 | `success/code/message/data` | backend §4.5 |

## 7. 비즈니스 규칙
- **비밀번호 저장**: BCrypt 단방향 해시 (backend §8.3).
- **비밀번호 정책**: 최소 8자, 영문+숫자+특수 1종 이상 (SRS §3.2).
- **토큰 수명**: Access 30분, Refresh 30일(데모 자동 로그인). Refresh는 **회전(rotate)** 정책으로 갱신 시 새 Refresh 30일 발급.
- **토큰 저장**: Refresh Token은 **Redis에 해시로** 저장 (`refresh:{userId}:{hash}`). 클라이언트 노출은 원본만, 서버는 해시만 보관.
- **1회용 토큰**: 초대·이메일 인증·비번 리셋 토큰은 모두 1회용 + 24h 만료 + 해시 저장.
- **존재 은닉**: 로그인 실패·비번 리셋 요청은 사유 노출 금지(이메일 존재 여부 은닉).
- **Rate Limit**: 로그인 IP/계정 분당 10회. 메일 발송 계정 5분당 3회.
- **회원가입 경로 분기**:
  - 셀프 가입: 이메일 인증 완료 전 Company 비활성 → 로그인 차단.
  - 초대 수락: 이메일 소유 검증을 초대 자체가 대신함 → `is_email_verified=true` 자동.
- **JWT 클레임**: `userId`, `companyId`(Master는 null), `isMaster`(bool), `iat`, `exp`. Role은 미포함(매 요청 `user_roles` 조회, SRS §6.2).
- **컨텍스트 전환**: WS/Project 전환은 Path/Query로 처리, 토큰 재발급 없음.
- **Master 인증 분리**: `master_admins` 테이블 별도. 동일 로그인 엔드포인트에서 우선 매칭. Master는 `companyId=null`.

## 8. 예외 / 에러
| 상황 | 처리 | 에러 코드 |
| --- | --- | --- |
| 미인증/토큰 없음·만료 | 401 | `AUTH_UNAUTHORIZED` |
| 자격증명 불일치 | 401 | `AUTH_INVALID_CREDENTIALS` |
| Refresh 만료/무효/폐기 | 401 | `AUTH_TOKEN_EXPIRED` |
| 비활성/잠금 계정 | 403 | `AUTH_FORBIDDEN` |
| 비활성 Company | 403 | `COMPANY_INACTIVE` |
| 이메일 미인증 로그인 시도 | 403 | `AUTH_EMAIL_NOT_VERIFIED` |
| 초대 토큰 무효/만료/소비 | 400 | `AUTH_INVITE_TOKEN_INVALID` |
| 이메일 인증 토큰 무효/만료/소비 | 400 | `AUTH_EMAIL_TOKEN_INVALID` |
| 리셋 토큰 무효/만료/소비 | 400 | `AUTH_RESET_TOKEN_INVALID` |
| 비밀번호 정책 미충족 | 400 | `USER_WEAK_PASSWORD` |
| 로그인 시도/메일 발송 초과 | 429 | `AUTH_TOO_MANY_ATTEMPTS` |
| 입력 형식 오류 | 400 | `COMMON_INVALID_INPUT` |

## 9. 수용 기준 (Acceptance Criteria)
- [ ] **AC-1** Given Master 등록 흐름으로 임시비번 받은 CO, When 임시비번으로 로그인하면, Then 200 + `mustChangePassword=true` 응답.
- [ ] **AC-2** Given AC-1 후, When 새 비번으로 변경하면, Then 200 + 이후 로그인은 새 비번으로만 성공.
- [ ] **AC-3** Given 셀프 가입 입력 정상, When `POST /auth/signup` 호출하면, Then 200 + Company 비활성 생성 + 인증 메일 발송 큐 적재.
- [ ] **AC-4** Given AC-3 후 인증 메일 토큰 미사용, When 그 사용자로 로그인 시도하면, Then 403 `AUTH_EMAIL_NOT_VERIFIED`.
- [ ] **AC-5** Given AC-3 후 24h 경과한 토큰, When 인증 시도하면, Then 400 `AUTH_EMAIL_TOKEN_INVALID`.
- [ ] **AC-6** Given 유효한 인증 토큰, When 인증 완료하면, Then `users.is_email_verified=true` + `companies.is_active=true`.
- [ ] **AC-7** Given 유효한 초대 토큰, When 비번 설정·수락하면, Then 200 + Access/Refresh + `user_roles`에 초대 Scope×Role 1행 추가.
- [ ] **AC-8** Given 사용된 초대 토큰, When 다시 수락 시도하면, Then 400 `AUTH_INVITE_TOKEN_INVALID`.
- [ ] **AC-9** Given 유효한 로그인, When `POST /auth/login` 호출하면, Then 200 + Access(30분)/Refresh(30일) + user 컨텍스트.
- [ ] **AC-10** Given 잘못된 비번, When 로그인 시도하면, Then 401 `AUTH_INVALID_CREDENTIALS` (이메일 존재 여부 미노출).
- [ ] **AC-11** Given Access 만료 + 유효 Refresh, When `POST /auth/refresh` 호출하면, Then 새 Access + 새 Refresh, 기존 Refresh는 즉시 폐기.
- [ ] **AC-12** Given 로그아웃 후 동일 Refresh, When 갱신 시도하면, Then 401 `AUTH_TOKEN_EXPIRED`.
- [ ] **AC-13** Given 미인증 요청, When 보호된 리소스 호출하면, Then 401 `AUTH_UNAUTHORIZED`.
- [ ] **AC-14** Given 비활성 Company 사용자, When 로그인하면, Then 403 `COMPANY_INACTIVE`.
- [ ] **AC-15** Given 분당 10회 초과 로그인, When 11번째 시도하면, Then 429 `AUTH_TOO_MANY_ATTEMPTS`.
- [ ] **AC-16** Given 본인 비번 변경 후, When 기존 다른 세션 Refresh로 갱신 시도하면, Then 401 `AUTH_TOKEN_EXPIRED` (일괄 폐기).
- [ ] **AC-17** Given `/forgot-password`에 존재하지 않는 이메일, When 요청하면, Then 200 (동일 안내) — 존재 은닉.
- [ ] **AC-18** Given 유효한 리셋 토큰, When 새 비번 설정하면, Then 200 + BCrypt 갱신 + 모든 Refresh 폐기.
- [ ] **AC-19** Given Master 계정, When 로그인하면, Then `isMaster=true` 클레임 + `companyId=null`.

## 10. 추적성
| Requirement ID | 설명 | 관련 기능/화면 | 관련 API(개념) | 연관 TestCase |
| --- | --- | --- | --- | --- |
| REQ-AUTH-001 | Master 등록 경로 — 임시비번 로그인 + 강제 변경 | /login | `POST /auth/login`, `POST /auth/change-password` | (QA) |
| REQ-AUTH-002 | 셀프 가입 — Company 자동 생성 + 이메일 인증 게이트 | /signup, /verify-email | `POST /auth/signup`, `POST /auth/verify-email` | (QA) |
| REQ-AUTH-003 | 초대 수락 — 초대 토큰으로 가입·자동 로그인 | /accept-invite | `POST /auth/accept-invite` | (QA) |
| REQ-AUTH-004 | 로그인 + 토큰 발급(Access/Refresh) | /login | `POST /auth/login` | (QA) |
| REQ-AUTH-005 | Refresh 회전 + 갱신 | (백그라운드) | `POST /auth/refresh` | (QA) |
| REQ-AUTH-006 | 로그아웃 + Refresh 폐기 | 헤더/메뉴 | `POST /auth/logout` | (QA) |
| REQ-AUTH-007 | 본인 비번 변경 + 타 세션 폐기 | /me | `POST /auth/change-password` | (QA) |
| REQ-AUTH-008 | 본인 비번 리셋(이메일 토큰 + 존재 은닉) | /forgot-password, /reset-password | `POST /auth/forgot-password`, `POST /auth/reset-password` | (QA) |
| REQ-AUTH-009 | Rate Limit (로그인/메일 발송) | 전역 | (필터) | (QA) |
| REQ-AUTH-010 | 비활성 Company/User 차단 | 전역 | (필터) | (QA) |

## 11. 오픈 이슈 / 비고
- **Master 시드 발급 절차**: 시스템 최초 부팅 시 Master 1명 시드(application 프로퍼티/마이그레이션) → 운영 KMS는 Phase 2.
- **이메일 인증 미완료 자동 정리**: 24h 만료 후 미인증 Company/User 자동 삭제 배치 — Phase 2.
- **Access Token 블랙리스트**: MVP 미적용(Refresh 폐기 중심). 운영 강화 시 Phase 2.
- **다중 기기 동시 로그인**: 데모는 동시 N개 Refresh 허용. 운영 정책(기기당 1개·강제 단일) Phase 2.
- **SSO/소셜 로그인**: Phase 2.
- **이메일 변경 흐름**: MVP 미지원. 본인 이메일 변경 시 재인증 절차 — Phase 2.
- **자동 로그인(셀프 가입 후)**: 데모는 수동 로그인. 자동 로그인은 보안/UX 트레이드오프 — Phase 2 결정.
