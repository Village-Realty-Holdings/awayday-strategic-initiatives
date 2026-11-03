import { backupName, isBackupName } from "@/lib/dev-testing";

// Backups and the remembered account, in a gitignored folder. Backups run inside
// the compose Postgres container, so they need nothing installed on the machine.
// Node modules load only when called: no deployment ever gets this far.

const DIR = ".dev-testing";

async function paths() {
  const { join } = await import("node:path");
  const root = join(process.cwd(), DIR);
  return { backups: join(root, "backups"), account: join(root, "account.json") };
}

function database(): { user: string; db: string } {
  const url = new URL(process.env.DATABASE_URL ?? "");
  return { user: decodeURIComponent(url.username), db: url.pathname.slice(1) };
}

async function dockerPostgres(args: string[]) {
  const { spawn } = await import("node:child_process");
  return spawn("docker", ["compose", "exec", "-T", "postgres", ...args], { cwd: process.cwd(), stdio: ["pipe", "pipe", "pipe"] });
}

function finished(child: Awaited<ReturnType<typeof dockerPostgres>>): Promise<void> {
  let stderr = "";
  child.stderr?.on("data", (d) => (stderr += String(d)));
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(stderr.trim().slice(-400) || `Exited with code ${code}`))));
  });
}

export async function createBackup(kind: "manual" | "auto"): Promise<string> {
  const [{ createWriteStream }, { mkdir, rm }, { pipeline }, { join }, { backups }] = await Promise.all([
    import("node:fs"),
    import("node:fs/promises"),
    import("node:stream/promises"),
    import("node:path"),
    paths(),
  ]);
  await mkdir(backups, { recursive: true });
  const name = backupName(kind);
  const file = join(backups, name);
  const { user, db } = database();
  const child = await dockerPostgres(["pg_dump", "-U", user, "-d", db, "--no-owner", "--no-privileges"]);
  child.stdin?.end();
  try {
    await Promise.all([pipeline(child.stdout!, createWriteStream(file)), finished(child)]);
  } catch (error) {
    await rm(file, { force: true });
    throw error;
  }
  return name;
}

export type BackupFile = { name: string; sizeLabel: string };

export async function listBackups(): Promise<BackupFile[]> {
  const [{ readdir, stat }, { join }, { backups }] = await Promise.all([import("node:fs/promises"), import("node:path"), paths()]);
  const names = await readdir(backups).catch(() => [] as string[]);
  const valid = names.filter(isBackupName).sort((a, b) => b.slice(-19).localeCompare(a.slice(-19)));
  return Promise.all(
    valid.map(async (name) => ({ name, sizeLabel: `${Math.max(1, Math.round((await stat(join(backups, name))).size / 1024))} KB` })),
  );
}

/** Replaces the whole database in one transaction, so a failed restore changes nothing. */
export async function restoreBackup(name: string): Promise<void> {
  if (!isBackupName(name)) throw new Error("Unknown backup.");
  const [{ createReadStream }, { pipeline }, { Readable }, { join }, { backups }] = await Promise.all([
    import("node:fs"),
    import("node:stream/promises"),
    import("node:stream"),
    import("node:path"),
    paths(),
  ]);
  const { user, db } = database();
  const child = await dockerPostgres(["psql", "-U", user, "-d", db, "-q", "-v", "ON_ERROR_STOP=1", "--single-transaction", "-f", "-"]);
  child.stdout?.resume();
  const script = Readable.from(
    (async function* () {
      yield "DROP SCHEMA public CASCADE;\nCREATE SCHEMA public;\n";
      yield* createReadStream(join(backups, name));
    })(),
  );
  await Promise.all([pipeline(script, child.stdin!), finished(child)]);
}

export type RememberedAccount = { id: string; name: string; role: string | null };

export async function readRememberedAccount(): Promise<RememberedAccount | null> {
  const [{ readFile }, { account }] = await Promise.all([import("node:fs/promises"), paths()]);
  return readFile(account, "utf8").then((text) => JSON.parse(text) as RememberedAccount, () => null);
}

/** Keeps the account as it was before the first change, so it can be put back. */
export async function rememberAccount(value: RememberedAccount): Promise<void> {
  const [{ mkdir, writeFile }, { dirname }, { account }] = await Promise.all([import("node:fs/promises"), import("node:path"), paths()]);
  if (await readRememberedAccount()) return;
  await mkdir(dirname(account), { recursive: true });
  await writeFile(account, JSON.stringify(value));
}

export async function forgetAccount(): Promise<void> {
  const [{ rm }, { account }] = await Promise.all([import("node:fs/promises"), paths()]);
  await rm(account, { force: true });
}
