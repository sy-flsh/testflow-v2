# TestFlow v2

## Auth and Permissions

TestFlow v2 uses a custom credentials authentication flow with a DB-backed opaque session cookie.

- Login/signup UI is connected to `/api/auth/login` and `/api/auth/signup`.
- Session cookie name: `tf_session`
- Session duration: 14 days
- Cookie options: `HttpOnly`, `SameSite=Lax`, `Secure` in production only, `Path=/`
- The raw session token is never stored in DB. Only `tokenHash` is stored in the `Session` table.
- `/api/auth/me` returns the current user, current workspace, role, permissions, and workspace list.
- `AuthProvider` centralizes current auth state for app pages and reduces duplicated `/api/auth/me` calls.
- Login/signup APIs use DB-backed `RateLimitBucket` records for first-stage brute force and signup abuse protection.

Protected app pages are guarded by `middleware.ts`. Unauthenticated users are redirected to `/login?next=<current-path>`. Login uses a safe internal-only `next` redirect and rejects external URLs.

Route-level API guards are applied to:

- Workspace
- Projects
- Dashboard
- Project Report
- TestCase / TestFolder
- CSV Import / XLSX Template / AI Draft
- TestRun / TestRunResult
- Defect / DefectLink

Unsafe API methods (`POST`, `PUT`, `PATCH`, `DELETE`) also enforce a same-origin CSRF guard using the `Origin` header first and `Referer` as fallback.

Auth rate limit policy:

- Login IP attempts: 10 attempts / 10 minutes
- Login email failures: 5 failed credentials / 10 minutes
- Signup IP attempts: 5 attempts / 10 minutes
- AI Draft generation: 20 attempts / 1 hour per user
- CSV Import preview/commit: 30 attempts / 1 hour per user
- Exceeded buckets return `429 RATE_LIMITED`
- Successful login resets the matching email failure bucket

RBAC policy:

| Role | Read | Create | Update | Delete | Danger Zone |
| --- | --- | --- | --- | --- | --- |
| Admin | Yes | Yes | Yes | Yes | Yes |
| Member | Yes | Yes | Yes | No | No |
| Viewer | Yes | No | No | No | No |

The UI reflects the same permissions by hiding or disabling restricted actions, but API guards remain the source of enforcement.

## Tenant Tier (Company / MasterAdmin)

기능명세서 v2의 `Company → Workspace → Project` 3-tier 구조로 가는 첫 단계(c1, expand)로 최상위 테넌트 모델을 도입했습니다.

- `Company`: 최상위 테넌트. `slug` unique, `isActive`, `ownerUserId`(현재는 relation 미연결 nullable 스칼라).
- `MasterAdmin`: 시스템 전역 관리자. `email` unique, `passwordHash`, `isActive`.
- `Workspace.companyId`(c2): Company FK + 인덱스. **nullable**로 도입했습니다 — 기존 signup 경로가 company 없이 Workspace를 생성하므로, NOT NULL 강제 + Company-aware signup 전환은 인증 단계(c5)에서 처리합니다. 기존/seed 워크스페이스는 migration backfill로 기본 Company에 연결됩니다.
- `Workspace.ownerUserId`(c2): relation 미연결 nullable 스칼라(User 모델 무변경). Role 기반 소유자 검증은 c4/c5에서 처리합니다.
- `User`-`Company` relation 연결은 다음 단계(c4)에서 진행합니다.
- Role 6단 enum(`Role`: MASTER/CO/WO/PO/MEMBER/VIEWER)과 `ScopeType` enum(COMPANY/WORKSPACE/PROJECT)은 c3에서 추가했습니다.
- `UserRole`(c4): `(userId, scopeType, scopeId, role)` (User × Scope) 다중 Role 모델, `@@unique([userId, scopeType, scopeId])`(라디오: scope 1건당 단일 Role). `scopeId`는 scopeType에 따라 company/workspace/project id를 가리키는 polymorphic 값으로 FK를 두지 않습니다. scope-role 정합성(CO=COMPANY 등)은 DB CHECK 없이 c5에서 애플리케이션 레벨로 검증합니다.
- c4에서 기존 `WorkspaceMember.role`을 `UserRole`(WORKSPACE scope)로 **이관**했습니다(매핑 ADMIN→WO, MEMBER→MEMBER, VIEWER→VIEWER). **단, `WorkspaceMember`/`WorkspaceMember.role`은 그대로 보존하며 두 모델이 병존합니다.**
- c5-1: `src/lib/auth/roles.ts`에 UserRole 기반 helper를 추가했습니다 — `getRolesByScope(userId)`(scope별 그룹화), `isRoleAllowedForScope`/`allowedScopesForRole`(scope-role 정합성: CO=COMPANY, WO=WORKSPACE, PO=PROJECT, MEMBER/VIEWER=WORKSPACE|PROJECT, MASTER는 UserRole 미사용). `/api/auth/me` 응답에 **additive**하게 `rolesByScope` 필드를 추가했습니다(기존 `user`/`workspace`/`role`/`permissions`/`workspaces`는 그대로).
- c5-2: 런타임 권한 산출을 **UserRole 우선**으로 점진 전환했습니다. `specRoleToAuthRole`(CO/WO/PO→Admin, MEMBER→Member, VIEWER→Viewer, MASTER 제외) + `resolveWorkspaceAuthRole`/`resolveProjectAuthRole`를 추가하고, `requireCurrentWorkspace`/`requireProjectAccess`/`/api/auth/me`가 이를 사용합니다.
  - **WorkspaceMember.role fallback**: UserRole(WORKSPACE)이 없으면 기존 `WorkspaceMember.role`로 fallback합니다(전환 기간 한정, 전수 백필 후 c5-3/c6에서 제거 예정).
  - **PROJECT scope**: `resolveProjectAuthRole`로 구조만 준비했습니다. PROJECT scope UserRole 데이터는 아직 없어 상위 Workspace 권한으로 fallback하므로 현재 동작은 기존과 동일합니다.
  - **계약 불변**: `/api/auth/me`/login/signup의 `role`(Admin/Member/Viewer)·`permissions` 값과 RBAC 표면은 그대로입니다. `buildPermissions(role: AuthRole)`도 그대로 재사용합니다.
- c5-3: smoke test에 UserRole-first 회귀 입증 케이스를 추가했습니다(`scripts/auth-smoke-test.mjs`). 테스트가 자체 Prisma 연결로 데이터를 임시 변경 → 검증 → `try/finally` 복원합니다(런타임 코드·seed 무변경).
  - **UserRole-first 입증**: qa.lead의 `WorkspaceMember.role`을 VIEWER로 임시 강등해도 UserRole(WORKSPACE/WO) 때문에 `/api/auth/me`가 Admin을 유지하고 Admin 전용 동작(프로젝트 삭제)이 성공함을 확인.
  - **fallback 입증**: 어떤 사용자의 UserRole(WORKSPACE)을 임시 제거하면 `WorkspaceMember.role` fallback이 `/api/auth/me` role을 결정함을 확인(검증 후 원복).
  - 참고: 전환 기간 동안 `login` 응답은 아직 `MemberRole` 기반이라 `/api/auth/me`(UserRole-first)와 값이 일시적으로 다를 수 있으므로, 입증 테스트는 role 검증을 `/api/auth/me` 기준으로 수행합니다.
- c6-1: CO Role 매트릭스 sync API 기반을 추가했습니다 — `POST /api/company/users/{userId}/roles/sync` (body `{ roles: [{ scopeType, scopeId, role }] }`).
  - **호출 권한**: `requireCompanyOwner()`로 현재 사용자의 `UserRole(COMPANY/CO)`를 확인합니다(아니면 403). 단일 Company 가정이며 다중 Company CO disambiguation은 c6-2.
  - **검증**: scope-role 정합성(`USER_INVALID_ROLE_SCOPE`, MASTER 부여 불가), 중복 scope(`USER_DUPLICATE_SCOPE`), Company 소속(`USER_SCOPE_NOT_IN_COMPANY` — WORKSPACE/PROJECT scopeId가 해당 Company 소속이어야 함).
  - **동기화**: 단일 트랜잭션으로 대상 사용자의 **회사 범위 내** UserRole을 body 기준으로 교체(없는 것 제거, 있는 것 생성).
  - **보호 규칙**: 마지막 CO 회수 금지(`USER_LAST_CO_FORBIDDEN`), 본인 CO 자가 회수 금지(`USER_SELF_CO_REVOKE_FORBIDDEN`).
  - UI는 없습니다(API 기반만). MasterAdmin 경로는 아직 미연결.
- c6-2: sync API 보호 규칙을 강화했습니다.
  - **마지막 WO 보호**(`USER_LAST_WO_FORBIDDEN`): 대상이 해당 Workspace의 유일한 WO인데 body에서 그 WO가 유지되지 않으면 차단.
  - **마지막 PO 보호**(`USER_LAST_PO_FORBIDDEN`): 대상이 해당 Project의 유일한 PO인데 body에서 그 PO가 유지되지 않으면 차단.
  - **PROJECT scope 우선권 검증**: `resolveProjectAuthRole`이 PROJECT/PO를 workspace fallback보다 우선함을 smoke로 입증(워크스페이스 MEMBER 사용자가 특정 프로젝트 PROJECT/PO 부여 시 그 프로젝트에서 Admin급 — 자산 삭제 가능).
  - 보호 검사는 트랜잭션 직전에 회사-범위 scope를 cross-user 카운팅하여 수행합니다.
- c6-3: sync API의 보호 검사(마지막 CO/본인 CO/마지막 WO/마지막 PO)를 **트랜잭션 내부로 이동**해 동시성 안전성을 강화했습니다.
  - 현재 상태 조회 + cross-user 카운팅 + `deleteMany`/`createMany`를 **단일 `Serializable` 트랜잭션**에서 수행 → 두 CO가 동시에 마지막 owner를 회수하는 race를 방지합니다.
  - 보호 위반은 `RoleSyncProtectionError`로 throw → 트랜잭션 롤백 → 외부 catch에서 기존 code(`USER_LAST_CO_FORBIDDEN`/`USER_SELF_CO_REVOKE_FORBIDDEN`/`USER_LAST_WO_FORBIDDEN`/`USER_LAST_PO_FORBIDDEN`)로 매핑합니다.
  - API path/body/response·에러 code·정상 동작은 불변(검증: test:auth 62 PASS 유지).
