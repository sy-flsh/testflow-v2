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
- seed: 기본 Company `testflow-demo` 1건과 MasterAdmin `master@testflow.local` 1명을 생성하고, 기본 Workspace `testflow-qa`를 해당 Company에 연결(owner=`qa.lead@testflow.local`)합니다. 기존 seed 계정/프로젝트/테스트데이터는 그대로 유지됩니다.

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

## Before Production

The following items are not complete production hardening yet:

- CSRF token hardening beyond the current Origin/Referer guard
- Rate limiting for general write APIs beyond current auth, AI Draft, and CSV Import limits
- Scheduled auth cleanup job and session rotation policy
- Playwright UI E2E for permission buttons and browser flows
- Remaining `npm audit` moderate findings review
