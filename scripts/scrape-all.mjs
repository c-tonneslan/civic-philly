// Run every scraper in sequence. Used by the scheduled job (cron / GH Action).
//
//   node scripts/scrape-all.mjs

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const scripts = ["scrape-housing.mjs", "scrape-zoning.mjs", "scrape-infrastructure.mjs", "scrape-septa.mjs"];

function run(script) {
  return new Promise((resolve) => {
    const path = join(here, script);
    const proc = spawn(process.execPath, [path], { stdio: "inherit" });
    proc.on("exit", (code) => resolve(code ?? 0));
  });
}

let failures = 0;
for (const s of scripts) {
  console.log(`\n=== ${s} ===`);
  const code = await run(s);
  if (code !== 0) {
    console.error(`${s} failed with exit ${code}`);
    failures++;
  }
}

if (failures) {
  console.error(`\n${failures} scraper(s) failed.`);
  process.exit(1);
}
console.log("\nall scrapers finished successfully.");
