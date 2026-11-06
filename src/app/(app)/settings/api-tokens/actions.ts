"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { str } from "@/lib/form";
import { audit } from "@/lib/audit";
import { requireSession } from "@/lib/session";
import { generateToken, hashToken, MAX_ACTIVE_TOKENS, parseScope, tokenPrefix, TOKEN_EXPIRY_DAYS } from "@/lib/api-tokens";

export type CreateTokenState = { ok: true; token: string; name: string } | { ok: false; error: string } | null;

/**
 * Create an API token for the signed-in user. requireSession demands a
 * completed MFA sign-in, so a token is never minted on a password alone. The
 * plain token is returned once, to show; only its hash is stored.
 */
export async function createApiToken(_prev: CreateTokenState, fd: FormData): Promise<CreateTokenState> {
  const session = await requireSession();
  const name = str(fd, "name")?.slice(0, 80);
  if (!name) return { ok: false, error: "Give the token a name, such as the device or tool it is for." };
  const days = Number(str(fd, "expiresInDays"));
  if (!(TOKEN_EXPIRY_DAYS as readonly number[]).includes(days)) return { ok: false, error: "Choose when the token expires." };
  const scope = parseScope(str(fd, "scope"));
  const now = new Date();
  const active = await prisma.apiToken.count({ where: { userId: session.user.id, revokedAt: null, expiresAt: { gt: now } } });
  if (active >= MAX_ACTIVE_TOKENS) return { ok: false, error: `You already have ${MAX_ACTIVE_TOKENS} active tokens. Revoke one you no longer use first.` };

  const token = generateToken();
  const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const row = await prisma.apiToken.create({
    data: { userId: session.user.id, name, prefix: tokenPrefix(token), hash: await hashToken(token), scope, expiresAt },
    select: { id: true },
  });
  await audit(session.user.id, "CREATE", "ApiToken", row.id, { after: { name, scope, expiresAt: expiresAt.toISOString() } });
  revalidatePath("/settings/api-tokens");
  return { ok: true, token, name };
}

/** Revoke one of the signed-in user's own tokens. It stops working on its next request. */
export async function revokeApiToken(fd: FormData): Promise<void> {
  const session = await requireSession();
  const id = str(fd, "id") ?? "";
  const row = await prisma.apiToken.findFirst({ where: { id, userId: session.user.id, revokedAt: null }, select: { id: true, name: true } });
  if (!row) return;
  await prisma.apiToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
  await audit(session.user.id, "UPDATE", "ApiToken", row.id, { before: { name: row.name, revokedAt: null }, after: { revoked: true } });
  revalidatePath("/settings/api-tokens");
}
