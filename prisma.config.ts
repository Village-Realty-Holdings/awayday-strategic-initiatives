import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // CLI only (migrate, seed scripts): the Neon *direct* (non-pooler) URL for the
    // branch being changed. The Worker never reads this; it connects through the
    // HYPERDRIVE binding (src/lib/prisma.ts). Read directly rather than via
    // prisma's env() helper so `prisma generate` works without it.
    url: process.env.DIRECT_URL ?? "",
  },
});
