import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;
const args = new Set(process.argv.slice(2));
const isDryRun = args.has("--dry-run") || args.has("-n");

if (!databaseUrl) {
  throw new Error("DATABASE_URL 환경 변수가 필요합니다.");
}

for (const arg of args) {
  if (arg !== "--dry-run" && arg !== "-n") {
    throw new Error(`지원하지 않는 옵션입니다: ${arg}`);
  }
}

const adapter = new PrismaPg(databaseUrl);
const prisma = new PrismaClient({ adapter });

async function main() {
  const now = new Date();
  const whereExpired = { expiresAt: { lt: now } };

  if (isDryRun) {
    const [expiredSessionCount, expiredRateLimitBucketCount] = await Promise.all([
      prisma.session.count({ where: whereExpired }),
      prisma.rateLimitBucket.count({ where: whereExpired }),
    ]);

    printResult({
      dryRun: true,
      expiredSessionCount,
      expiredRateLimitBucketCount,
      deletedSessionCount: 0,
      deletedRateLimitBucketCount: 0,
    });

    return;
  }

  const [deletedSessions, deletedRateLimitBuckets] = await prisma.$transaction([
    prisma.session.deleteMany({ where: whereExpired }),
    prisma.rateLimitBucket.deleteMany({ where: whereExpired }),
  ]);

  printResult({
    dryRun: false,
    expiredSessionCount: deletedSessions.count,
    expiredRateLimitBucketCount: deletedRateLimitBuckets.count,
    deletedSessionCount: deletedSessions.count,
    deletedRateLimitBucketCount: deletedRateLimitBuckets.count,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

function printResult(result: {
  dryRun: boolean;
  expiredSessionCount: number;
  expiredRateLimitBucketCount: number;
  deletedSessionCount: number;
  deletedRateLimitBucketCount: number;
}) {
  console.log(
    JSON.stringify(
      {
        task: "auth:cleanup",
        dryRun: result.dryRun,
        expired: {
          sessions: result.expiredSessionCount,
          rateLimitBuckets: result.expiredRateLimitBucketCount,
        },
        deleted: {
          sessions: result.deletedSessionCount,
          rateLimitBuckets: result.deletedRateLimitBucketCount,
        },
      },
      null,
      2,
    ),
  );
}
