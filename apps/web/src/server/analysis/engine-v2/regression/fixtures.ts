import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export type EngineV2FixturePage = {
  fileName: string;
  payload: Record<string, unknown>;
};

export function loadMoralisDecodedHistoryFixtures(directory = "docs/api-research/moralis") {
  const fixtureDir = resolve(process.cwd(), directory);
  if (!existsSync(fixtureDir)) return [] satisfies EngineV2FixturePage[];

  return readdirSync(fixtureDir)
    .filter((fileName) => /^address-transactions-decoded.*\.json$/.test(fileName))
    .sort()
    .map((fileName) => ({
      fileName,
      payload: JSON.parse(readFileSync(join(fixtureDir, fileName), "utf8")) as Record<string, unknown>,
    }));
}
