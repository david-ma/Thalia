/**
 * Sitemap-driven smoke test: load each <loc> on a target base URL, follow redirects
 * (log each 3xx at info), then check same-origin links and assets from HTML.
 *
 * Usage:
 *   bun scripts/smoke-sitemap.ts [--sitemap /path/to/sitemap.xml] [--target http://localhost:1337] [--json]
 *
 * Defaults: sitemap = /tmp/sitemaps/sitemap.xml, target = SMOKE_TARGET or http://localhost:1337
 *
 * CI: set SMOKE_TARGET (or SMOKE_BASE_URL) to the base URL when the server is up.
 */

import fs from "fs";
import {
  extractLocsFromSitemapXml,
  runSmoke,
} from "./smoke-sitemap-lib.js";

const DEFAULT_SITEMAP = "/tmp/sitemaps/sitemap.xml";

function parseArgs(): { sitemapPath: string; targetBase: string; json: boolean } {
  const args = process.argv.slice(2);
  let sitemapPath = DEFAULT_SITEMAP;
  let targetBase =
    process.env.SMOKE_TARGET?.replace(/\/$/, "") ||
    process.env.SMOKE_BASE_URL?.replace(/\/$/, "") ||
    "http://localhost:1337";
  let json = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--sitemap" && args[i + 1]) {
      sitemapPath = args[++i];
    } else if (args[i] === "--target" && args[i + 1]) {
      targetBase = args[++i].replace(/\/$/, "");
    } else if (args[i] === "--json") {
      json = true;
    }
  }
  return { sitemapPath, targetBase, json };
}

async function main(): Promise<void> {
  const { sitemapPath, targetBase, json } = parseArgs();

  if (!fs.existsSync(sitemapPath)) {
    console.error("Sitemap not found:", sitemapPath);
    process.exit(1);
  }

  const xml = fs.readFileSync(sitemapPath, "utf8");
  const locs = extractLocsFromSitemapXml(xml);
  if (locs.length === 0) {
    console.log("No <loc> URLs found in sitemap.");
    process.exit(0);
  }

  if (!json) {
    console.log("Sitemap:", sitemapPath, "|", locs.length, "URLs");
    console.log("Target:", targetBase);
    console.log("");
  }

  const infoLines: string[] = [];
  const logInfo = (line: string) => {
    const prefixed = `[info] ${line}`;
    infoLines.push(prefixed);
    if (!json) console.log(prefixed);
  };

  const result = await runSmoke({
    targetBase,
    locs,
    logInfo,
  });

  if (json) {
    console.log(
      JSON.stringify(
        {
          sitemapPath,
          targetBase,
          pageCount: result.pageCount,
          assetCount: result.assetCount,
          failureCount: result.failures.length,
          failures: result.failures,
          redirectLog: infoLines,
        },
        null,
        2,
      ),
    );
  } else {
    console.log("");
    console.log("Summary:");
    console.log("  Pages in sitemap:", result.pageCount);
    console.log("  Same-origin assets checked:", result.assetCount);
    console.log("  Failures:", result.failures.length);
    if (result.failures.length > 0) {
      console.log("");
      for (const f of result.failures) {
        console.log(`  [${f.kind}] ${f.url}`);
        console.log(`         ${f.reason}`);
        if (f.kind === "asset" && f.referencedFrom?.length) {
          console.log(`         referenced from:`);
          for (const ref of f.referencedFrom) {
            console.log(`           ${ref}`);
          }
        }
      }
    }
  }

  if (result.failures.length > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
