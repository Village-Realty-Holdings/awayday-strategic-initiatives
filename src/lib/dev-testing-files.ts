// The account as it was before the dev testing tool changed it, in a gitignored
// file. Node modules load only when called: no deployment ever gets this far.

async function accountFile() {
  const { join } = await import("node:path");
  return join(process.cwd(), ".dev-testing", "account.json");
}

export type RememberedAccount = { id: string; name: string; role: string | null };

export async function readRememberedAccount(): Promise<RememberedAccount | null> {
  const [{ readFile }, file] = await Promise.all([import("node:fs/promises"), accountFile()]);
  return readFile(file, "utf8").then((text) => JSON.parse(text) as RememberedAccount, () => null);
}

/** Keeps the account as it was before the first change, so it can be put back. */
export async function rememberAccount(value: RememberedAccount): Promise<void> {
  const [{ mkdir, writeFile }, { dirname }, file] = await Promise.all([import("node:fs/promises"), import("node:path"), accountFile()]);
  if (await readRememberedAccount()) return;
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value));
}

export async function forgetAccount(): Promise<void> {
  const [{ rm }, file] = await Promise.all([import("node:fs/promises"), accountFile()]);
  await rm(file, { force: true });
}
