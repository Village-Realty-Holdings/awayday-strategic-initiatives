import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export { clientIp } from "@/lib/client-ip";

type Result = { allowed: boolean; retryAfterSec: number };

// DB-backed fixed-window rate limiter on the Setting key/value table, so it works
// across serverless instances without a dedicated table.
//
// The increment runs inside a SERIALIZABLE transaction so concurrent requests
// cannot both read the same count and both write count+1 (which previously let
// parallel requests slip past the cap). On a write-conflict we retry a few times;
// if the environment can't run the transaction at all, we fall back to the prior
// best-effort read-then-write so the limiter degrades gracefully rather than
// hard-failing every call.
export async function rateLimit(key: string, max: number, windowMs: number): Promise<Result> {
  const k = `rl:${key}`;
  const now = Date.now();

  const step = (count: number, resetAt: number): Result => ({
    allowed: count <= max,
    retryAfterSec: Math.max(1, Math.ceil((resetAt - now) / 1000)),
  });

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const row = await tx.setting.findUnique({ where: { key: k } });
          let count = 0;
          let resetAt = now + windowMs;
          if (row) {
            try {
              const s = JSON.parse(row.value) as { count: number; resetAt: number };
              if (s.resetAt > now) { count = s.count; resetAt = s.resetAt; }
            } catch { /* malformed -> fresh window */ }
          }
          count += 1;
          await tx.setting.upsert({
            where: { key: k },
            update: { value: JSON.stringify({ count, resetAt }) },
            create: { key: k, value: JSON.stringify({ count, resetAt }) },
          });
          return step(count, resetAt);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch {
      // Serialization failure / write conflict / unsupported — retry, then fall
      // through to the best-effort path below.
    }
  }

  // Fallback: non-atomic best-effort (previous behavior). Keeps availability when
  // interactive/serializable transactions aren't supported by the connection.
  let count = 0;
  let resetAt = now + windowMs;
  const row = await prisma.setting.findUnique({ where: { key: k } });
  if (row) {
    try {
      const s = JSON.parse(row.value) as { count: number; resetAt: number };
      if (s.resetAt > now) { count = s.count; resetAt = s.resetAt; }
    } catch { /* malformed -> fresh window */ }
  }
  count += 1;
  await prisma.setting.upsert({
    where: { key: k },
    update: { value: JSON.stringify({ count, resetAt }) },
    create: { key: k, value: JSON.stringify({ count, resetAt }) },
  });
  return step(count, resetAt);
}

/**
 * The current count in a rateLimit bucket, without counting this call. For a
 * check that mustn't add to the bucket (the seller sign-in code's daily cap
 * counts failures only: it checks with this, then calls rateLimit on a
 * failure). Reads 0 for a missing, expired or malformed row.
 */
export async function rateLimitCount(key: string): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key: `rl:${key}` } });
  if (!row) return 0;
  try {
    const s = JSON.parse(row.value) as { count: number; resetAt: number };
    return s.resetAt > Date.now() && typeof s.count === "number" ? s.count : 0;
  } catch {
    return 0;
  }
}
