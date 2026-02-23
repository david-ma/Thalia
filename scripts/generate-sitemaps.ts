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
 * We should also record the status code for each URL. Try to spot errors, and make a report for the user.
 * Perhaps another output should be "list of broken pages".
 * Note that status code might not be enough to determine if a page is broken, so in future we should also check the content of the page.
 * Let's output this to /tmp/sitemaps/broken-pages.txt for now.
 * 
 * I want to set up a system of workers, to do the crawling. And allow a delay between requests, so we don't hit rate limits or overload a server that we're crawling.
 *
 * Rate limiting (e.g. LiteSpeed 403 / 5‑min block):
 * - State is stored in sitemap-halt.csv: columns "url", "status" (200, 403, or null if discovered but not visited).
 * - On halt/finish we write the full state so the next run can resume without re-discovering: load CSV, skip status 200, queue status null and failures for visit.
 */


import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";
import { WorkerPool } from "./worker-pool.js";

const workerCount = 20;
const delayMs = 200;
/** Stop after this many consecutive failures (e.g. 403). Then wait ~5 min and re-run the script. */
const maxConsecutiveFailures = 5;
/** Optional: stop after this many total failures across all workers. */
const maxFailures = 20;

const outDir = process.env.SITEMAP_OUT || "/tmp/sitemaps";

// Default target URL is localhost:1337
const domain = process.argv[2] || "localhost:1337";
const baseUrl = domain === "localhost:1337" ? "http://localhost:1337" : `https://${domain}`;

/** Normalised key -> full URL (for CSV output). */
const urlByKey: Record<string, string> = {};
/** Normalised key -> status (200, 403, or null if not visited yet). */
const urlStatus: Record<string, number | null> = {};
/** Normalised key -> SitemapUrl. Full data for sitemap; stubs for loaded 200s. */
const crawledUrls: Record<string, SitemapUrl> = {};

function normaliseKey(loc: string): string {
  const u = new URL(loc, baseUrl);
  return u.origin + u.pathname;
}

function isSeen(key: string): boolean {
  return crawledUrls[key] !== undefined;
}

const HALT_CSV = "sitemap-halt.csv";

function parseCsvRow(line: string): { url: string; status: number | null } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('"')) {
    const end = trimmed.indexOf('",');
    if (end === -1) return null;
    const url = trimmed.slice(1, end).replace(/""/g, '"');
    const statusStr = trimmed.slice(end + 2).trim();
    const status = statusStr === "null" || statusStr === "" ? null : parseInt(statusStr, 10);
    return { url, status: Number.isNaN(status) ? null : status };
  }
  const comma = trimmed.indexOf(",");
  if (comma === -1) return null;
  const url = trimmed.slice(0, comma).trim();
  const statusStr = trimmed.slice(comma + 1).trim();
  const status = statusStr === "null" || statusStr === "" ? null : parseInt(statusStr, 10);
  return { url, status: Number.isNaN(status) ? null : status };
}

/** Load sitemap-halt.csv. Populate urlByKey, urlStatus, crawledUrls (stubs for 200). Return keys to queue (status !== 200). */
function loadSitemapHalt(): string[] {
  const file = path.join(outDir, HALT_CSV);
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const toQueue: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (i === 0 && lines[i].toLowerCase().startsWith("url")) continue;
    const row = parseCsvRow(lines[i]);
    if (!row || !row.url) continue;
    const key = normaliseKey(row.url);
    urlByKey[key] = row.url;
    urlStatus[key] = row.status;
    if (row.status === 200) {
      const stub = new SitemapUrl(row.url);
      stub.statusCode = 200;
      crawledUrls[key] = stub;
    } else {
      toQueue.push(key);
    }
  }
  return toQueue;
}

