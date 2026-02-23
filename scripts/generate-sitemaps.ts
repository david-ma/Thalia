/**
 * Generate sitemap.xml for a Thalia website (or any site).
 *
 * Default: crawl the homepage and recursively discover same-domain links, then
 * generate the sitemap from those URLs. Only public, same-origin links are
 * included (no admin/API unless linked from the site).
 *
 * Override: use --paths or --paths-file to supply an explicit list instead of crawling.
 *
 * Usage:
 *   bun scripts/generate-sitemaps.ts --base-url https://example.com --out public/
 *   bun scripts/generate-sitemaps.ts --base-url https://localhost:1337 --out public/
 *   bun scripts/generate-sitemaps.ts --base-url https://example.com --paths ",about,blog" --out public/
 *
 * --base-url   Required. Base URL of the site (no trailing slash). Crawl starts here.
 * --paths      Optional. Comma-separated paths; use leading comma for homepage. Disables crawl.
 * --paths-file Optional. File with one path per line. Disables crawl.
 * --out        Optional. Output path: file (e.g. public/sitemap.xml) or directory (writes sitemap.xml). If omitted, prints XML to stdout.
 * --max-urls   Optional. Max URLs to crawl (default 500). Ignored if --paths/--paths-file used.
 */

import fs from "fs/promises";
import path from "path";

const NS = "http://www.sitemaps.org/schemas/sitemap/0.9";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface SitemapEntry {
  path: string;
  lastmod?: string; // YYYY-MM-DD
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number; // 0.0–1.0
}

export interface GenerateSitemapOptions {
  baseUrl: string;
  entries: SitemapEntry[];
  lastmodDefault?: string; // YYYY-MM-DD, default today
}

/**
 * Generate sitemap XML string from base URL and entries.
 * Paths are relative to site root; empty string = homepage.
 */
export function generateSitemapXml(options: GenerateSitemapOptions): string {
  const { baseUrl, entries, lastmodDefault } = options;
  const base = baseUrl.replace(/\/$/, "");
  const today = new Date().toISOString().slice(0, 10);
  const lastmod = lastmodDefault ?? today;

  const urls = entries.map((e) => {
    const loc = e.path ? `${base}/${e.path}` : `${base}/`;
    const lm = e.lastmod ?? lastmod;
    const cf = e.changefreq ?? "weekly";
    const pri = e.priority ?? (e.path ? 0.8 : 1.0);
    return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lm}</lastmod>\n    <changefreq>${cf}</changefreq>\n    <priority>${pri.toFixed(1)}</priority>\n  </url>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="${NS}">\n${urls}\n</urlset>`;
}

/**
 * Convenience: generate from a simple list of path strings.
 */
export function generateSitemapXmlFromPaths(baseUrl: string, paths: string[]): string {
  const entries: SitemapEntry[] = paths.map((p) => ({ path: p }));
  return generateSitemapXml({ baseUrl, entries });
}

/** Extract same-origin path from an absolute URL (pathname, no query/fragment). Empty string = homepage. */
function urlToPath(url: URL, origin: string): string | null {
  if (url.origin !== origin) return null;
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const p = url.pathname === "/" ? "" : url.pathname.replace(/^\//, "");
  return p;
}

/** Get absolute same-origin URLs from HTML, normalized (pathname only). */
function getLinksFromHtml(html: string, currentUrl: string, origin: string): string[] {
  const paths: string[] = [];
  const hrefRe = /href\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = hrefRe.exec(html)) !== null) {
    const raw = m[1].trim();
    if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("javascript:")) continue;
    try {
      const resolved = new URL(raw, currentUrl);
      const pathStr = urlToPath(resolved, origin);
      if (pathStr !== null && !seen.has(pathStr)) {
        seen.add(pathStr);
        paths.push(pathStr);
      }
    } catch {
      // ignore invalid URLs
    }
  }
  return paths;
}

export interface CrawlOptions {
  baseUrl: string;
  maxUrls?: number;
  delayMs?: number;
}

/**
 * Crawl the site starting at baseUrl, following same-origin links only.
 * Returns list of paths (empty string = homepage), sorted for stable output.
 */
export async function crawlSite(options: CrawlOptions): Promise<string[]> {
  const { baseUrl, maxUrls = 500, delayMs = 100 } = options;
  const base = baseUrl.replace(/\/$/, "");
  const origin = new URL(base + "/").origin;

  const visited = new Set<string>();
  const queue: string[] = [""]; // start with homepage

  while (queue.length > 0 && visited.size < maxUrls) {
    const pathStr = queue.shift()!;
    if (visited.has(pathStr)) continue;
    visited.add(pathStr);

    const url = pathStr ? `${base}/${pathStr}` : `${base}/`;
    let html: string;
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) continue;
      html = await res.text();
    } catch (err) {
      console.warn("Skip (fetch failed):", url, (err as Error).message);
      continue;
    }

    const currentUrl = url.endsWith("/") ? url : url + "/";
    const links = getLinksFromHtml(html, currentUrl, origin);
    for (const p of links) {
      if (!visited.has(p)) queue.push(p);
    }

    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }

  return Array.from(visited).sort((a, b) => (a || "/").localeCompare(b || "/"));
}

async function parseArgs(): Promise<{
  baseUrl: string;
  paths: string[] | null;
  out: string | null;
  maxUrls: number;
}> {
  const args = process.argv.slice(2);
  let baseUrl = "";
  let paths: string[] | null = null;
  let pathsFile = "";
  let out = "";
  let maxUrls = 500;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--base-url" && args[i + 1]) {
      baseUrl = args[++i];
    } else if (args[i] === "--paths" && args[i + 1]) {
      const raw = args[++i];
      paths = raw.split(",").map((p) => p.trim());
      if (paths.length === 1 && paths[0] === '""') paths[0] = "";
    } else if (args[i] === "--paths-file" && args[i + 1]) {
      pathsFile = args[++i];
    } else if (args[i] === "--out" && args[i + 1]) {
      out = args[++i];
    } else if (args[i] === "--max-urls" && args[i + 1]) {
      maxUrls = Math.max(1, parseInt(args[++i], 10) || 500);
    }
  }

  if (!baseUrl) {
    console.error("Missing --base-url (e.g. https://example.com or https://localhost:1337)");
    process.exit(1);
  }

  if (pathsFile) {
    const content = await fs.readFile(pathsFile, "utf8").catch((err) => {
      console.error("Failed to read --paths-file:", err.message);
      process.exit(1);
    });
    paths = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== "#" && !line.startsWith("#"));
  }

  return { baseUrl, paths, out: out || null, maxUrls };
}

async function main() {
  const { baseUrl, paths, out, maxUrls } = await parseArgs();

  let pathList: string[];

  if (paths !== null && paths.length > 0) {
    pathList = paths;
  } else {
    console.warn("Crawling", baseUrl, "(max", maxUrls, "URLs)...");
    pathList = await crawlSite({ baseUrl, maxUrls });
    console.warn("Found", pathList.length, "URLs");
  }

  const xml = generateSitemapXmlFromPaths(baseUrl, pathList);

  if (out) {
    const outPath = out.endsWith(".xml") ? out : path.join(out, "sitemap.xml");
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, xml, "utf8");
    console.warn("Wrote", outPath);
  } else {
    process.stdout.write(xml);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
