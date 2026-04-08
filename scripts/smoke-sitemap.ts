/**
 * Sitemap-driven smoke test: load each <loc> on a target base URL, follow redirects
 * (log each 3xx at info), then check same-origin links and assets from HTML.
 *
 * Usage:
 *   bun scripts/smoke-sitemap.ts [--sitemap /path/to/sitemap.xml] [--target http://localhost:1337] [--json]
 *
 * Defaults: sitemap = /tmp/sitemaps/sitemap.xml, target = SMOKE_TARGET or http://localhost:1337
 *
 * When `--sitemap` is under `.../websites/<project>/public/sitemap.xml`, a plain-text copy of the
 * human-readable report is also written to `websites/<project>/tmp/sitemap-report.txt` (UTF-8).
 * This is an ad hoc Thalia convention, not a standard format (not JUnit/SARIF/etc.).
 *
 * CI: set SMOKE_TARGET (or SMOKE_BASE_URL) to the base URL when the server is up.
 */

import fs from "fs";
import path from "path";
import type { SmokeResult } from "./smoke-sitemap-lib.js";
import {
  defaultReportTxtPathForSitemap,
  extractLocsFromSitemapXml,
  runSmoke,
} from "./smoke-sitemap-lib.js";

function formatHumanReport(
  sitemapPath: string,
  targetBase: string,
  locCount: number,
  infoLines: string[],
  result: SmokeResult,
): string {
  const lines: string[] = [];
  lines.push(`Sitemap: ${sitemapPath} | ${locCount} URLs`);
  lines.push(`Target: ${targetBase}`);
  lines.push("");
  lines.push(...infoLines);
  lines.push("");
  lines.push("Summary:");
  lines.push(`  Pages in sitemap: ${result.pageCount}`);
  lines.push(`  Same-origin assets checked: ${result.assetCount}`);
  lines.push(`  Failures: ${result.failures.length}`);
  if (result.failures.length > 0) {
    lines.push("");
    for (const f of result.failures) {
      lines.push(`  [${f.kind}] ${f.url}`);
      lines.push(`         ${f.reason}`);
      if (f.kind === "asset" && f.referencedFrom?.length) {
        lines.push(`         referenced from:`);
        for (const ref of f.referencedFrom) {
          lines.push(`           ${ref}`);
        }
      }
    }
  }
  return lines.join("\n");
}

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

  const humanText = formatHumanReport(sitemapPath, targetBase, locs.length, infoLines, result);
  const reportFile = defaultReportTxtPathForSitemap(sitemapPath);
  if (reportFile) {
    fs.mkdirSync(path.dirname(reportFile), { recursive: true });
    fs.writeFileSync(reportFile, humanText + "\n", "utf8");
    if (!json) {
      console.log("");
      console.log("Report file:", reportFile);
    }
  }

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
          reportTxtPath: reportFile ?? null,
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