- c7-1: CO 회원관리 1차 — 목록 화면 + Role 요약.
  - `GET /api/company/users`: CO인 Company 기준으로 사용자와 Scope별 UserRole 요약을 반환(비CO 403). 표시는 UserRole 기준(WorkspaceMember.role fallback 미사용), 상태(ACTIVE/PENDING)만 WorkspaceMember.status에서 파생.
  - Role 요약 토큰: COMPANY/CO→`CO`, WORKSPACE→`WO(W)`/`M(W)`/`V(W)`, PROJECT→`PO(P)`/`M(P)`/`V(P)` (`roleSummaryToken` helper).
  - `/company/users` 화면: 표 형태 목록(이름/이메일/권한 요약 badge/상태/액션). "권한 관리" 액션은 **disabled**(상세 drawer·Role Matrix 편집은 c7-2 예정).
  - 네비게이션: 사이드바에 **CO에게만** "회원 관리" 링크 노출(`auth.rolesByScope.company`에 CO 존재 시). 미인증 시 `/company/*`는 미들웨어가 로그인으로 리다이렉트.
- c7-2: CO 회원관리 2차 — 사용자 상세 Drawer + Role Matrix 편집.
  - `GET /api/company/users/{userId}`: CO인 Company 범위 사용자 1명의 프로필 + 현재 UserRole 전체 + Matrix 행 구성용 Workspace/Project 트리를 반환(비CO 403, 다른 Company/미존재 사용자 404 `USER_NOT_FOUND`). UserRole 기준 표시, 상태만 WorkspaceMember.status 파생.
  - 목록의 "상세/권한 관리" → 우측 슬라이드인 Drawer(`DrawerShell` 재사용). 탭 2개: **프로필**(이름/이메일/상태/Role 요약, read-only) · **권한 관리**(Company CO 체크박스 + Workspace/Project 세그먼트 매트릭스).
  - 저장: Drawer 로컬 dirty state → 변경 시에만 [저장] 활성 → 기존 `POST .../roles/sync`(body `{ roles: [...] }`, 전체 desired 목록)로 1회 호출. 성공 시 원본/draft 갱신·목록 행 요약 즉시 갱신, 실패 시 local state 유지 + 서버 error code를 한국어 메시지로 표시(`USER_LAST_CO_FORBIDDEN`/`USER_SELF_CO_REVOKE_FORBIDDEN`/`USER_LAST_WO_FORBIDDEN`/`USER_LAST_PO_FORBIDDEN`/`USER_INVALID_ROLE_SCOPE`/`USER_DUPLICATE_SCOPE`/`USER_SCOPE_NOT_IN_COMPANY` 등). 마지막 CO/WO/PO·본인 CO 보호는 서버가 최종 기준.
- c8-1: Company 사용자 초대 데이터 모델 + 관리 API (수락/SMTP/회원가입 연결은 c8-2 이후).
  - 모델: `Invitation`(`invitations`) + `InvitationRole`(`invitation_roles`) + `InvitationStatus` enum(PENDING/ACCEPTED/REVOKED/EXPIRED). migration `add_company_invitations`. 토큰은 `randomBytes(32).base64url` raw → DB엔 **SHA-256 `tokenHash`만 저장**(raw 미저장), 생성 응답에서만 `inviteUrl=/invite/accept?token=<raw>` 1회 반환.
  - `POST /api/company/invitations`(CO+CSRF): email 정규화(trim+lowercase)·형식검증, roles≥1, MASTER 금지·scope-role 정합성·회사 소속 검증(`USER_INVALID_ROLE_SCOPE`/`USER_DUPLICATE_SCOPE`/`USER_SCOPE_NOT_IN_COMPANY`). 동일 Company+email **기존 PENDING은 단일 트랜잭션으로 REVOKED 후 새 초대 생성**, ACCEPTED 존재 시 409 `INVITE_ALREADY_ACCEPTED`. 응답에 `existingUser` 포함. (isolation=default — cross-row 불변식 없음)
  - `GET /api/company/invitations`(CO): 현재 Company 초대 최신순. **조회 전 만료 PENDING→EXPIRED `updateMany`**(상태 정합성 유지). `tokenHash`/raw token/passwordHash 미반환.
  - `POST /api/company/invitations/{id}/revoke`(CO+CSRF): PENDING만 REVOKED(상태만 변경, Role snapshot 보존). 비-PENDING/만료 400 `INVITE_NOT_PENDING`, 타 Company/미존재 404 `INVITE_NOT_FOUND`.
- c8-2: 초대 수락 API + 화면 (SMTP/이메일 인증/비번 리셋 제외).
  - `POST /api/invitations/validate`(공개): body의 raw token을 SHA-256 hash로 조회. PENDING만 `{ invitationId, email, companyName, expiresAt, roles, existingUser }` 반환(token/tokenHash 미반환). 만료 PENDING→EXPIRED 전환. 상태별 `INVITE_NOT_FOUND`/`INVITE_EXPIRED`/`INVITE_REVOKED`/`INVITE_ALREADY_ACCEPTED`.
  - `POST /api/invitations/accept`(CSRF + IP rate limit): body `{ token, name?, password? }`. **단일 Serializable 트랜잭션**으로 상태 재검증 → role/scope·회사소속 재검증(MASTER 금지) → 충돌 선검증 → InvitationRole→UserRole 승격 + **상위 Workspace 활성 멤버십 보장**(아래) → `PENDING→ACCEPTED`(`acceptedAt`). 신규 사용자(세션 없고 User 미존재): `name`+`password`(bcrypt, 기존 정책) 필수 → User 생성 후 **세션 생성(자동 로그인)**. 기존 로그인 사용자: email 일치 시에만 수락, **기존 세션 유지**(불일치 403 `INVITE_EMAIL_MISMATCH`, 비로그인 기존 User는 401 `INVITE_LOGIN_REQUIRED`).
  - **Role conflict 정책**: 같은 `(scopeType,scopeId)`에 기존 UserRole이 있고 초대 Role과 **다르면 409 `INVITE_ROLE_CONFLICT`로 전체 수락 중단**(부분 적용 없음), 응답 `error.conflicts[]`에 충돌 scope 포함. **같으면 유지(멱등), 없으면 생성** — 기존 Role을 초대가 덮어쓰지 않음.
  - **WorkspaceMember 활성 멤버십 보장(c8-2-hotfix)**: 충돌 선검증 통과 후, 초대 roles의 상위 Workspace 마다 `WorkspaceMember(ACTIVE)`를 1건 보장한다(workspaceId 기준 dedupe·upsert, 없을 때만 생성, 기존 멤버십 role/status 미변경). WORKSPACE scope는 매핑 role(WO→ADMIN/MEMBER→MEMBER/VIEWER→VIEWER), **PROJECT scope는 상위 Workspace에 멤버십이 없으면 최소 MEMBER로 생성**(같은 Workspace에 WORKSPACE role이 함께 있으면 그 매핑 role이 우선). 신규 사용자 세션의 활성 Workspace도 이 Workspace로 선택 → PROJECT-only 초대도 `/api/auth/me`·dashboard가 정상 동작. **프로젝트 권한 정본은 UserRole(PROJECT scope)** 이며, 이 멤버십은 접근/활성 Workspace 해석용 최소 멤버십이다.
  - 설계 판단: `User.companyId` 컬럼을 추가하지 않고 **UserRole(권한 정본) + 상위 Workspace의 WorkspaceMember(ACTIVE) dual-write**를 Company 참여 근거로 사용(seed가 모든 사용자에 대해 둘을 함께 만드는 것과 동일). 이로써 기존 멤버십 기반 세션/워크스페이스 해석(`resolveActiveMembership`)이 그대로 동작.
  - `/invite/accept?token=`(공개): validate 호출 → Company명·이메일·부여 Role·만료 표시. 신규=이름/비번 폼, 기존=로그인 상태/이메일 일치에 따라 [초대 수락]·로그인 유도(`/login?next=`)·불일치 안내. 성공 시 `redirectTo`(workspace role 있으면 `/dashboard`, CO만이면 `/company/users`)로 이동. raw token은 화면 상태로만 사용(로그 미출력).
- c8-3: CO 초대 관리 UI (기존 c8-1/c8-2 API 재사용, API 무변경).
  - `GET /api/company/scopes`(CO, 읽기 전용): 초대 Role Matrix용 `{ company, workspaces:[{id,name,projects:[{id,name}]}] }` 반환(비CO 403, 타 Company 미포함). Prisma 변경 없음.
  - `/company/users`에 **탭 2개**(사용자 / 초대 관리) + 상단 [사용자 초대] 버튼 추가(기존 목록·상세 Drawer 유지). 사용자 탭이 기본.
  - 초대 생성 Drawer(`DrawerShell` 재사용): 이메일 + c7-2와 동일한 Role Matrix(Company CO 체크박스, Workspace `없음/WO/Member/Viewer`, Project `없음/PO/Member/Viewer`, scope당 단일 Role, 미선택 행 제외, 최소 1개 선택 시 [초대 생성] 활성). 생성 성공 시 **Modal을 닫지 않고 성공 화면**으로 전환 — 이메일·만료·Role 요약 + **inviteUrl 1회 표시 + [링크 복사](Clipboard 실패 시 readonly input 선택)** + "지금만 확인 가능" 안내. [닫기] 시 inviteUrl을 state에서 제거하고 초대 목록 새로고침.
  - 초대 관리 탭: `GET /api/company/invitations` 최신순 표(이메일/권한 요약/상태 badge(대기 중·수락 완료·취소됨·만료됨)/초대한 사람/생성일/만료일/액션). **PENDING만 [초대 취소]**(inline 확인 → `revoke` → 행 상태 즉시 REVOKED). tokenHash/raw token/inviteUrl 미표시.
  - 에러: 생성/취소 server code를 한국어로 매핑(`inviteErrorMessage`); 실패 시 작성 중 email/Role draft 유지. raw inviteUrl은 목록 전역 state·storage에 저장하지 않음.
- c8-4: PENDING 초대 재발송 (생성/목록/revoke/validate/accept API 무변경).
  - `POST /api/company/invitations/{id}/resend`(CO+CSRF): 현재 Company의 **PENDING만** 재발송(타 Company/미존재 404 `INVITE_NOT_FOUND`, 비-PENDING/만료 400 `INVITE_NOT_PENDING`). **단일 트랜잭션**: 기존 → `REVOKED`(`revokedAt`), 새 Invitation(`PENDING`, 동일 email/companyId, `invitedBy`=재발송 CO, **새 raw token→새 tokenHash만 저장**, `expiresAt`=now+24h) + **기존 InvitationRole snapshot 그대로 복제**. 201 + `{ invitation, inviteUrl }`(새 raw token은 inviteUrl로만 1회). isolation=default(Read Committed) — cross-row 불변식 없음, revoke를 `where status=PENDING` count 가드로 동시 재발송/취소 race 방어(0건이면 롤백). 기존 token은 이후 validate/accept 시 `INVITE_REVOKED`, 새 token만 유효.
  - 초대 관리 탭: PENDING 행에 **[재발송]·[초대 취소]** 두 액션. 재발송은 inline 확인("기존 링크는 즉시 무효화되고 새 링크가 생성됩니다") → 호출(중복 클릭 방지) → 성공 시 **재발송 성공 Drawer**(공용 `InviteSuccess` 재사용)에 새 inviteUrl 1회 표시 + 복사(Clipboard 실패 시 readonly input 선택) + "지금만 확인 가능" 안내. 닫기 시 inviteUrl을 state에서 제거하고 목록 재조회(기존 REVOKED + 새 PENDING 반영). 실패 시 해당 행에 한국어 오류만 표시(목록 미갱신, 재시도 가능). ACCEPTED/REVOKED/EXPIRED엔 재발송 버튼 미노출.
