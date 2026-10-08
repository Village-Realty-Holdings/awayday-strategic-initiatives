import "dotenv/config";
import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor, admin } from "better-auth/plugins";
import { PrismaClient } from "./generated/node/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Break-glass: reset a user's credential password with Better Auth's own hasher.
//   DIRECT_URL=postgres://… PW_EMAIL=you@awayday.com PW_NEW='…' npm run db:set-password
const connectionString = process.env.DIRECT_URL;
if (!connectionString) throw new Error("Set DIRECT_URL to the Neon branch's direct connection string.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, minPasswordLength: 12 },
  plugins: [twoFactor(), admin()],
});

async function main() {
  const email = process.env.PW_EMAIL?.trim().toLowerCase();
  const newPassword = process.env.PW_NEW;
  if (!email || !newPassword) throw new Error("Set PW_EMAIL and PW_NEW env vars.");
  if (newPassword.length < 12) throw new Error("PW_NEW must be at least 12 characters.");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No user with email ${email}`);

  const ctx = await auth.$context;
  const hash = await ctx.password.hash(newPassword);

  const acct = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
  });
  if (acct) {
    await prisma.account.update({ where: { id: acct.id }, data: { password: hash } });
  } else {
    await prisma.account.create({
      data: { id: randomUUID(), userId: user.id, accountId: user.id, providerId: "credential", password: hash },
    });
  }
  // Existing sessions keep working until expiry unless revoked.
  await prisma.session.deleteMany({ where: { userId: user.id } });
  console.log(`Password updated for ${email}; existing sessions revoked.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
