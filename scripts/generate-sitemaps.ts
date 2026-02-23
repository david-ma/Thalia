/**
 * Generate sitemap and siteindex for a website.
 * 
 * Websites should serve the index at <domain>/sitemaps/index.html which gets served as /sitemaps
 * 
 * Sitemaps can be served from <domain>/sitemaps/sitemap.xml
 * Or grouped by category, e.g.
 * <domain>/sitemaps/products/index.html which gets served as /sitemaps/products
 * 
 * 
 * This script will generate the sitemap and siteindex files.
 * Easy mode for dev:
 * The default --out path is /tmp/sitemaps
 * 
 * Future:
 * Given a Thalia project, we can output it directly to websites/<project>/public/sitemaps
 * 
 * Easy mode:
 * `bun scripts/generate-sitemaps.ts localhost:1337`
 * 
 * This will crawl based on the homepage, recursively discovering same-domain links.
 * It will output a very simple sitemap and siteindex file in the default output path.
 * 
 * Future:
 * Sitemaps generated using handlebars templates? Based on the sitemap config? So we can get blog info?
 * 
 * 
 * Given 
 * 
 * 
 * 
 * 
 * 
 */


import path from "path";
import * as cheerio from "cheerio";

const workers = 10;
const delayMs = 100;

// Default target URL is localhost:1337
const targetUrl = process.argv[2] || "localhost:1337";
const baseUrl = "http://localhost:1337";
const domains = ["universalbearings.com.au", "www.universalbearings.com.au", "universalbearings.david-ma.net"];

const crawledUrls : Record<string, SitemapUrl> = {}; // URL -> SitemapUrl
const newUrls: string[] = [targetUrl];

class SitemapUrl {
  loc: string;
  url: URL;
  statusCode?: number;
  timeMs?: number;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
  images?: string[];
  category?: string;
  links: SitemapUrl[];

  constructor(loc: string) {
    this.loc = loc;
    this.links = [];

    this.url = new URL(this.loc, baseUrl);

    // Category?
    // Get the first part of the path as the category
    this.category = this.url.pathname.split("/")[1];
    if (this.category) {
      this.category = this.category.charAt(0).toUpperCase() + this.category.slice(1);
    } else {
      this.category = "Home";
    }
    this.priority = 1.0;
  }

  isSameDomain(): boolean {
    const url = new URL(this.loc, baseUrl);
    return domains.includes(url.hostname);
  }

  isCrawled(): boolean {
    return crawledUrls[this.loc] !== undefined;
  }

  crawl() {
    const startTime = Date.now();
    return fetch(this.loc, { redirect: "follow" }).then((response) => {
      this.statusCode = response.status;
      this.timeMs = Date.now() - startTime;
      return response.text();
    }).then((html) => {
      const $ = cheerio.load(html);
      const hrefs = $("a").map((i, el) => $(el).attr("href")).get();
      this.links = hrefs.map((href) => new SitemapUrl(href));
      this.images = $("img").map((i, el) => $(el).attr("src")).get();
      this.timeMs = Date.now() - startTime;
      return this
    });
  }
}

function popUrlAndCrawl() {
  const url = newUrls.shift();
  if (!url) {
    return;
  }
  new SitemapUrl(url).crawl().then((sitemapUrl) => {
    console.log(sitemapUrl);

    for (const link of sitemapUrl.links) {
      if (link.isSameDomain() && !link.isCrawled()) {
        newUrls.push(link.loc);
      }
    }
  });
}


popUrlAndCrawl()

// Timeout
setTimeout(() => {
while (newUrls.length > 0) {
    popUrlAndCrawl();
  }
}, 1000);








// import fs from "fs/promises";
// import path from "path";

// const NS = "http://www.sitemaps.org/schemas/sitemap/0.9";

// function escapeXml(s: string): string {
//   return s
//     .replace(/&/g, "&amp;")
//     .replace(/</g, "&lt;")
//     .replace(/>/g, "&gt;")
//     .replace(/"/g, "&quot;")
//     .replace(/'/g, "&apos;");
// }

// export interface SitemapEntry {
//   path: string;
//   lastmod?: string; // YYYY-MM-DD
//   changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
//   priority?: number; // 0.0–1.0
// }

// export interface GenerateSitemapOptions {
//   baseUrl: string;
//   entries: SitemapEntry[];
//   lastmodDefault?: string; // YYYY-MM-DD, default today
// }

// /**
//  * Generate sitemap XML string from base URL and entries.
//  * Paths are relative to site root; empty string = homepage.
//  */
// export function generateSitemapXml(options: GenerateSitemapOptions): string {
//   const { baseUrl, entries, lastmodDefault } = options;
//   const base = baseUrl.replace(/\/$/, "");
//   const today = new Date().toISOString().slice(0, 10);
//   const lastmod = lastmodDefault ?? today;

//   const urls = entries.map((e) => {
//     const loc = e.path ? `${base}/${e.path}` : `${base}/`;
//     const lm = e.lastmod ?? lastmod;
//     const cf = e.changefreq ?? "weekly";
//     const pri = e.priority ?? (e.path ? 0.8 : 1.0);
//     return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lm}</lastmod>\n    <changefreq>${cf}</changefreq>\n    <priority>${pri.toFixed(1)}</priority>\n  </url>`;
//   }).join("\n");

//   return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="${NS}">\n${urls}\n</urlset>`;
// }

// /**
//  * Convenience: generate from a simple list of path strings.
//  */
// export function generateSitemapXmlFromPaths(baseUrl: string, paths: string[]): string {
//   const entries: SitemapEntry[] = paths.map((p) => ({ path: p }));
//   return generateSitemapXml({ baseUrl, entries });
// }