- c8-5: 초대 목록 검색·상태 필터·서버 페이지네이션·URL 상태 동기화.
  - `GET /api/company/invitations` query 확장: `q`(email **case-insensitive contains**, trim), `status`(PENDING/ACCEPTED/REVOKED/EXPIRED/**ALL** 기본), `page`(≥1, 기본 1), `size`(10/20/50, 기본 20), `sort`(**newest**/oldest/expiresAtAsc/expiresAtDesc). **잘못된 값은 400 대신 안전한 기본값으로 fallback**(URL이 정본·북마크/뒤로가기 내성). 응답에 `pagination{page,size,total,totalPages,hasPrevious,hasNext}` + `filters{q,status,sort}` 추가(`invitations` 키는 기존 호환 유지). 만료 PENDING→EXPIRED는 조회 전 처리. `page`가 범위를 넘으면 **마지막 유효 page로 clamp**. tokenHash/raw token/inviteUrl 미포함, 타 Company 절대 미포함.
  - `/company/users` URL 정본: `tab`(users/invitations)·`q`·`status`·`page`·`size`·`sort`·`modal=invite`를 `useSearchParams/useRouter/usePathname`로 동기화(full reload 없음, 기본값은 URL에서 생략). 뒤로/앞으로/새로고침 복원. 검색/필터/정렬/size 변경 시 `page`=1 초기화. `modal=invite`로 생성 Drawer 자동 오픈, 닫으면 `modal` 제거. 사용자 탭에서 invitation 전용 param이 있어도 무시. raw token/inviteUrl은 URL에 넣지 않음. (page는 Suspense로 감싸 `useSearchParams` 정적 빌드 대응)
  - 초대 관리 UI: 이메일 검색(**Enter/검색 버튼 적용** — 키 입력마다 호출/히스토리 오염 방지), 상태 segment 버튼(전체/대기 중/수락 완료/취소됨/만료됨), 정렬 select, size select, 이전/다음 페이지(`page/totalPages`·`총 N건`, 경계 비활성). 생성 성공 닫기 → 초대 관리 탭+page1로 이동·재조회. 취소/재발송 성공 → 현재 조건으로 재조회(page 비면 server clamp+URL 보정). 로딩 실패 시 [다시 시도], 검색/필터 draft 유지.
- c9-1: Company 단위 사용자 비활성/활성 + 접근 차단.
  - 모델: `CompanyUserState`(`company_user_states`, `@@unique([companyId,userId])`) + `CompanyUserStatus(ACTIVE/INACTIVE)`. **전역 `User.isActive`를 추가하지 않고 Company 단위 상태**(한 User가 여러 Company 소속 가능). migration `add_company_user_state` + **backfill**(Company scope UserRole 보유자 ∪ 해당 Company Workspace 멤버 → ACTIVE, `ON CONFLICT DO NOTHING`). seed는 demo 4계정을 ACTIVE로 명시 생성(`db:reset:dev`는 backfill을 거치지 않으므로 seed가 상태 보장). 비활성화는 **UserRole/WorkspaceMember를 삭제하지 않고 status만 변경**, 재활성화 시 기존 데이터 재사용.
  - Fallback 정책: `CompanyUserState` 레코드가 **없으면 ACTIVE로 간주**(보수적). INACTIVE는 오직 deactivate API로만 발생. backfill/seed가 기존/demo 멤버의 ACTIVE를 보장하므로 누락은 배포 과도기 안전망일 뿐. (smoke로 seed ACTIVE 검증)
  - guard 연동: `requireCompanyOwner()`는 **ACTIVE인 CO Company만 인정**(INACTIVE면 403 `USER_INACTIVE`). `requireCurrentWorkspace()`(→ `requireProjectAccess`/dashboard 포함)는 선택 Workspace의 상위 Company가 INACTIVE면 403 `USER_INACTIVE`. `/api/auth/me`는 **INACTIVE Company의 Workspace를 활성 후보에서 제외하고 다른 ACTIVE Workspace로 fallback**(없으면 401). 다른 Company ACTIVE 접근은 유지.
  - API: `POST /api/company/users/{id}/deactivate`·`/activate`(CO + CSRF, 현재 Company 사용자만, 타/미존재 404 `USER_NOT_FOUND`). 멱등(이미 그 상태면 no-op 200). 비활성 보호(트랜잭션·Serializable): ① 마지막 ACTIVE CO → 400 `USER_LAST_CO_DEACTIVATE_FORBIDDEN`(sole-CO 본인 비활성 포함) → ② 본인 비활성 → 400 `USER_SELF_DEACTIVATE_FORBIDDEN`(2명+ CO 중 본인). "마지막 CO"는 ACTIVE 상태 기준.
  - UI: `/company/users` 목록·상세 Drawer 상태 badge가 **CompanyUserState 기준 활성/비활성**. 상세 프로필 탭에 "계정 상태" 영역([비활성화] 확인("이 Company의 Workspace/Project 접근 차단") / [활성화]) — 본인은 버튼 disabled(서버 보호는 별도 유지), 성공 시 목록·Drawer 즉시 갱신, 실패 시 `USER_SELF_DEACTIVATE_FORBIDDEN`/`USER_LAST_CO_DEACTIVATE_FORBIDDEN`/`USER_INACTIVE`/`AUTH_FORBIDDEN`를 한국어로 표시.
- c9-2: 초대 수락 시 CompanyUserState 명시 보장 + INACTIVE 자동 재활성화 방지 (accept API만 변경).
  - `POST /api/invitations/accept`의 **단일 Serializable 트랜잭션 내부**(대상 User 확정 후, UserRole 충돌 선검증 직전)에서 `Invitation.companyId` 기준 `CompanyUserState`를 보장: **레코드 없으면(신규 가입 / legacy 기존 사용자) ACTIVE 생성**, **이미 ACTIVE면 no-op(감사 필드 미덮어씀)**, **INACTIVE면 수락 전체 중단** → 403 `USER_INACTIVE`("이 Company에서 비활성화된 사용자입니다. 회사 관리자에게 활성화를 요청해 주세요."). INACTIVE 차단 시 Invitation은 **PENDING 유지**, UserRole/WorkspaceMember/세션 변경 없음(트랜잭션 롤백). 같은 트랜잭션이라 "CompanyUserState만 생기고 invitation 미수락" 같은 부분 상태 없음.
  - 정책: INACTIVE 사용자는 초대 수락으로 자동 활성화되지 않고, CO가 `/company/users`에서 명시 활성화한 뒤에만 복구. **일반 회원가입(`/api/auth/signup`)은 Company 문맥이 없어 CompanyUserState를 만들지 않음**(이번 범위 제외). UserRole/WorkspaceMember 보장은 c8-2 방식 그대로. 수락 화면은 accept 결과 `USER_INACTIVE`를 한국어로 표시.
- c9-3: Company 사용자 목록 검색·상태 필터·서버 페이지네이션·URL 상태 동기화.
  - `GET /api/company/users` query 확장: `q`(name/email **case-insensitive contains**, trim), `status`(ALL/ACTIVE/INACTIVE — **CompanyUserState 기준**, 레코드 없으면 ACTIVE fallback), `page`(≥1), `size`(10/20/50, 기본 20), `sort`(**nameAsc**/nameDesc/newest). 잘못된 값은 400 대신 안전한 기본값 fallback. 응답에 `pagination` + `filters` additive(`users`·`status` 필드 유지). **대상 집합 = 회사 scope UserRole 보유자 ∪ 회사 Workspace 멤버 ∪ 회사 CompanyUserState 보유자**(state만 남은 INACTIVE 사용자도 유지) — Company 단위로 한정된 bulk 조회 후 서버에서 검색·필터·정렬·페이지(N+1 없음). `newest` = `CompanyUserState.createdAt` DESC, state 없는 legacy는 마지막, 이후 name ASC 보조. 타 Company 사용자는 목록/total 미포함. tokenHash/passwordHash/감사필드 미반환.
  - 공용 normalizer: `src/lib/company/company-user-filters.ts`(초대용 `invitation-filters`와 status/sort 의미가 달라 파일 분리).
  - URL 상태: 사용자 탭은 **`userQ`/`userStatus`/`userPage`/`userSize`/`userSort`** 전용 키, 초대 탭은 기존 `q`/`status`/`page`/`size`/`sort` 키 — **탭 간 분리**라 전환해도 서로의 조건이 보존됨(키 충돌 없음). `useSearchParams/useRouter/usePathname`, push/replace + `scroll:false`, 기본값 URL 생략, 검색/필터/정렬/size 변경 시 page=1, 뒤로/앞으로/새로고침 복원.
  - UI: 사용자 탭에 이메일/이름 검색(Enter/버튼 적용), 상태 segment(전체/활성/비활성), 정렬 select(이름 오름/내림/최근 등록순), size select, 이전·다음 페이지(`page/totalPages`·`총 N명`). **활성/비활성 변경 후 현재 조건으로 재조회**(필터에서 벗어난 행은 사라짐, page 비면 server clamp+URL replace 보정), Role 저장은 행만 갱신(조건 유지). 로딩/[다시 시도]/forbidden, 상세 Drawer 열린 채 재조회돼도 Drawer 유지.
