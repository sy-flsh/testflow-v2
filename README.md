# TestFlow v2

## Local DB Reset

`npm run db:seed`는 기본 seed 데이터를 upsert로 복원합니다. 테스트 중 생성한 비-seed 데이터는 삭제하지 않습니다.

개발 DB를 seed 기준으로 완전히 초기화하려면 아래 명령을 사용합니다.

```bash
npm run db:reset:dev
```

이 명령은 다음 데이터를 모두 삭제한 뒤 `prisma/seed.ts`를 다시 실행합니다.

- Workspace, User, WorkspaceMember, Project
- TestFolder, TestCase, TestStep
- TestRun, TestRunResult
- Defect, DefectLink
- AiTestCaseDraft

보호 정책:

- `NODE_ENV=production`에서는 실행되지 않습니다.
- `DATABASE_URL`의 host가 `localhost` 또는 `127.0.0.1`이 아니면 실행되지 않습니다.
- `DATABASE_URL`의 port가 개발 Docker DB 포트인 `5433`이 아니면 실행되지 않습니다.

운영 DB나 공유 DB에서는 이 명령을 실행하지 마세요.
