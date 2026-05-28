import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL 환경 변수가 필요합니다.");
}

assertSafeToReset(databaseUrl);

const adapter = new PrismaPg(databaseUrl);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.warn("[db:reset:dev] 개발 DB 데이터를 전체 삭제한 뒤 seed를 다시 실행합니다.");

  await prisma.$transaction([
    prisma.rateLimitBucket.deleteMany(),
    prisma.session.deleteMany(),
    prisma.aiTestCaseDraft.deleteMany(),
    prisma.defectLink.deleteMany(),
    prisma.defect.deleteMany(),
    prisma.testRunResult.deleteMany(),
    prisma.testRun.deleteMany(),
    prisma.testStep.deleteMany(),
    prisma.testCase.deleteMany(),
    prisma.testFolder.deleteMany(),
    prisma.project.deleteMany(),
    prisma.workspaceMember.deleteMany(),
    prisma.user.deleteMany(),
    prisma.workspace.deleteMany(),
  ]);

  await prisma.$disconnect();
  await import("./seed");
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});

function assertSafeToReset(url: string) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("NODE_ENV=production 환경에서는 db:reset:dev를 실행할 수 없습니다.");
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("DATABASE_URL을 URL로 파싱할 수 없습니다.");
  }

  const safeHosts = new Set(["localhost", "127.0.0.1"]);

  if (!safeHosts.has(parsedUrl.hostname)) {
    throw new Error("db:reset:dev는 localhost 또는 127.0.0.1 PostgreSQL에서만 실행할 수 있습니다.");
  }

  if (parsedUrl.port !== "5433") {
    throw new Error("db:reset:dev는 개발 Docker DB 포트 5433에서만 실행할 수 있습니다.");
  }
}