- c9-4: 비활성 Company 사용자 전용 접근 제한 UX.
  - `/api/auth/me`: 세션은 있으나 활성 Workspace 후보가 0이고 그 사유가 **INACTIVE Company 때문에 제외된 ACTIVE 멤버십**이면 **403 `USER_INACTIVE`**("현재 Company에서 비활성화되어 접근할 수 없습니다. 관리자에게 문의해 주세요.") — 멤버십이 아예 없거나(예: Company-only CO) 다른 사유면 기존 **401 `AUTH_UNAUTHORIZED`** 유지. 다른 ACTIVE Company Workspace가 있으면 USER_INACTIVE 대신 기존 fallback 200 우선. 응답은 `error{message,code}`만(Company 이름/role/token 등 미노출). 판별 helper `hasMembershipBlockedByInactiveCompany`.
  - 클라이언트: `requestAuthData`가 실패 시 `AuthRequestError(status, code)`로 **error code 보존** → `AuthProvider`/`useCurrentAuth`가 `errorCode` 노출. **AppShell-internal 게이팅**(별도 route 없음): `AppShellBody`가 `errorCode==="USER_INACTIVE"`면 로그인으로 redirect하지 않고 **전용 접근 제한 화면(`AccessRestricted`, 네비게이션 없음, [로그아웃])** 렌더, 그 외/정상은 기존 셸 유지. 인증 로딩 중에는 민감 콘텐츠 대신 로딩 표시(깜빡임 방지). 새로고침/뒤로가기 시 me 재호출로 동일 화면 복원, 무한 redirect/반복 fetch 없음. 로그아웃은 기존 `logout()`(POST `/api/auth/logout`, company guard 없음) 재사용 → `/login` 이동. 일반 401/403은 기존 처리 유지(USER_INACTIVE만 특수 처리). API 차단(c9-1)은 그대로 유지(보완).
- c9-5: 비활성 사용자 세션 재검증 + 감사 로그 보강 (세션/쿠키 강제 삭제 없음).
  - **deactivate/activate 감사 필드**: deactivate 성공 시 `deactivatedAt`=현재시각·`deactivatedByUserId`=요청 CO, activate 성공 시 `reactivatedAt`·`reactivatedByUserId` 기록. **멱등 no-op은 감사 시각/actor를 덮어쓰지 않음**(이미 INACTIVE 재-deactivate / 이미 ACTIVE 재-activate는 상태/감사 유지 — 실제 전이일 때만 기록). 보호규칙(self/last-CO)·CO+CSRF·Serializable 유지.
  - **AuthProvider background revalidation**: `isLoading`을 **`isInitialLoading`(최초 로드만)** 과 **`isRefreshing`(백그라운드)** 으로 분리 — `isLoading`은 초기 로드만 true라 background 재검증에서 화면/권한 메시지 깜빡임 없음. **단일 in-flight ref**로 interval/focus/visibility 동시 트리거에도 me 요청 1개만, 짧은 중복 트리거는 3초 cooldown으로 억제. unmount 시 interval/listener cleanup + `mountedRef` 가드로 종료 컴포넌트 setState 방지. 성공 시점에만 상태 갱신(미리 비우지 않음)이라 USER_INACTIVE 유지/전환이 깜빡이지 않음.
  - **재검증 트리거**: ① 60초 주기(**숨김 탭에서는 polling 안 함** — 불필요 요청 절약, 복귀 시 즉시 확인) ② `window focus` ③ `document visibilitychange`(visible). 비활성→활성 전환 시 **새로고침 없이** 다음 polling/focus에서 me 200 → `errorCode` 제거 → AccessRestricted 사라지고 정상 셸 복귀. USER_INACTIVE 동안에도 재검증은 계속(콘솔 오류/깜빡임 없이 AccessRestricted 유지). logout 중에는 `loggingOutRef`로 background 재검증을 무시해 `/login` 이동 안정화.
  - **감사 로그(구조화 abstraction, 영속 테이블 없음)**: `src/lib/security/audit-log.ts`가 `COMPANY_USER_DEACTIVATED`/`COMPANY_USER_REACTIVATED`(상태 변경 시) + `INACTIVE_COMPANY_ACCESS_DENIED`(`requireCompanyOwner`/`requireCurrentWorkspace`/`auth.me` 차단 시)를 **단일 라인 JSON**(`[security-audit] {...}`)으로 emit. 필드: `eventType`·`occurredAt`·`actorUserId?`·`targetUserId?`·`companyId?`·`guardName?`. **민감정보(token/password/cookie/inviteUrl/body) 미기록**. access-denied는 `(eventType,userId,companyId)` 기준 **5분 in-memory throttle**로 중복 억제. **예외 격리**라 로깅 실패가 403/정상 응답을 바꾸지 않음. companyId를 특정 못 하면 억지 추론하지 않음. (c9-5 시점엔 in-memory throttle + 구조화 로그뿐 → **c9-6에서 영속 DB + 분산 throttle로 확장**.)
- c9-6: 영속 Security Audit Log + retention + DB 기반 분산 throttle.
  - 모델: `SecurityAuditEvent`(`security_audit_events`) + `SecurityAuditThrottle`(`security_audit_throttles`) + `SecurityAuditEventType` enum(3종 — 서버 내부 고정 집합이라 enum 선택). actor/target/company는 **relation 없는 scalar ID**(User/Company 삭제 후에도 감사 보존, FK cascade로 흔적이 사라지지 않게). migration `add_security_audit_events`. `metadata`는 NULL(payload·민감정보 미저장). 인덱스: `occurredAt`, `[eventType,occurredAt]`, `[companyId,occurredAt]`, `[targetUserId,occurredAt]`, throttle `[expiresAt]`·`[eventType,targetUserId,companyId]`.
  - `src/lib/security/audit-log.ts`의 sink를 구조화 콘솔 → **durable DB**로 확장(호출부 계약 유지: `recordSecurityAuditEvent(input)`는 이제 `Promise<boolean>`, 절대 throw 안 함). 상태 변경(DEACTIVATED/REACTIVATED)은 실제 전이마다 항상 저장. access-denied는 **Postgres `INSERT … ON CONFLICT(throttleKey) DO UPDATE … WHERE lastEmittedAt < cutoff RETURNING`** 원자 연산으로 window당 1건만 저장(다중 인스턴스 경쟁에서도 유니크 인덱스 직렬화로 정확히 1건) — throttle 갱신+이벤트 저장을 같은 트랜잭션으로 묶음. `throttleKey=INACTIVE_COMPANY_ACCESS_DENIED:<targetUserId>:<companyId>`, companyId/targetUserId 불특정 시 기록 생략(억지 추론 안 함). 콘솔 구조화 로그는 **dev/test에서만**(production은 DB가 정본, 중복 노출 안 함).
  - 호출부: deactivate/activate는 main 트랜잭션 **성공 후** best-effort `await`(감사 실패가 상태 변경을 rollback시키지 않음). guard/me는 USER_INACTIVE throw/return 직전 `await`(helper가 swallow하므로 403 응답·권한 판단 불변).
  - retention: `SecurityAuditEvent` 기본 **90일**(`SECURITY_AUDIT_RETENTION_DAYS`, 1↑ 정수 외 90 fallback), throttle은 `expiresAt < now` 정리. throttle window는 `SECURITY_AUDIT_DENY_THROTTLE_SECONDS`(기본 300, 1↑ 외 300 fallback).
  - **보장 범위/한계**: DB 기반이라 multi-instance에서 분산 throttle이 정확(원자 conditional upsert). 단 access-denied는 "window당 1건 저장"이 목표라 일부 차단 요청은 로깅되지 않음(설계 의도). 상태 변경은 무손실.
- c9-7: Company 보안 감사 로그 조회(read-only) API + 관리 UI.
  - `GET /api/company/security-audit`(CO 전용): `requireCompanyOwner`(비CO 403 `AUTH_FORBIDDEN`, INACTIVE CO 403 `USER_INACTIVE`). **범위 = `SecurityAuditEvent.companyId = 현재 Company`**(companyId null·타 Company는 목록/total/검색 어디에도 미포함). query: `eventType`(ALL/3종), `from`·`to`(YYYY-MM-DD), `user`(actor 또는 target 이름/이메일 case-insensitive contains), `guard`(guardName contains), `page`·`size`(10/20/50)·`sort`(newest/oldest). 잘못된 값은 400 대신 안전한 기본값 fallback. 응답에 `pagination`+`filters`. **metadata·throttleKey·timestamp·raw 민감정보 절대 미반환**, actor/target DTO는 `userId/name/email`만.
    - **삭제된 사용자 fallback**: audit event는 사라지지 않고 `actor/target`의 `userId`는 유지, `name/email`은 null. user/guard/eventType/date 모두 DB-level 필터(actor/target은 `userId in matched` IN 절)라 `total`·pagination 정확, event별 `findUnique` 없이 actor/target id dedupe 후 **단일 bulk `user.findMany`**(N+1 없음).
    - **날짜/timezone**: 프로젝트에 timezone 유틸이 없어 `from`/`to`를 **UTC day boundary**로 해석(from=`00:00:00.000Z` inclusive, to=`23:59:59.999Z` inclusive). 형식·실존하지 않는 날짜(예: 2026-13-40)는 해당 필터만 무시. **`from > to`면 swap하지 않고 날짜 필터 전체 해제**(fallback) — 모호한 빈 결과 방지.
  - `/company/security-audit` read-only 페이지(사이드바 CO 한정 "보안 감사 로그" 메뉴 — "회원 관리" 근처). 필터(이벤트 유형 segment, 시작/종료일 date input, 사용자/Guard 검색은 Enter/버튼 적용, 정렬·size, [필터 초기화]) + 표(발생 시각/이벤트(한글 badge)/처리자/대상 사용자/발생 위치) + 페이지네이션. 처리자 없으면 "시스템", 삭제된 사용자는 "삭제된 사용자"+짧은 userId, 대상 없으면 "-". `INACTIVE_COMPANY_ACCESS_DENIED`는 경고(amber) 톤. **audit 전용 URL prefix `auditType/auditFrom/auditTo/auditUser/auditGuard/auditPage/auditSize/auditSort`**(다른 화면 query와 충돌 없음, 기본값 생략, 뒤로/앞으로/새로고침 복원, page clamp는 replace). 필터/페이지/재시도에서만 fetch(AppShell `me` polling과 무관, background 재조회 없음). 권한 변화로 USER_INACTIVE가 되면 AppShell `AccessRestricted`가 우선(감사 목록 미노출). **감사 수정/삭제 API/UI 없음**(read-only).