/** Write full state to sitemap-halt.csv so next run can resume without re-discovery. */
function writeSitemapHalt(): void {
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, HALT_CSV);
  const rows: string[] = ['url,status'];
  for (const key of Object.keys(urlByKey)) {
    const url = urlByKey[key];
    const status = urlStatus[key];
    const safe = url.replace(/"/g, '""');
    rows.push(`"${safe}",${status ?? "null"}`);
  }
  fs.writeFileSync(out, rows.join("\n") + "\n");
}

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
    this.loc = new URL(loc, baseUrl).href;
    this.links = [];
    this.url = new URL(this.loc, baseUrl);

    const seg = this.url.pathname.split("/")[1];
    this.category = seg ? seg.charAt(0).toUpperCase() + seg.slice(1) : "Home";
    // this.priority = 1.0;
  }

  isSameDomain(): boolean {
    // If we're on localhost, we're on the same domain
    if (this.url.hostname === "localhost") return true;
    return this.url.hostname === domain;
  }

  crawl(): Promise<SitemapUrl> {
    const startTime = Date.now();
    return fetch(this.loc, { redirect: "follow" })
      .then((response) => {
        this.statusCode = response.status;
        this.timeMs = Date.now() - startTime;
        if (!response.ok) return Promise.reject(new Error(String(response.status)));
        return response.text();
      })
      .then((html) => {
        const $ = cheerio.load(html);
        const hrefs = $("a").map((i, el) => $(el).attr("href")).get().filter(Boolean) as string[];
        this.links = hrefs.map((href) => new SitemapUrl(href));
        this.images = $("img").map((i, el) => $(el).attr("src")).get().filter(Boolean) as string[];
        this.timeMs = Date.now() - startTime;
        return this;
      });
  }
}

let pool: WorkerPool<void>;

function makeCrawlJob(entry: SitemapUrl): () => Promise<void> {
  return () =>
    entry
      .crawl()
      .then(() => {
        const key = normaliseKey(entry.loc);
        urlByKey[key] = entry.loc;
        urlStatus[key] = entry.statusCode ?? 200;
        crawledUrls[key] = entry;
        console.log(entry.loc, entry.statusCode, "Links:", entry.links.length);
        for (const link of entry.links) {
          if (!link.isSameDomain()) continue;
          const k = normaliseKey(link.loc);
          if (urlByKey[k] === undefined) {
            urlByKey[k] = link.loc;
            urlStatus[k] = null;
          }
          if (isSeen(k)) continue;
          crawledUrls[k] = link;
          pool.push(makeCrawlJob(link));
        }
      })
      .catch((e: Error) => {
        const key = normaliseKey(entry.loc);
        urlByKey[key] = entry.loc;
        urlStatus[key] = entry.statusCode ?? null;
        console.warn(entry.loc, entry.statusCode ?? e.message);
        return Promise.reject(e);
      });
}

function main(): void {
  fs.mkdirSync(outDir, { recursive: true });
  const toQueue = loadSitemapHalt();

  pool = new WorkerPool({
    workers: workerCount,
    delayMs,
    maxConsecutiveFailures,
    maxFailures,
  });

  function persistState(): void {
    writeSitemapXml(Object.values(crawledUrls));
    writeSitemapHalt();
    const known = Object.keys(urlByKey).length;
    const ok = Object.values(urlStatus).filter((s) => s === 200).length;
    console.log("Known URLs:", known, "| 200s:", ok, "| Output:", path.join(outDir, "sitemap.xml"), path.join(outDir, HALT_CSV));
  }

  pool.on("finished", persistState);
  pool.on("halted", () => {
    persistState();
    console.warn("Halted (rate limit?). Re-run in a few minutes to resume.");
  });

  let pushed = 0;
  const homeKey = normaliseKey(baseUrl);
  if (urlByKey[homeKey] === undefined) {
    urlByKey[homeKey] = baseUrl;
    urlStatus[homeKey] = null;
  }
  if (urlStatus[homeKey] !== 200) {
    const entry = new SitemapUrl(baseUrl);
    crawledUrls[homeKey] = entry;
    pool.push(makeCrawlJob(entry));
    pushed++;
  }

  for (const key of toQueue) {
    if (isSeen(key)) continue;
    const url = urlByKey[key];
    if (!url) continue;
    const entry = new SitemapUrl(url);
    crawledUrls[key] = entry;
    pool.push(makeCrawlJob(entry));
    pushed++;
  }

  if (pushed === 0) {
    pool.close();
    console.log("Nothing to crawl (all URLs in sitemap-halt.csv already have status 200 or were skipped).");
  }

  pool.run().then(() => {
    console.log("Done.");
  });
}

main();

function SitemapUrlToXmlMapping(url: SitemapUrl) {
  const loc = `<loc>${url.loc}</loc>`;
  const lastmod = url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : "";
  const changefreq = url.changefreq ? `<changefreq>${url.changefreq}</changefreq>` : "";
  const priority = url.priority ? `<priority>${url.priority}</priority>` : "";
  return `  <url>\n    ${[loc, lastmod, changefreq, priority].filter(Boolean).join("\n  ")}\n  </url>`;
}

function writeSitemapXml(urls: SitemapUrl[]) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.filter((u) => u.statusCode === 200).map((u) => SitemapUrlToXmlMapping(u)).join("\n")}\n</urlset>`;
  fs.writeFileSync(path.join(outDir, "sitemap.xml"), xml);
}
