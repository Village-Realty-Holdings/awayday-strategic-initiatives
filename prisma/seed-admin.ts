import "dotenv/config";
import { randomBytes } from "node:crypto";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor, admin } from "better-auth/plugins";
import { PrismaClient } from "./generated/node/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Creates the first admin on an empty database. Runs locally under Node against
// the branch's DIRECT (non-pooler) Neon URL, not through the Worker.
//
//   DIRECT_URL=postgres://… ADMIN_EMAIL=you@awayday.com ADMIN_NAME="You" npm run db:seed:admin
//
// ADMIN_PASSWORD is optional; without it a strong temporary password is
// generated and printed once. MFA enrolment is forced on first sign-in.
const connectionString = process.env.DIRECT_URL;
if (!connectionString) throw new Error("Set DIRECT_URL to the Neon branch's direct connection string.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// Bootstrap instance: sign-up ENABLED (the app itself is invite-only).
const bootstrap = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, minPasswordLength: 12 },
  plugins: [twoFactor(), admin()],
});

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error("Set ADMIN_EMAIL.");
  const name = process.env.ADMIN_NAME?.trim() || email;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({ where: { email }, data: { role: "admin" } });
    console.log(`Admin already exists: ${email} (role ensured = admin). No password change.`);
    return;
  }
  const password = process.env.ADMIN_PASSWORD ?? randomBytes(12).toString("base64url");
  if (password.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  await bootstrap.api.signUpEmail({ body: { email, password, name } });
  await prisma.user.update({
    where: { email },
    data: { role: "admin", emailVerified: true, appAccess: ["initiatives"] },
  });
  console.log("\n=== Strategic Initiatives admin created ===");
  console.log(`  email:    ${email}`);
  if (!process.env.ADMIN_PASSWORD) console.log(`  password: ${password}`);
  console.log("  role:     admin");
  console.log("Sign in, set up MFA when prompted, then change this password.\n");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