- c9-8: 보안 감사 로그 운영 편의(CSV export / 통계 summary / 기간 프리셋 / 사용자 Drawer 연결).
  - **공용 filter helper**: `src/lib/company/security-audit-query.ts`(`parseSecurityAuditFilters`/`resolveMatchedUserIds`/`buildSecurityAuditWhere`/`securityAuditOrderBy`/`loadAuditUserMap`/`auditUserRef`)로 list·export·summary가 **100% 동일한 필터·user 검색 규칙**을 공유.
  - `GET /api/company/security-audit` 응답에 **`summary` additive**: `{ total, byEventType{ COMPANY_USER_DEACTIVATED, COMPANY_USER_REACTIVATED, INACTIVE_COMPANY_ACCESS_DENIED } }`. 현재 **date/user/guard 필터는 적용, eventType 필터는 제외**(유형 버튼을 눌러도 전체 유형 비교 유지). companyId null·타 Company 제외, `total = byEventType 합계`, metadata/throttle 미포함. (groupBy 1회)
  - `GET /api/company/security-audit/export`(CO 전용): list와 **동일 필터**(page/size만 무시, 전체 결과). **안전 상한 기본 10,000**(`SECURITY_AUDIT_EXPORT_LIMIT` env override) — 초과 시 **422 `SECURITY_AUDIT_EXPORT_LIMIT_EXCEEDED`**. CSV: **UTF-8 BOM**(Excel 한글), `text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="security-audit-YYYYMMDD-HHmmss.csv"`(서버 UTC 타임스탬프, 사용자 입력 미포함). **RFC4180 escape**(comma/quote/newline → quote, `"`→`""`) + **formula injection 방지**(`= + - @` 시작 셀 앞에 `'`). 컬럼 allowlist 10개(발생시각 UTC ISO/유형 코드/유형 이름/처리자 이름·이메일·ID/대상 이름·이메일·ID/발생 위치) — **metadata·throttle·companyId·raw 민감정보 미포함**. actor 없음→"시스템", target 없음→빈 컬럼, 삭제된 사용자→"삭제된 사용자"+userId 유지. 빈 결과는 header-only CSV 200. N+1 없음(actor/target id dedupe + bulk).
  - UI: 상단 **통계 카드 4개**(전체/비활성화/활성화(emerald)/접근 차단(amber); 0도 표시; "현재 기간·사용자·Guard 기준, eventType 무관" 안내). **기간 프리셋**(전체/오늘/최근 7일/최근 30일 — **UTC `YYYY-MM-DD`** 계산; 오늘=오늘, 7일=6일전~오늘, 30일=29일전~오늘; 클릭 시 `auditFrom/auditTo`만 설정+page1; 수동 변경 시 from/to가 프리셋과 정확히 일치할 때만 active; "기간은 UTC 기준" 표기). **[CSV 내보내기]** 버튼(현재 URL 필터로 export, 진행 중 disabled, 422/오류는 한국어 메시지로 표시하고 목록 유지, 성공 시 브라우저 다운로드). actor/target 이름/이메일이 **존재하는 사용자면 클릭 → 기존 `CompanyUserDrawer`**(audit list 미reload, 선택 userId state 유지; 삭제(`name&&email null`)·시스템·null은 클릭 불가; 타 Company/삭제 사용자는 drawer 자체 notfound UI). **새 URL query 없음**(preset은 from/to 파생, summary/export는 현재 필터 재사용).
- c9-9: 보안 감사 로그 UX 고도화(UI 전용 — API/DB/CSV 보안 정책 무변경).
  - **공용 순수 helper** `src/lib/company/security-audit-url.mjs`(+ `.d.ts`): 브라우저 의존성 없는 순수 함수라 React 화면과 node smoke 가 동일 로직을 공유(단일 진실원). `toggleEventTypePatch`/`buildActiveChips`/`exportButtonLabel`/`activePreset`/`presetPatch`. tsconfig 는 `.mjs` 를 타입체크하지 않고 `.d.ts` 로 타입을, Next 번들러가 런타임 `.mjs` 를 해석.
  - **통계 카드 클릭 → eventType 목록 필터 toggle**: 카드는 `button`(`aria-pressed`, Enter/Space, 0건도 클릭 가능). ALL 카드는 이미 ALL 이면 no-op(불필요 push 방지), 같은 유형 재클릭은 ALL 로 해제, 다른 유형은 교체 — 모두 `auditType`/`auditPage`만 변경(date/user/guard/sort/size·프리셋 유지). summary 는 eventType 독립이라 숫자 불변(정상).
  - **활성 필터 칩**: eventType/기간(범위·이후·이전)/사용자/Guard/정렬(oldest)/size(10·50)만 칩 표시(기본값 미표시). 각 칩 X(`aria-label`)는 **자기 key만 기본값 복귀 + page1**, 다른 필터 유지. user/guard 칩 제거 시 검색 draft 즉시 동기화. 칩 0개면 영역 숨김. 기존 [필터 초기화] 유지.
  - **CSV export UX**: 라벨에 현재 결과 수(`pagination.total`) 노출 — `CSV 내보내기 (N건)`/`(0건)`/`내보내는 중…`, 0건도 비활성화하지 않음(header-only 허용), `title`/`aria-label`로 "현재 필터 결과 N건" 안내 + "현재 필터 기준 전체 결과를 내보냅니다." 보조문구(하드코딩 limit 미표시 — 초과는 서버 422 메시지로 안내).
  - **링크 복사** 버튼(`navigator.clipboard` → 실패 시 textarea+`execCommand` fallback → 실패 시 "링크를 복사하지 못했습니다."): `window.location.href` 복사, 2초간 "복사됨" 표시, 새 toast 시스템 미도입. URL 에 metadata/token/userId 등 신규 데이터 미추가.
  - **로딩/접근성**: 필터 변경 시 기존 표를 비우지 않고 `aria-busy`+"갱신 중…"만 표시(최초 진입만 전체 로딩, 재조회 실패는 기존 결과 유지+보조 경고). drawer 열린 채 재조회/필터 변경돼도 `selectedUserId` 유지(강제 닫기 없음). 카드·칩X·복사·export 모두 `type="button"`, icon-only 액션은 `aria-label`.
  - URL key 는 기존 `audit*` 8종만 사용(신규 query 없음); 사용자 클릭은 `push`, server page clamp 자정만 `replace`. smoke 는 helper 9종을 결정적 단위 검증(now 주입).
- c10-1: 사용자 **soft delete / 계정 탈퇴**(Company 단위 비활성화와 전역 탈퇴를 분리).
  - **정책 분리**: Company `CompanyUserState` INACTIVE = "이 Company 접근 제한"(기존, CO 가 토글). 전역 **계정 탈퇴 = soft delete**(본인만, `User.deletedAt` 등). soft delete 는 **물리 삭제가 아니다** — `User` row 와 `UserRole`/`WorkspaceMember`/`CompanyUserState`/`Invitation`/`SecurityAuditEvent` 를 모두 보존하며 접근만 차단한다. 완전 삭제/익명화/법적 보존은 이번 범위 밖.
  - **schema/migration**(`add_user_soft_delete`): `User.deletedAt/deletedByUserId/deletionReason`(모두 nullable, `@@index([deletedAt])`), `email`/`name` 유지(익명화 안 함, unique 보존). `SecurityAuditEventType` 에 `USER_SOFT_DELETED`/`USER_RESTORED`(전역 lifecycle, `companyId=null`) 추가. enum ADD VALUE + nullable 컬럼이라 기존 데이터 보존.
  - **차단 지점**(`USER_ACCOUNT_DELETED`, 403): `requireActiveUser` 를 `requireCurrentUser`/`requireCompanyOwner`/`requireCurrentWorkspace` 에 적용. `login`(비밀번호 검증 통과 후에만 알림 — wrong-pw 는 기존 401 유지), `signup`(같은 email 탈퇴자 → 403, 새 계정 미생성), `/api/auth/me`(stale 세션 방어 403), `invitations/accept`(자동 생성/복구 없이 403, invitation PENDING 유지). `USER_INACTIVE` 와 구분되는 별도 계약.
  - `POST /api/account/withdraw`(본인 + CSRF + IP rate-limit): 확인 문구 정확히 `탈퇴합니다`(trim) 아니면 400 `ACCOUNT_WITHDRAWAL_CONFIRMATION_REQUIRED`. Serializable tx 로 `deletedAt=now`/`deletedByUserId=self`/`deletionReason=SELF_WITHDRAWAL` + **모든 세션 deleteMany**. `USER_SOFT_DELETED`(actor=target, `companyId=null`, guard `account.withdraw`)는 tx 성공 후 **best-effort**(실패해도 롤백 없음). 이미 탈퇴면 **idempotent**(덮어쓰기/중복 audit 없이 `{ ok: true }`). UserRole/WorkspaceMember/CompanyUserState/Invitation/Audit 미변경, 응답에 user/role/company/token 미포함.
  - **UI**: `/settings/account`(상단 계정 메뉴 → `UserCog`) 계정 탈퇴 danger 섹션 + `탈퇴합니다` 확인 모달(정확 일치 시에만 활성, 진행 중 중복 방지, 성공 시 로그아웃+`/login`). stale tab 에서 `USER_ACCOUNT_DELETED` 면 AppShell 이 `AccessRestricted` 대신 전용 **`AccountDeleted`** 화면(무한 redirect 없이 안내+로그인 이동).
  - **재가입/재초대**: 탈퇴 email 은 signup/accept 모두 차단(자동 복구 없음), email **unique 보존**(alias/tombstone 미사용). 복구는 MasterAdmin 경로(아래).
  - **Company 관리·감사 마스킹**: CO 가 탈퇴 사용자를 `deactivate`/`activate`/`roles/sync` 하면 **409 `USER_ACCOUNT_DELETED`**(전역 탈퇴 해제 불가). list/detail DTO 에 `accountDeleted` 추가, 목록/Drawer 에 "계정 탈퇴" 표시 + 상태/권한 action 비활성. 감사 화면·CSV 의 탈퇴 actor/target 은 **API DTO 단계에서 name/email 을 null 마스킹**하고 `withdrawn=true` → "탈퇴한 사용자"+짧은 userId(개인정보 미노출). 물리 삭제(row 없음)는 기존 "삭제된 사용자" fallback 유지. 전역 lifecycle event(`companyId=null`)는 c9-7 Company audit 범위에 **미노출**(범위 정책 불변).
  - **MasterAdmin 복구 기반**(c10-2 에서 노출): `restoreSoftDeletedUser(targetUserId, client?)` service helper 는 **상태 전이 전용**(조건부 update `deletedAt!=null` 으로 동시 복구 1회만 성공, `{restored, reason}` 반환). 세션 미조회/생성/삭제, Company state/role/member/Invitation 불변, **audit 는 helper 밖(route)에서 best-effort**. **권한 미검사 → 반드시 `requireMasterAdmin` 통과 후 호출.**