// /** Extract same-origin path from an absolute URL (pathname, no query/fragment). Empty string = homepage. */
// function urlToPath(url: URL, origin: string): string | null {
//   if (url.origin !== origin) return null;
//   if (url.protocol !== "http:" && url.protocol !== "https:") return null;
//   const p = url.pathname === "/" ? "" : url.pathname.replace(/^\//, "");
//   return p;
// }

// /** Get absolute same-origin URLs from HTML, normalized (pathname only). */
// function getLinksFromHtml(html: string, currentUrl: string, origin: string): string[] {
//   const paths: string[] = [];
//   const hrefRe = /href\s*=\s*["']([^"']+)["']/gi;
//   let m: RegExpExecArray | null;
//   const seen = new Set<string>();
//   while ((m = hrefRe.exec(html)) !== null) {
//     const raw = m[1].trim();
//     if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("javascript:")) continue;
//     try {
//       const resolved = new URL(raw, currentUrl);
//       const pathStr = urlToPath(resolved, origin);
//       if (pathStr !== null && !seen.has(pathStr)) {
//         seen.add(pathStr);
//         paths.push(pathStr);
//       }
//     } catch {
//       // ignore invalid URLs
//     }
//   }
//   return paths;
// }

// export interface CrawlOptions {
//   baseUrl: string;
//   maxUrls?: number;
//   delayMs?: number;
// }

// /**
//  * Crawl the site starting at baseUrl, following same-origin links only.
//  * Returns list of paths (empty string = homepage), sorted for stable output.
//  */
// export async function crawlSite(options: CrawlOptions): Promise<string[]> {
//   const { baseUrl, maxUrls = 500, delayMs = 100 } = options;
//   const base = baseUrl.replace(/\/$/, "");
//   const origin = new URL(base + "/").origin;

//   const visited = new Set<string>();
//   const queue: string[] = [""]; // start with homepage

//   while (queue.length > 0 && visited.size < maxUrls) {
//     const pathStr = queue.shift()!;
//     if (visited.has(pathStr)) continue;
//     visited.add(pathStr);

//     const url = pathStr ? `${base}/${pathStr}` : `${base}/`;
//     let html: string;
//     try {
//       const res = await fetch(url, { redirect: "follow" });
//       if (!res.ok) continue;
//       html = await res.text();
//     } catch (err) {
//       console.warn("Skip (fetch failed):", url, (err as Error).message);
//       continue;
//     }

//     const currentUrl = url.endsWith("/") ? url : url + "/";
//     const links = getLinksFromHtml(html, currentUrl, origin);
//     for (const p of links) {
//       if (!visited.has(p)) queue.push(p);
//     }

//     if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
//   }

//   return Array.from(visited).sort((a, b) => (a || "/").localeCompare(b || "/"));
// }

// async function parseArgs(): Promise<{
//   baseUrl: string;
//   paths: string[] | null;
//   out: string | null;
//   maxUrls: number;
// }> {
//   const args = process.argv.slice(2);
//   let baseUrl = "";
//   let paths: string[] | null = null;
//   let pathsFile = "";
//   let out = "";
//   let maxUrls = 500;

//   for (let i = 0; i < args.length; i++) {
//     if (args[i] === "--base-url" && args[i + 1]) {
//       baseUrl = args[++i];
//     } else if (args[i] === "--paths" && args[i + 1]) {
//       const raw = args[++i];
//       paths = raw.split(",").map((p) => p.trim());
//       if (paths.length === 1 && paths[0] === '""') paths[0] = "";
//     } else if (args[i] === "--paths-file" && args[i + 1]) {
//       pathsFile = args[++i];
//     } else if (args[i] === "--out" && args[i + 1]) {
//       out = args[++i];
//     } else if (args[i] === "--max-urls" && args[i + 1]) {
//       maxUrls = Math.max(1, parseInt(args[++i], 10) || 500);
//     }
//   }

//   if (!baseUrl) {
//     console.error("Missing --base-url (e.g. https://example.com or https://localhost:1337)");
//     process.exit(1);
//   }

//   if (pathsFile) {
//     const content = await fs.readFile(pathsFile, "utf8").catch((err) => {
//       console.error("Failed to read --paths-file:", err.message);
//       process.exit(1);
//     });
//     paths = content
//       .split(/\r?\n/)
//       .map((line) => line.trim())
//       .filter((line) => line !== "#" && !line.startsWith("#"));
//   }

//   return { baseUrl, paths, out: out || null, maxUrls };
// }

// async function main() {
//   const { baseUrl, paths, out, maxUrls } = await parseArgs();

//   let pathList: string[];

//   if (paths !== null && paths.length > 0) {
//     pathList = paths;
//   } else {
//     console.warn("Crawling", baseUrl, "(max", maxUrls, "URLs)...");
//     pathList = await crawlSite({ baseUrl, maxUrls });
//     console.warn("Found", pathList.length, "URLs");
//   }

//   const xml = generateSitemapXmlFromPaths(baseUrl, pathList);

//   if (out) {
//     const outPath = out.endsWith(".xml") ? out : path.join(out, "sitemap.xml");
//     await fs.mkdir(path.dirname(outPath), { recursive: true });
//     await fs.writeFile(outPath, xml, "utf8");
//     console.warn("Wrote", outPath);
//   } else {
//     process.stdout.write(xml);
//   }
// }

// main().catch((err) => {
//   console.error(err);
//   process.exit(1);
// });
