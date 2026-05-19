// Run every scraper in sequence. Used by the scheduled job (cron / GH Action).
//
//   node scripts/scrape-all.mjs
//
// In CI without a DATABASE_URL secret configured the script exits 0 with a
// workflow notice instead of failing every scheduled run. Set
// SCRAPE_REQUIRE_DB=true to force a hard fail (useful for manual
// workflow_dispatch runs once the secret is in place, and for local dev).

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const scripts = ["scrape-housing.mjs", "scrape-zoning.mjs", "scrape-infrastructure.mjs", "scrape-septa.mjs"];

if (!process.env.DATABASE_URL) {
  const inCI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
  const required = process.env.SCRAPE_REQUIRE_DB === "true";
  if (inCI && !required) {
    const msg =
      "DATABASE_URL is not set. Configure the repository secret to enable the scheduled scrape (gh secret set DATABASE_URL --repo c-tonneslan/civic-philly).";
    console.log(`::notice title=civic-philly scrape skipped::${msg}`);
    process.exit(0);
  }
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

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