- c10-1.1: **마지막 ACTIVE CO 자기 탈퇴 차단**.
  - 사용자가 **하나라도** "마지막 ACTIVE CO" 인 Company 가 있으면 self withdrawal 을 **409 `USER_LAST_CO_WITHDRAWAL_FORBIDDEN`** 으로 차단(메시지: "현재 Company의 마지막 회사 관리자입니다. 다른 회사 관리자를 지정한 뒤 탈퇴할 수 있습니다." — 어떤 Company 인지/CO 목록은 응답에 미노출).
  - **공용 기준**(`company-user-state.ts`): `getActiveCompanyOwnerIds(client, companyId)`(COMPANY/CO Role − INACTIVE state; **레코드 없음=ACTIVE** legacy fallback) 로 c9-1 deactivate 와 c10-1.1 withdrawal 이 **동일 기준**을 쓰도록 일원화(deactivate 의 마지막-CO 판별을 이 helper 로 리팩터 — path/body/response/error code 불변). `getCompaniesWhereUserIsLastActiveCO(client, userId)` 는 사용자가 CO·ACTIVE 인 Company 들에 대해 **bulk(Company 별 N+1 없음)** 로 "본인이 유일한 ACTIVE CO" 인 Company 목록을 반환.
  - **트랜잭션 재검증**: 차단 판정과 soft-delete 를 c10-1 의 **같은 Serializable transaction** 안에서 수행(동시 deactivate/role 변경 경쟁에서도 관리자 공백 방지). 차단 시 throw → rollback 으로 `deletedAt`/세션/쿠키/`USER_SOFT_DELETED` audit **어떤 상태 변경도 없음**(로그인 유지). 차단 전용 audit event type 은 추가하지 않음.
  - edge: INACTIVE 다른 CO 는 ACTIVE 카운트 제외(여전히 차단) · 다른 Company 에 backup CO 가 있어도 한 Company 에서 마지막이면 차단 · **legacy(CompanyUserState 없음) 단독 CO 는 ACTIVE 로 간주해 차단**(c9-1 fallback 일관) · CO 가 아니거나 모든 CO Company 에 다른 ACTIVE CO 가 있으면 정상 탈퇴. UI 는 기존 c10-1 모달 오류 표시 그대로 사용(409 메시지 표시·모달/입력 유지·로그아웃/이동 미실행, 새 modal/toast 없음).
- c10-2: **MasterAdmin 탈퇴 계정 복구**(전역 운영 권한 + 복구 콘솔).
  - **권한 판정**(schema/migration 변경 없음): MasterAdmin 여부는 **DB `MasterAdmin` 테이블 기준**(하드코딩 email 비교 금지, Company CO/Workspace 와 분리). 세션은 User 기반이므로 `requireMasterAdmin` 은 세션 User 의 email 과 동일한 **활성 MasterAdmin 레코드**가 있으면 통과한다(seed 가 `master@testflow.local` User + 개인 Workspace 멤버십을 보장 → 일반 login 가능, demo Company 엔 미소속). 우선순위: 세션 없음 401 → soft-deleted 403 `USER_ACCOUNT_DELETED` → MasterAdmin 아님 403 `AUTH_FORBIDDEN`. CO 로는 우회 불가.
  - **auth payload**: `/api/auth/me` 에 additive `isMasterAdmin: boolean`(민감정보 없음, `mapAuthPayload`/`AuthMeResponse` 확장). 사이드바 "탈퇴 계정 관리" 메뉴는 이 flag 로만 노출(클라이언트 email 비교 안 함). login/signup payload 는 미전달(계약 불변).
  - `GET /api/admin/accounts/deleted`(MasterAdmin 전용): `User.deletedAt != null` 만, active 사용자 절대 미포함. q(name/email insensitive contains)·page·size(10/20/50)·sort(newest/oldest, `deletedAt`+`id` tie-break)·page overflow clamp·invalid fallback. **DTO allowlist = userId/name/email/deletedAt/deletedByUserId/deletionReason** 만(passwordHash/role/company/member/state/session/token/metadata 미노출, `deletedByUserId` 는 scalar — 이름 resolve 안 함). N+1 없음.
  - `POST /api/admin/accounts/[userId]/restore`(MasterAdmin 전용 + CSRF + IP rate-limit): 대상 없음 404 `USER_NOT_FOUND`, 이미 active 409 `USER_ACCOUNT_NOT_DELETED`("탈퇴 처리된 계정만 복구할 수 있습니다."). 트랜잭션 안에서 `restoreSoftDeletedUser(tx)` **조건부 전이** → 동시 복구는 **정확히 1건만 200**, 나머지 409. **Session 미생성**, UserRole/WorkspaceMember/CompanyUserState/Invitation 불변. `USER_RESTORED`(actor=MasterAdmin, `companyId=null`, guard `admin.account.restore`)는 **실제 전이 1회에만** tx 성공 후 best-effort. 복구해도 Company `INACTIVE` 였다면 그 회사 접근은 계속 `USER_INACTIVE`. 응답 `{ ok: true }`(name/role/company/session 미포함), 호출자 session/cookie 불변.
  - **UI** `/admin/accounts`(`isMasterAdmin` 사이드바 메뉴): 검색(`이름 또는 이메일`, Enter/버튼)·정렬·size·[필터 초기화], URL prefix `adminDeletedQ/adminDeletedPage/adminDeletedSize/adminDeletedSort`(기본값 생략·overflow replace·복원). 표(탈퇴 시각/사용자/탈퇴 사유[`본인 탈퇴`·`기타`]/실행자 ID 짧게/[복구]). 복구 `DialogShell`(권한 유지·세션 미복구·INACTIVE 유지 안내, 중복 클릭 방지, 성공 시 목록 재조회·해당 행 제거, 409 메시지 표시·목록 유지). 비-Master 직접 접근은 API 403 → forbidden UI(데이터 미표시), soft-deleted MasterAdmin 은 `AccountDeleted` 우선. 공용 필터 normalizer 는 `.mjs`(+`.d.ts`)로 route·UI·smoke 공유.
- c10-3: **MasterAdmin 전역 보안 감사 콘솔**(read-only — schema/migration·retention/throttle 변경 없음, c9 Company audit 계약 불변).
  - `GET /api/admin/security-audit`(MasterAdmin 전용, `requireMasterAdmin`): **SecurityAuditEvent 전체** 조회(Company audit 의 단일 Company scope 와 달리 범위 미고정). query `eventType`(ALL/5종)·**`scope`(ALL/COMPANY=companyId not null/GLOBAL=companyId null)**·`from/to`(UTC, c9 정규화 재사용)·`user`(actor/target name·email)·`guard`·`page/size`(10/20/50)·`sort`. **전역 lifecycle event(`companyId=null` USER_SOFT_DELETED/USER_RESTORED)도 조회 가능**. user 검색은 id bulk lookup 후 DB-level 필터, actor/target·companyId **dedupe 후 단일 bulk(N+1 없음)**.
  - **DTO**: `{ id, eventType, occurredAt, guardName, scope: COMPANY|GLOBAL, actor, target, company:{companyId,companyName}|null }`. soft-deleted actor/target 은 **name/email null 마스킹 + withdrawn=true**(c9/c10-1 동일), 물리 삭제는 `withdrawn=false`+name null, actor null=시스템. **metadata/throttleKey/expiresAt/tokenHash/passwordHash/session/role/state 절대 미반환**. `summary`(eventType 제외·scope/date/user/guard 적용, **5종 0 포함**, total=합계).
  - `GET /api/admin/security-audit/export`: list 와 동일 필터(page/size 무시). 기존 **10,000건 limit·422·UTF-8 BOM·RFC4180 escape·formula injection 방지** 재사용. CSV 13열(발생시각/이벤트 코드·이름/**범위**/**Company 이름·ID**/처리자 이름·이메일·ID/대상 이름·이메일·ID/발생 위치). GLOBAL=범위 GLOBAL·Company 빈칸, COMPANY=범위 COMPANY·이름/ID, 탈퇴="탈퇴한 사용자"·이메일 빈칸, 물리삭제="삭제된 사용자", actor null="시스템". metadata 미포함.
  - **공용 재사용**: `resolveMatchedUserIds`/`securityAuditOrderBy`/`loadAuditUserMap`/`auditUserRef`(c9 helper) + 신규 `admin-security-audit-query.ts`(`parseAdminAuditFilters`/`buildAdminAuditWhere`/`loadAuditCompanyMap`) + client-safe `admin-audit-constants.ts`(5종 라벨·scope 라벨·정규화). Company audit 라벨 맵·where 빌더는 **그대로 둠**(계약 불변).
  - **UI** `/admin/security-audit`(`isMasterAdmin` 사이드바 메뉴): 6 summary 카드(전체/비활성화/활성화/접근차단/계정탈퇴/계정복구, c9-9 toggle 동작) + scope segment(전체/Company/Global) + eventType select(5종) + 기간 프리셋(UTC) + 사용자·Guard 검색 + 필터 칩(scope 칩 포함, 칩별 제거) + [필터 초기화] + **CSV 내보내기 (N건)**·링크 복사 + 비깜빡임 refetch. 표(발생시각/이벤트/범위[전역·회사]/Company/처리자/대상/발생위치) — **read-only**(Drawer·복구 연결 없음). URL prefix `adminAudit{Type,Scope,From,To,User,Guard,Page,Size,Sort}`(기존 외 신규 key 없음). 순수 URL helper 는 `admin-security-audit-url.mjs`(+`.d.ts`)로 prefix-무관 helper(`exportButtonLabel/activePreset`)는 c9-9 것 재사용, route·UI·smoke 공유.
