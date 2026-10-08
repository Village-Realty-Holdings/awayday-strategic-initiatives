import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// On Workers, a socket opened while serving one request cannot be used by
// another, so the client is scoped to the request: one PrismaClient per
// ExecutionContext, connecting through the HYPERDRIVE binding (Hyperdrive keeps
// the warm pool to Neon). The WeakMap lets the entry go with the request.
//
// Outside a Worker request (vitest, Node scripts) there is no Cloudflare
// context; fall back to DATABASE_URL with a process-wide client.
const perRequest = new WeakMap<object, PrismaClient>();
let nodeClient: PrismaClient | undefined;

function cloudflareContext() {
  try {
    return getCloudflareContext();
  } catch {
    return null;
  }
}

export function getPrisma(): PrismaClient {
  const cf = cloudflareContext();
  if (cf?.env.HYPERDRIVE) {
    let client = perRequest.get(cf.ctx);
    if (!client) {
      client = new PrismaClient({
        adapter: new PrismaPg({ connectionString: cf.env.HYPERDRIVE.connectionString, maxUses: 1 }),
      });
      perRequest.set(cf.ctx, client);
    }
    return client;
  }
  nodeClient ??= new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  return nodeClient;
}

// `prisma` keeps the platform's import-and-use call sites (and Better Auth's
// prismaAdapter, built once at module load) working unchanged: every property
// access resolves against the current request's client.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
