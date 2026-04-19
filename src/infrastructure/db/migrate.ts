import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { getSqlClient } from "@/infrastructure/db/client";

export async function runMigrations() {
  const migrationsDir = path.join(process.cwd(), "db", "migrations");
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
  const sql = getSqlClient();

  for (const file of files) {
    const statement = await readFile(path.join(migrationsDir, file), "utf8");
    await sql.unsafe(statement);
  }

  return files;
}

export async function seedDatabase() {
  return [] as string[];
}

async function main() {
  const shouldSeed = process.argv.includes("--seed");
  const migrations = await runMigrations();
  const seeds = shouldSeed ? await seedDatabase() : [];

  console.info(
    JSON.stringify(
      {
        migrations,
        seeds
      },
      null,
      2
    )
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}