- c10-5: **MasterAdmin step-up 재인증**(민감 admin 기능에 일반 로그인 후 비밀번호 1회 재확인).
  - **schema/migration**(`add_session_admin_reauth`): `Session.adminReauthenticatedAt DateTime?`(nullable add, 기존 세션 보존). not null 이면 **`+15분` 동안만 elevation 유효**(고정 만료, 자동 연장 없음). 재인증은 **현재 Session 의 timestamp 만 갱신**(새 Session/cookie/token·다른 Session·UserRole/WorkspaceMember/CompanyUserState 불변, SecurityAuditEvent 미생성). logout/session 삭제 시 elevation 도 사라짐.
  - **helper** `src/lib/auth/admin-reauth.ts`: `ADMIN_REAUTH_TTL_MS`(15분)·`ADMIN_REAUTH_REQUIRED_CODE`·`_MESSAGE`, `isAdminReauthValid`/`getAdminReauthExpiresAt`/`refreshAdminReauthentication`. 권한 최종 판단은 서버 guard(클라이언트 타이머는 UX 보조).
  - **guard** `requireRecentMasterAdminAuth()`(guards.ts): `requireMasterAdmin` 과 1차 검증(세션 없음 401 → soft-deleted 403 `USER_ACCOUNT_DELETED` → 비-Master 403 `AUTH_FORBIDDEN`)을 `resolveMasterAdminSession`으로 공유하고, **그 뒤 elevation 없음/만료 → 403 `ADMIN_REAUTH_REQUIRED`**. **MasterAdmin 판정은 DB 단일 진실원 유지(email 하드코딩 아님)**. `requireMasterAdmin` 계약은 그대로(status/reauth/nav 용).
  - `GET /api/admin/reauth/status`(`requireMasterAdmin` 만): `{ elevated, expiresAt }`(표시용, passwordHash/sessionId/token 미반환). `POST /api/admin/reauth`(`requireMasterAdmin`+CSRF): body `{ password }` — **현재 로그인 User 의 passwordHash** 로 검증(MasterAdmin record passwordHash 사용 안 함). 비번 없음 400 `ADMIN_REAUTH_PASSWORD_REQUIRED`(trim 안 함), 불일치 401 `ADMIN_REAUTH_FAILED`, 성공 시 현재 Session timestamp=now + `{ ok, expiresAt }`. 실패는 **(IP+userId) rate-limit(10분 5회)**, 성공 시 reset. 정상 admin API 엔 별도 limit 미추가.
  - **보호 적용**: 4개 route(`/api/admin/accounts/deleted`, `/api/admin/accounts/[userId]/restore`, `/api/admin/security-audit`, `/api/admin/security-audit/export`)가 `requireMasterAdmin` → **`requireRecentMasterAdminAuth`** 로 교체. 입력/응답/필터/CSV/restore 계약 불변. 만료 시 restore 미실행(`USER_RESTORED` 미생성)·CSV 미생성·list 미반환. status/reauth endpoint 는 `requireMasterAdmin` 유지. 일반 Company route 엔 미적용.
  - **UI** `AdminReauthGate`(`/admin/accounts`·`/admin/security-audit` 래핑): 진입 시 `reauth/status` 확인 → **elevated 일 때만 children(admin view) 렌더**(gate 전엔 admin data fetch 안 함). 미인증이면 비밀번호 gate(`type=password`, `autoComplete=current-password`, Enter submit, 중복 방지, 만료 시각 표시는 UX 보조). 보호 API 가 `ADMIN_REAUTH_REQUIRED` 반환 시 view 가 context 콜백으로 **즉시 목록/감사 숨기고 gate 로 전환**(stale 미노출, URL filter state 유지). non-Master 403 → forbidden UI, soft-deleted 는 `AccountDeleted` 우선. **사이드바 노출 조건은 `isMasterAdmin` 그대로**(elevation 을 menu 조건으로 쓰지 않음).
- c10-6: **MasterAdmin 강제 계정 정지**(관리자 soft delete — schema/migration·SecurityAuditEvent enum 변경 없음).
  - **service helper** `forceSoftDeleteUser(targetUserId, actorUserId, tx)`(account.ts, 권한 미검사 → route 의 `requireRecentMasterAdminAuth` 전제): tx 안에서 **SELF → NOT_FOUND → NOT_ACTIVE → LAST_MASTER_ADMIN → LAST_ACTIVE_CO** 순으로 재검증 → 통과 시 **조건부 update(`deletedAt=null`)** 로 동시 요청 1회만 전이 + 같은 tx 에서 대상 Session deleteMany(실패 시 rollback). `deletedAt=now`/`deletedByUserId=actor`/`deletionReason=ADMIN_FORCED_DELETION`. UserRole/WorkspaceMember/CompanyUserState/Invitation/기존 audit **보존**. 복구는 c10-2 restore.
  - 보호: 마지막 ACTIVE CO 는 c10-1.1 `getCompaniesWhereUserIsLastActiveCO` 재사용(legacy 무상태=ACTIVE). 마지막 활성 MasterAdmin 은 `getActiveMasterAdminEmails`(MasterAdmin.isActive + User.deletedAt=null) 로 판정 — guard 가 actor 를 항상 활성 master 로 보장하므로 "유일 활성 master = actor" → **self 검사가 선행 차단**(현실 경로는 `ADMIN_CANNOT_FORCE_DELETE_SELF`), LAST_MASTER_ADMIN 분기는 defense-in-depth 로 유지.
  - `POST /api/admin/accounts/[userId]/force-delete`(`requireRecentMasterAdminAuth`+CSRF+rate-limit `admin:account-force-delete:actor` actor+IP 10분 10회): body `{ confirmation: "강제 정지합니다" }`(trim) 아니면 400 `ADMIN_FORCE_DELETE_CONFIRMATION_REQUIRED`. 차단 코드: 404 `USER_NOT_FOUND` / 409 `USER_ACCOUNT_NOT_ACTIVE`·`ADMIN_CANNOT_FORCE_DELETE_SELF`·`LAST_MASTER_ADMIN_FORCE_DELETE_FORBIDDEN`·`USER_LAST_CO_FORCE_DELETE_FORBIDDEN`. 성공 시 `USER_SOFT_DELETED`(actor=Master, companyId=null, guard `admin.account.force-delete`) tx 후 **실제 전이 1회만** best-effort, 응답 `{ ok: true }`(대상 정보 미포함). 강제 정지된 계정은 기존 `USER_ACCOUNT_DELETED` 로 login/signup/invitation 차단.
  - `GET /api/admin/accounts/active`(`requireRecentMasterAdminAuth`): `deletedAt=null` 만, 정렬 기준 **가입일(createdAt, newest=DESC)**, q/page/size(10/20/50)/overflow clamp/invalid fallback. DTO allowlist = `userId/name/email/createdAt/lastLoginAt` + UX hint `isMasterAdmin/isLastActiveCompanyOwner/forceDeleteAllowed/forceDeleteBlockedReason(SELF|LAST_MASTER_ADMIN|LAST_ACTIVE_CO|null)` — **role/company/state/session/passwordHash 미반환**. hint 는 **bulk**(`getActiveMasterAdminEmails` 1회 + `getLastActiveCompanyOwnerUserIds` 4쿼리, 페이지 N+1 없음); 실제 차단은 force-delete route 가 tx 재검증.
  - **UI** `/admin/accounts` 탭화(`AdminAccountsView`): **탈퇴 계정**(기존 c10-2 list/restore 그대로) / **활성 계정**(`AdminActiveAccountsView`). URL key `adminAccountTab`(active 만 기록), 활성 탭 filter prefix `adminActive{Q,Page,Size,Sort}`(탈퇴 탭 `adminDeleted*` 과 분리). 표(가입일/사용자/마지막 로그인/유형[MasterAdmin·마지막 CO badge]/[강제 정지]). `forceDeleteAllowed=false` 면 버튼 disabled + 사유 표기. 강제 정지 `DialogShell`(확인 문구 `강제 정지합니다` 정확 일치 시 활성, 세션 즉시 종료·권한 보존·MasterAdmin 복구 안내, 성공 시 목록 재조회·행 제거·URL 유지, 409 는 API 메시지 우선, `ADMIN_REAUTH_REQUIRED` → AdminReauthGate 전환·미실행). 두 탭 모두 gate 안에서 동작.
- c10-7: **MasterAdmin identity 를 email → User.id binding 으로 강화**(권한 판정의 단일 기준).
  - **schema/migration**(`add_master_admin_userid`): `MasterAdmin.userId String? @unique` + `user User? @relation(onDelete: Restrict)`(User 물리 삭제를 막아 binding 보존 — soft delete 는 row 미삭제라 영향 없음). **fail-closed backfill**: `User.email` 이 unique 이므로 email **1:1 매칭만** `userId` 채움, 매칭 User 없으면 `userId` NULL 유지(임의 연결 안 함). legacy `email`/`passwordHash`/`name` 은 보존하되 **인증 source of truth 아님**(권한 판정에 미사용). `reset-dev` 는 FK(Restrict) 때문에 `master_admins` 를 `users` 보다 먼저 비우도록 순서 조정.
  - **활성 MasterAdmin 정의**(`master-admin.ts`): `MasterAdmin.isActive=true` AND `userId != null` AND 연결 `User.deletedAt=null`. **userId null/unbound row 는 권한 미인정**, **email fallback 없음**. helper 를 userId 기반으로 전면 교체: `findActiveMasterAdminByUserId`/`isMasterAdminUserId`/`getActiveMasterAdminUserIds`(기존 `*ByEmail`/`*Emails` 제거). 재인증은 c10-5 정책대로 **현재 Session User 의 passwordHash** 로만 검증(MasterAdmin.passwordHash 미사용).
  - **적용**: `requireMasterAdmin`/`requireRecentMasterAdminAuth`(`findActiveMasterAdminByUserId(session.user.id)`), `/api/auth/me` `isMasterAdmin`(`isMasterAdminUserId`), c10-6 force-delete 마지막 master 보호 + active-list hint(`getActiveMasterAdminUserIds` → `has(userId)`). **응답 계약/우선순위(401→USER_ACCOUNT_DELETED→AUTH_FORBIDDEN→ADMIN_REAUTH_REQUIRED)·DTO·blockedReason·step-up·CSV 모두 불변.** User email 을 바꿔도 userId binding 이 살아있으면 admin 접근/reauth/`isMasterAdmin` 유지. soft delete 시 binding 이 있어도 `USER_ACCOUNT_DELETED` 우선. seed 는 master User 를 먼저 만들고 MasterAdmin 을 `userId` 로 bind.
