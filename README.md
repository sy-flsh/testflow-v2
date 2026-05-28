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

RBAC policy:

| Role | Read | Create | Update | Delete | Danger Zone |
| --- | --- | --- | --- | --- | --- |
| Admin | Yes | Yes | Yes | Yes | Yes |
| Member | Yes | Yes | Yes | No | No |
| Viewer | Yes | No | No | No | No |

The UI reflects the same permissions by hiding or disabling restricted actions, but API guards remain the source of enforcement.

## Local DB Reset

`npm run db:seed`는 기본 seed 데이터를 upsert로 복원합니다. 테스트 중 생성한 비-seed 데이터는 삭제하지 않습니다.

개발 DB를 seed 기준으로 완전히 초기화하려면 아래 명령을 사용합니다.

```bash
npm run db:reset:dev
```

이 명령은 다음 데이터를 모두 삭제한 뒤 `prisma/seed.ts`를 다시 실행합니다.

- Workspace, User, WorkspaceMember, Project
- Session
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

## Before Production

The following items are not complete production hardening yet:

- CSRF hardening for state-changing requests
- Rate limiting for auth and write APIs
- Session cleanup/rotation policy
- Playwright UI E2E for permission buttons and browser flows
- Remaining `npm audit` moderate findings review
