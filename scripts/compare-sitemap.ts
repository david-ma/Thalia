/**
 * Compare a sitemap.xml to a website. For each <loc> in the sitemap, fetch the
 * same path on the target site and report which are missing (404) or broken.
 * Use before launch to ensure the new site has all pages from the old sitemap.
 *
 * Usage:
 *   bun scripts/compare-sitemap.ts [--sitemap /path/to/sitemap.xml] [--target http://localhost:1337]
 *
 * Defaults: sitemap = /tmp/sitemaps/sitemap.xml, target = http://localhost:1337
 */

import fs from "fs";
import path from "path";

const DEFAULT_SITEMAP = "/tmp/sitemaps/sitemap.xml";
const DEFAULT_TARGET = "http://localhost:1337";

function parseArgs(): { sitemapPath: string; targetBase: string } {
  const args = process.argv.slice(2);
  let sitemapPath = DEFAULT_SITEMAP;
  let targetBase = DEFAULT_TARGET;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--sitemap" && args[i + 1]) {
      sitemapPath = args[++i];
    } else if (args[i] === "--target" && args[i + 1]) {
      targetBase = args[++i].replace(/\/$/, "");
    }
  }
  return { sitemapPath, targetBase };
}

/** Extract all <loc> URLs from sitemap XML. */
function extractLocs(xml: string): string[] {
  const locs: string[] = [];
  const re = /<loc>([^<]+)<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    locs.push(m[1].trim());
  }
  return locs;
}

/** Pathname from URL (origin + pathname; no query/hash). */
function pathnameFromLoc(loc: string): string {
  try {
    const u = new URL(loc);
    return u.pathname || "/";
  } catch {
    return loc;
  }
}

interface Result {
  path: string;
  status: number;
  loc: string;
}

async function main(): Promise<void> {
  const { sitemapPath, targetBase } = parseArgs();

  if (!fs.existsSync(sitemapPath)) {
    console.error("Sitemap not found:", sitemapPath);
    process.exit(1);
  }

  const xml = fs.readFileSync(sitemapPath, "utf8");
  const locs = extractLocs(xml);
  if (locs.length === 0) {
    console.log("No <loc> URLs found in sitemap.");
    process.exit(0);
  }

  console.log("Sitemap:", sitemapPath, "|", locs.length, "URLs");
  console.log("Target:", targetBase);
  console.log("");

  const results: Result[] = [];
  for (const loc of locs) {
    const pathname = pathnameFromLoc(loc);
    const url = pathname === "/" ? targetBase + "/" : targetBase + pathname;
    try {
      const res = await fetch(url, { redirect: "follow" });
      results.push({ path: pathname, status: res.status, loc });
    } catch (e) {
      results.push({ path: pathname, status: 0, loc });
    }
  }

  const ok = results.filter((r) => r.status === 200);
  const missing = results.filter((r) => r.status === 404);
  const other = results.filter((r) => r.status !== 200 && r.status !== 404 && r.status !== 0);
  const failed = results.filter((r) => r.status === 0);

  console.log("Summary:");
  console.log("  OK (200):     ", ok.length);
  console.log("  Missing (404):", missing.length);
  if (other.length) console.log("  Other:       ", other.length);
  if (failed.length) console.log("  Fetch failed:", failed.length);
  console.log("");

  if (missing.length > 0) {
    console.log("Missing on target (add these routes or pages):");
    missing.forEach((r) => console.log("  ", r.path));
    console.log("");
  }

  if (other.length > 0) {
    console.log("Other status codes:");
    other.forEach((r) => console.log("  ", r.status, r.path));
    console.log("");
  }

  if (failed.length > 0) {
    console.log("Fetch failed (target unreachable?):");
    failed.forEach((r) => console.log("  ", r.path));
  }

  if (missing.length > 0 || other.length > 0 || failed.length > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
