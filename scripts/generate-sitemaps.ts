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
 * - Worker pool stops after maxConsecutiveFailures or maxFailures. Failed URLs are appended to error-report.txt.
 * - On success, each URL is appended to crawled-urls.txt so we can resume.
 * - Restart after the block window (e.g. 5 min): run the same command again. The script loads crawled-urls.txt (skips those) and error-report.txt (retries those URLs). No need to clear files; re-runs continue from where you left off.
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

/** Normalised URL key (origin + pathname) -> SitemapUrl. Full data for URLs crawled this run. */
const crawledUrls: Record<string, SitemapUrl> = {};
/** URLs we already have (from crawled-urls.txt or crawled this run). Skip re-crawl. */
const seenKeys = new Set<string>();

function normaliseKey(loc: string): string {
  const u = new URL(loc, baseUrl);
  return u.origin + u.pathname;
}

function isSeen(key: string): boolean {
  return seenKeys.has(key) || crawledUrls[key] !== undefined;
}

function loadCrawledUrls(): void {
  const file = path.join(outDir, "crawled-urls.txt");
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const key = normaliseKey(line);
    seenKeys.add(key);
    if (!crawledUrls[key]) {
      const stub = new SitemapUrl(line);
      stub.statusCode = 200;
      crawledUrls[key] = stub;
    }
  }
}

/** Returns list of URLs to retry (from error-report.txt). */
function loadErrorReport(): string[] {
  const file = path.join(outDir, "error-report.txt");
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const urls: string[] = [];
  for (const line of lines) {
    const first = line.split(/\s+/)[0];
    if (first && first.startsWith("http")) urls.push(first);
  }
  return urls;
}

function appendCrawledUrl(url: string): void {
  fs.mkdirSync(outDir, { recursive: true });
  fs.appendFileSync(path.join(outDir, "crawled-urls.txt"), url + "\n");
}

function appendErrorReport(url: string, statusCode: number): void {
  fs.mkdirSync(outDir, { recursive: true });
  fs.appendFileSync(path.join(outDir, "error-report.txt"), `${url} ${statusCode}\n`);
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

let pool: WorkerPool;

function makeCrawlJob(entry: SitemapUrl): () => Promise<void> {
  return () =>
    entry
      .crawl()
      .then(() => {
        const key = normaliseKey(entry.loc);
        seenKeys.add(key);
        crawledUrls[key] = entry;
        appendCrawledUrl(entry.loc);
        console.log(entry.loc, entry.statusCode, "Links:", entry.links.length);
        for (const link of entry.links) {
          if (!link.isSameDomain()) continue;
          const k = normaliseKey(link.loc);
          if (isSeen(k)) continue;
          crawledUrls[k] = link;
          pool.push(makeCrawlJob(link));
        }
      })
      .catch((e: Error) => {
        const code = entry.statusCode ?? e.message;
        appendErrorReport(entry.loc, Number(code) || 0);
        console.warn(entry.loc, code);
        return Promise.reject(e);
      });
}

function main(): void {
  fs.mkdirSync(outDir, { recursive: true });
  loadCrawledUrls();
  const retryUrls = loadErrorReport();

  pool = new WorkerPool({
    workers: workerCount,
    delayMs,
    maxConsecutiveFailures,
    maxFailures,
  });

  pool.on("finished", () => {
    writeSitemapXml(Object.values(crawledUrls));
    console.log("Stopped. Crawled", Object.keys(crawledUrls).length, "URLs this run. Seen (incl. previous runs):", seenKeys.size);
  });

  let pushed = 0;
  const entry = new SitemapUrl(baseUrl);
  const key = normaliseKey(entry.loc);
  if (!isSeen(key)) {
    crawledUrls[key] = entry;
    pool.push(makeCrawlJob(entry));
    pushed++;
  }

  for (const url of retryUrls) {
    const k = normaliseKey(url);
    if (isSeen(k)) continue;
    const retryEntry = new SitemapUrl(url);
    crawledUrls[k] = retryEntry;
    pool.push(makeCrawlJob(retryEntry));
    pushed++;
  }

  if (pushed === 0) {
    pool.close();
    console.log("Nothing to crawl (all URLs already in crawled-urls.txt).");
  }

  pool.run().then(() => {
    console.log("Done. Crawled", Object.keys(crawledUrls).length, "URLs.");
    console.log("Sitemaps are at:", path.join(outDir, "sitemap.xml"));
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
