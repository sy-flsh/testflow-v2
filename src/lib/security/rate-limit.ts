import { apiError } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";

type RateLimitInput = {
  scope: string;
  key: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: Date;
};

export async function checkRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + input.windowMs);
  const scope = normalizeBucketPart(input.scope);
  const key = normalizeBucketPart(input.key);
  const existingBucket = await prisma.rateLimitBucket.findUnique({
    where: {
      scope_key: {
        scope,
        key,
      },
    },
  });

  if (!existingBucket || existingBucket.expiresAt.getTime() <= now.getTime()) {
    const bucket = existingBucket
      ? await prisma.rateLimitBucket.update({
          where: { id: existingBucket.id },
          data: {
            count: 1,
            windowStart: now,
            expiresAt: resetAt,
          },
        })
      : await prisma.rateLimitBucket.create({
          data: {
            scope,
            key,
            count: 1,
            windowStart: now,
            expiresAt: resetAt,
          },
        });

    return toResult(bucket.count, input.limit, bucket.expiresAt);
  }

  const bucket = await prisma.rateLimitBucket.update({
    where: { id: existingBucket.id },
    data: { count: { increment: 1 } },
  });

  return toResult(bucket.count, input.limit, bucket.expiresAt);
}

export async function resetRateLimit(input: Pick<RateLimitInput, "scope" | "key">) {
  await prisma.rateLimitBucket
    .delete({
      where: {
        scope_key: {
          scope: normalizeBucketPart(input.scope),
          key: normalizeBucketPart(input.key),
        },
      },
    })
    .catch(() => undefined);
}

export function rateLimitErrorResponse(result: RateLimitResult) {
  const response = apiError("요청이 너무 많습니다. 잠시 후 다시 시도하세요.", 429, "RATE_LIMITED");

  response.headers.set("Retry-After", String(result.retryAfterSeconds));

  return response;
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    const [firstIp] = forwardedFor.split(",");
    const ip = firstIp?.trim();

    if (ip) {
      return ip;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();

  return realIp || "unknown";
}

export function normalizeRateLimitEmail(value: string) {
  return value.trim().toLowerCase();
}

function toResult(count: number, limit: number, resetAt: Date): RateLimitResult {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));

  return {
    allowed: count <= limit,
    count,
    limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds,
    resetAt,
  };
}

function normalizeBucketPart(value: string) {
  const normalized = value.trim().toLowerCase();

  return normalized ? normalized.slice(0, 240) : "unknown";
}