- c10-8: **MasterAdmin 권한 위임·해제 관리**(c10-7 userId binding 위에서).
  - **enum migration**(`add_master_admin_audit_events`): `SecurityAuditEventType` + `MASTER_ADMIN_GRANTED`/`MASTER_ADMIN_REVOKED`(global, companyId=null). 기존 5종/데이터 보존. relation/다른 테이블 변경 없음.
  - **service** `master-admin-service.ts`(권한 미검사 → route 의 `requireRecentMasterAdminAuth` 전제): `grantMasterAdmin`/`revokeMasterAdmin`. 모든 변경은 `runMasterAdminChange`(Serializable + **pg advisory xact lock** `pg_advisory_xact_lock` + serialization retry)로 직렬화 → **동시 grant/revoke 로 활성 MasterAdmin 수가 0 이 되지 않음**(adapter isolation 적용 여부와 무관). grant: 활성 User 만, userId 기준 중복 방지(이미 active=ALREADY, inactive bound row=재활성화, 새 bind 시 email 충돌 unbound/legacy=fail-closed), legacy passwordHash/email/name 은 초기값만(인증 미사용), target role/state/invitation/session/elevation 불변. revoke: userId-bound active 만, self/마지막 active master/inactive/미bound 차단, 성공 시 `isActive=false` + **대상 모든 Session.adminReauthenticatedAt=null**(step-up 즉시 무효화, 세션 삭제 안 함).
  - API(모두 `requireRecentMasterAdminAuth`): `GET /api/admin/master-admins`(bound만, status/q/sort/page/size, DTO+revokeBlockedReason, `legacyUnboundCount`), `GET .../candidates`(q≥2, 최대 20, eligibility), `POST .../[userId]/grant`(+CSRF, 확인 `MasterAdmin 권한을 부여합니다`, 404 USER_NOT_FOUND/409 USER_ACCOUNT_NOT_ACTIVE·USER_ALREADY_MASTER_ADMIN·MASTER_ADMIN_LEGACY_BINDING_REQUIRED, 성공 `MASTER_ADMIN_GRANTED` audit), `POST .../[userId]/revoke`(확인 `MasterAdmin 권한을 해제합니다`, 404 MASTER_ADMIN_NOT_FOUND/409 MASTER_ADMIN_NOT_ACTIVE·ADMIN_CANNOT_REVOKE_SELF·LAST_MASTER_ADMIN_REVOKE_FORBIDDEN, 성공 `MASTER_ADMIN_REVOKED` audit). grant/revoke 공유 (actor+IP) rate-limit. audit 는 실제 전이 1회에만 best-effort(companyId=null, guard `admin.master-admin.grant`/`revoke`).
  - **c10-3 전역 감사 확장(7종)**: `admin-audit-constants`/`admin-security-audit-query`/`types`/list·export·view 가 새 2종 포함(label·filter·chip·CSV·summary 7키 0포함, total 합산). 카드는 기존 6개 유지(신규 카드 없음). GLOBAL scope 에서만 노출. **Company audit API/UI/CSV·summary(3키)는 불변.**
  - **UI** `/admin/master-admins`(`isMasterAdmin` 사이드바, `AdminReauthGate` 래핑): unbound 경고 배너(`legacyUnboundCount`>0, email/name 미노출), 목록(사용자/상태[ACTIVE·INACTIVE·ACCOUNT_DELETED]/등록·변경시각/[권한 해제] — self·마지막master·inactive·account-deleted disabled+사유), [권한 부여] 모달(후보 검색 ≥2글자, eligibility 별 선택 가능/불가 + 확인 문구), 해제 모달(확인 문구). 성공 시 목록 재조회, `ADMIN_REAUTH_REQUIRED`→gate 전환·미실행. URL prefix `adminMaster{Q,Status,Page,Size,Sort}`.
  - **last MasterAdmin 보호 메모**: 비동시 경로에서는 "유일 active master=actor"라 self-check 가 선행(혼자일 때 revoke=`ADMIN_CANNOT_REVOKE_SELF`). `LAST_MASTER_ADMIN_REVOKE_FORBIDDEN` 은 **동시 revoke** 에서 advisory lock 으로 직렬화된 뒤 마지막 1명이 남을 때 reachable(smoke 가 검증) — 활성 master 0 방지의 핵심.
- c10-9: **legacy(`userId=null`) MasterAdmin 수동 연결(bind)**(c10-7 fail-closed 레코드를 명시 선택된 활성 User 에 연결).
  - **enum migration**(`add_master_admin_legacy_bound_event`): `SecurityAuditEventType` + `MASTER_ADMIN_LEGACY_BOUND`(global, companyId=null). 기존 7종/데이터 보존. relation/다른 테이블 변경 없음.
  - **service** `bindLegacyMasterAdmin(masterAdminId, targetUserId, actorUserId, tx)`(권한 미검사 → route 의 `requireRecentMasterAdminAuth` 전제): c10-8 `runMasterAdminChange`(Serializable + **pg advisory xact lock** + retry)를 그대로 재사용. 잠금 안에서 legacy 재검증(없음=`LEGACY_NOT_FOUND`, `userId!=null`=`ALREADY_BOUND`) → target 검증(없음=`USER_NOT_FOUND`, soft-deleted=`USER_NOT_ACTIVE`, 이미 다른 master 에 bound=`USER_ALREADY_BOUND`) → **conditional `updateMany(where id=… AND userId IS NULL)`**(count 0=경쟁 패배 `ALREADY_BOUND`). **email/name fallback·자동 bind 없음**(target 은 명시 `targetUserId` 뿐), **bind 후 target role/state/session·admin 승격 일절 자동 수행 안 함**(`isActive`/legacy `email`/`name`/`passwordHash` 보존, 권한 인정은 기존 active 집계가 판정).
  - API(모두 `requireRecentMasterAdminAuth`): `GET /api/admin/master-admins/legacy-unbound`(`userId=null` 만, page/size/sort, DTO `masterAdminId/createdAt/updatedAt/isActive` — **raw email/name/passwordHash 미반환**), `GET .../legacy-unbound/[masterAdminId]/candidates?q=`(legacy 존재·미연결 검증 후 q≥2, 최대 20, **활성·미연결 User 만**[`deletedAt=null` + 어떤 master 에도 미bound], DTO `userId/name/email`, email 추론 없음), `POST .../legacy-unbound/[masterAdminId]/bind`(+CSRF + grant/revoke 공유 (actor+IP) rate-limit, body `{userId, confirmation}`, 확인 `기존 MasterAdmin 레코드를 연결합니다` 불일치 시 400 `MASTER_ADMIN_LEGACY_BIND_CONFIRMATION_REQUIRED`; 404 `MASTER_ADMIN_LEGACY_NOT_FOUND`/`USER_NOT_FOUND`, 409 `MASTER_ADMIN_ALREADY_BOUND`·`USER_ACCOUNT_NOT_ACTIVE`·`USER_ALREADY_BOUND_MASTER_ADMIN`; 성공 시 `MASTER_ADMIN_LEGACY_BOUND` audit, actor=master userId·target=선택 User.id·companyId=null·guard `admin.master-admin.bind-legacy`, 실제 전이 1회 best-effort).
  - **c10-3 전역 감사 확장(8종)**: `admin-audit-constants`/`types`/list·view·summary 가 `MASTER_ADMIN_LEGACY_BOUND` 포함(label `MasterAdmin 레코드 연결`·filter·chip·CSV·summary 8키 0포함, total 합산). 카드 신규 없음, GLOBAL scope 에서만 노출. **Company audit API/UI/CSV·summary(3키)는 불변.**
  - **UI** `/admin/master-admins` 경고 배너에 [기존 레코드 연결] 버튼 추가 → `LegacyRepairModal`(`DialogShell`): ①미연결 레코드 선택(**불투명 masterAdminId 앞 8자**·활성여부·등록일만, email/name 미노출, email-match 힌트 없음) ②활성 사용자 검색(≥2글자) ③확인 문구. 성공 시 목록 재조회, `ADMIN_REAUTH_REQUIRED`→gate 전환·미실행.
- seed: 기본 Company `testflow-demo` 1건과 MasterAdmin `master@testflow.local`(+ 같은 email 의 User·개인 `testflow-admin` Workspace 로 콘솔 login 가능, demo Company 미소속)을 생성하고, 기본 Workspace `testflow-qa`를 해당 Company에 연결(owner=`qa.lead@testflow.local`)합니다. 기존 seed 계정/프로젝트/테스트데이터는 그대로 유지됩니다.

## Local DB Reset

`npm run db:seed`는 기본 seed 데이터를 upsert로 복원합니다. 테스트 중 생성한 비-seed 데이터는 삭제하지 않습니다.

개발 DB를 seed 기준으로 완전히 초기화하려면 아래 명령을 사용합니다.

```bash
npm run db:reset:dev
```

이 명령은 다음 데이터를 모두 삭제한 뒤 `prisma/seed.ts`를 다시 실행합니다.

- Workspace, User, WorkspaceMember, Project
- Session, RateLimitBucket
- TestFolder, TestCase, TestStep
- TestRun, TestRunResult
- Defect, DefectLink
- AiTestCaseDraft

보호 정책:

- `NODE_ENV=production`에서는 실행되지 않습니다.
- `DATABASE_URL`의 host가 `localhost` 또는 `127.0.0.1`이 아니면 실행되지 않습니다.
- `DATABASE_URL`의 port가 개발 Docker DB 포트인 `5433`이 아니면 실행되지 않습니다.

운영 DB나 공유 DB에서는 이 명령을 실행하지 마세요.

## Local Auth Accounts

개발 seed는 아래 계정에 동일한 비밀번호를 설정합니다.

- `qa.lead@testflow.local` / `password123!`
- `backend@testflow.local` / `password123!`
- `frontend@testflow.local` / `password123!`
- `pm@testflow.local` / `password123!`

## Auth Smoke Tests

Run the auth/permission smoke test after resetting the development DB:

```bash
npm run db:reset:dev
npm run test:auth
```

`npm run test:smoke` is an alias for `npm run test:auth`.

The smoke test starts a local Next.js dev server on `127.0.0.1:3210` by default and checks:

- unauthenticated page redirect to `/login?next=...`
- unauthenticated protected API `401`
- Admin login and write permissions
- Member create/update permissions and delete denial
- Viewer read permission and write denial
- Dashboard/Report protected API access
- logout invalidation

To run against an already running server:

```bash
TESTFLOW_EXTERNAL_SERVER=1 TESTFLOW_BASE_URL=http://localhost:3000 npm run test:auth
```

## Auth Cleanup

Expired auth records can be cleaned without resetting the database:

```bash
npm run auth:cleanup -- --dry-run
npm run auth:cleanup
```

Cleanup scope is intentionally narrow:

- `Session` rows where `expiresAt < now`
- `RateLimitBucket` rows where `expiresAt < now`

The command is safe to run in production because it does not delete active sessions or active rate limit buckets. In production, run it from a scheduled job or cron after confirming `DATABASE_URL` points to the intended database.

## Security Audit Cleanup (c9-6)

Persistent security audit records have retention + throttle cleanup:

```bash
npm run audit:cleanup -- --dry-run   # report only, deletes nothing
npm run audit:cleanup                # delete old events + expired throttles
```

Cleanup scope:

- `SecurityAuditEvent` where `occurredAt < now - SECURITY_AUDIT_RETENTION_DAYS` (default **90** days)
- `SecurityAuditThrottle` where `expiresAt < now`

Env vars (invalid values fall back to defaults):

- `SECURITY_AUDIT_RETENTION_DAYS` — event retention in days (default `90`, must be an integer ≥ 1)
- `SECURITY_AUDIT_DENY_THROTTLE_SECONDS` — `INACTIVE_COMPANY_ACCESS_DENIED` throttle window (default `300`, ≥ 1)

Run this **once per day** from a cron / CI scheduler (no automatic cron is registered here). Deploy-environment scheduler wiring is out of scope.

## Before Production

The following items are not complete production hardening yet:

- CSRF token hardening beyond the current Origin/Referer guard
- Rate limiting for general write APIs beyond current auth, AI Draft, and CSV Import limits
- Scheduled auth cleanup job and session rotation policy
- Playwright UI E2E for permission buttons and browser flows
- Remaining `npm audit` moderate findings review
