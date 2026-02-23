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
 */


import path from "path";
import * as cheerio from "cheerio";
import { WorkerPool } from "./worker-pool.js";

const workerCount = 20;
const delayMs = 10;

// Default target URL is localhost:1337
const targetUrl = process.argv[2] || "localhost:1337";
const baseUrl = "http://localhost:1337";
const domains = ["universalbearings.com.au", "www.universalbearings.com.au", "universalbearings.david-ma.net"];

/** Normalised URL key (origin + pathname) -> SitemapUrl. Used to dedupe and avoid re-crawling. */
const crawledUrls: Record<string, SitemapUrl> = {};

function normaliseKey(loc: string): string {
  const u = new URL(loc, baseUrl);
  return u.origin + u.pathname;
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
    this.priority = 1.0;
  }

  isSameDomain(): boolean {
    // If we're on localhost, we're on the same domain
    if (this.url.hostname === "localhost") return true;
    return domains.includes(this.url.hostname);
  }

  crawl(): Promise<SitemapUrl> {
    const startTime = Date.now();
    return fetch(this.loc, { redirect: "follow" })
      .then((response) => {
        this.statusCode = response.status;
        this.timeMs = Date.now() - startTime;
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
        console.log(entry.loc, entry.statusCode);
        for (const link of entry.links) {
          if (!link.isSameDomain()) continue;
          const k = normaliseKey(link.loc);
          if (crawledUrls[k]) continue;
          crawledUrls[k] = link;
          pool.push(makeCrawlJob(link));
        }
      })
      .catch((e: Error) => {
        console.warn(entry.loc, e.message);
      });
}

function main(): void {
  pool = new WorkerPool({ workers: workerCount, delayMs });

  pool.on("finished", () => {
    writeSitemapXml(Object.values(crawledUrls));
    writeErrorReport(Object.values(crawledUrls));
  });

  const entry = new SitemapUrl(targetUrl);
  const key = normaliseKey(entry.loc);
  crawledUrls[key] = entry;

  pool.push(() =>
    entry
      .crawl()
      .then(() => {
        console.log(entry.loc, entry.statusCode);
        for (const link of entry.links) {
          if (!link.isSameDomain()) continue;
          const k = normaliseKey(link.loc);
          if (crawledUrls[k]) continue;
          crawledUrls[k] = link;
          pool.push(makeCrawlJob(link));
        }
      })
      .catch((e: Error) => {
        console.warn(entry.loc, e.message);
      })
  );

  pool.run().then(() => {
    console.log("Crawled", Object.keys(crawledUrls).length, "URLs");
  });
}

main();

import fs from "fs";
function writeSitemapXml(urls: SitemapUrl[]) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url>\n    <loc>${url.loc}</loc>\n    <lastmod>${url.lastmod}</lastmod>\n    <changefreq>${url.changefreq}</changefreq>\n    <priority>${url.priority}</priority>\n  </url>`).join("\n")}\n</urlset>`;
  fs.writeFileSync("sitemap.xml", xml);
}

function writeErrorReport(urls: SitemapUrl[]) {
  const report = urls.filter((url) => url.statusCode !== 200).map((url) => `${url.loc} ${url.statusCode}`).join("\n");
  fs.writeFileSync("error-report.txt", report);
}
