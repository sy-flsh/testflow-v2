#!/usr/bin/env node

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

/**
 * c9-6: SecurityAuditEvent retention + SecurityAuditThrottle 만료 정리.
 * - SecurityAuditEvent: occurredAt < (now - SECURITY_AUDIT_RETENTION_DAYS) 삭제(기본 90일).
 * - SecurityAuditThrottle: expiresAt < now 삭제.
 * - --dry-run/-n: 삭제하지 않고 대상 건수만 출력.
 * 운영: cron/CI scheduler 에서 하루 1회 `npm run audit:cleanup` 권장(자동 등록은 안 함).
 */

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

/** SECURITY_AUDIT_RETENTION_DAYS: 1 이상 정수만 허용, 잘못된 값은 90 fallback. */
function getRetentionDays() {
  const parsed = Number(process.env.SECURITY_AUDIT_RETENTION_DAYS);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 90;
}

const adapter = new PrismaPg(databaseUrl);
const prisma = new PrismaClient({ adapter });

async function main() {
  const retentionDays = getRetentionDays();
  const now = new Date();
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

  const eventWhere = { occurredAt: { lt: cutoff } };
  const throttleWhere = { expiresAt: { lt: now } };

  if (isDryRun) {
    const [eventCount, throttleCount] = await Promise.all([
      prisma.securityAuditEvent.count({ where: eventWhere }),
      prisma.securityAuditThrottle.count({ where: throttleWhere }),
    ]);

    console.log(
      `[audit:cleanup] dry-run (retentionDays=${retentionDays}, cutoff=${cutoff.toISOString()})`,
    );
    console.log(`  SecurityAuditEvent 삭제 대상: ${eventCount}건`);
    console.log(`  SecurityAuditThrottle 만료 대상: ${throttleCount}건`);
    return;
  }

  const [deletedEvents, deletedThrottles] = await Promise.all([
    prisma.securityAuditEvent.deleteMany({ where: eventWhere }),
    prisma.securityAuditThrottle.deleteMany({ where: throttleWhere }),
  ]);

  console.log(
    `[audit:cleanup] done (retentionDays=${retentionDays}, cutoff=${cutoff.toISOString()})`,
  );
  console.log(`  SecurityAuditEvent 삭제: ${deletedEvents.count}건`);
  console.log(`  SecurityAuditThrottle 삭제: ${deletedThrottles.count}건`);
}

main()
  .catch((error) => {
    console.error("[audit:cleanup] 실패:", error?.message ?? error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
