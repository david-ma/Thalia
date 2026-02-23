/**
 * Quick scan of categories from a sitemap. Reads sitemap.xml, groups URLs by
 * first path segment (e.g. /ball-bearing/... -> "ball-bearing"), and prints
 * counts so you can see the more important categories.
 *
 * Usage:
 *   bun scripts/get-categories.ts [--sitemap /path/to/sitemap.xml]
 *
 * Default: /tmp/sitemaps/sitemap.xml
 */

import fs from "fs";

const DEFAULT_SITEMAP = "/tmp/sitemaps/sitemap.xml";

function parseArgs(): { sitemapPath: string } {
  const args = process.argv.slice(2);
  let sitemapPath = DEFAULT_SITEMAP;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--sitemap" && args[i + 1]) {
      sitemapPath = args[++i];
    }
  }
  return { sitemapPath };
}

function extractLocs(xml: string): string[] {
  const locs: string[] = [];
  const re = /<loc>([^<]+)<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    locs.push(m[1].trim());
  }
  return locs;
}

/** First path segment: /company -> company, /ball-bearing/foo -> ball-bearing, / -> home */
function categoryFromLoc(loc: string): string {
  try {
    const u = new URL(loc);
    const segs = u.pathname.split("/").filter(Boolean);
    return segs[0] ?? "home";
  } catch {
    return "?";
  }
}

function main(): void {
  const { sitemapPath } = parseArgs();

  if (!fs.existsSync(sitemapPath)) {
    console.error("Sitemap not found:", sitemapPath);
    process.exit(1);
  }

  const xml = fs.readFileSync(sitemapPath, "utf8");
  const locs = extractLocs(xml);
  if (locs.length === 0) {
    console.log("No <loc> URLs in sitemap.");
    process.exit(0);
  }

  const byCategory: Record<string, string[]> = {};
  for (const loc of locs) {
    const cat = categoryFromLoc(loc);
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(loc);
  }

  const entries = Object.entries(byCategory)
    .map(([cat, urls]) => ({ cat, count: urls.length, urls }))
    .sort((a, b) => b.count - a.count);

  console.log("Sitemap:", sitemapPath, "|", locs.length, "URLs");
  console.log("");
  console.log("Categories (by count, most first):");
  console.log("");

  for (const { cat, count, urls } of entries) {
    const sample = urls.slice(0, 2).map((u) => {
      try {
        return new URL(u).pathname || u;
      } catch {
        return u;
      }
    });
    console.log(`  ${cat.padEnd(24)} ${String(count).padStart(5)}  e.g. ${sample.join(", ")}`);
  }
}

main();
