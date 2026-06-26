-- CreateEnum
CREATE TYPE "SecurityAuditEventType" AS ENUM ('COMPANY_USER_DEACTIVATED', 'COMPANY_USER_REACTIVATED', 'INACTIVE_COMPANY_ACCESS_DENIED');

-- CreateTable
CREATE TABLE "security_audit_events" (
    "id" TEXT NOT NULL,
    "eventType" "SecurityAuditEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT,
    "targetUserId" TEXT,
    "companyId" TEXT,
    "guardName" TEXT,
    "metadata" JSONB,

    CONSTRAINT "security_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_audit_throttles" (
    "id" TEXT NOT NULL,
    "throttleKey" TEXT NOT NULL,
    "eventType" "SecurityAuditEventType" NOT NULL,
    "targetUserId" TEXT,
    "companyId" TEXT,
    "lastEmittedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_audit_throttles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "security_audit_events_occurredAt_idx" ON "security_audit_events"("occurredAt");

-- CreateIndex
CREATE INDEX "security_audit_events_eventType_occurredAt_idx" ON "security_audit_events"("eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "security_audit_events_companyId_occurredAt_idx" ON "security_audit_events"("companyId", "occurredAt");

-- CreateIndex
CREATE INDEX "security_audit_events_targetUserId_occurredAt_idx" ON "security_audit_events"("targetUserId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "security_audit_throttles_throttleKey_key" ON "security_audit_throttles"("throttleKey");

-- CreateIndex
CREATE INDEX "security_audit_throttles_expiresAt_idx" ON "security_audit_throttles"("expiresAt");

-- CreateIndex
CREATE INDEX "security_audit_throttles_eventType_targetUserId_companyId_idx" ON "security_audit_throttles"("eventType", "targetUserId", "companyId");
