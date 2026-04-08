/**
 * Generate sitemap.xml by crawling a site.
 *
 * **Legacy (tmp output):**
 *   `bun scripts/generate-sitemaps.ts`  → crawl http://localhost:1337, write /tmp/sitemaps/sitemap.xml
 *   `bun scripts/generate-sitemaps.ts example.com`  → crawl https://example.com
 *
 * **Project (recommended):**
 *   `bun scripts/generate-sitemaps.ts --project thalia_ubc`
 *   Crawl `http://localhost:$PORT` (default 1337), canonical `<loc>` from `config.domains`,
 *   write `websites/<project>/public/sitemap.xml`.
 *   Optional: `--crawl-base`, `--out`, `--canonical-origin`.
 *
 * Interactive wrapper: `bun run sitemap <project>` (see bin/sitemap.ts).
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
 * - State is stored in sitemap-halt.csv (legacy: next to sitemap; --project: websites/<project>/tmp/sitemap-halt.csv).
 * - On halt/finish we write the full state so the next run can resume without re-discovering: load CSV, skip status 200, queue status null and failures for visit.
 */


import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";
import { WorkerPool } from "./worker-pool.js";
import { loadCanonicalOriginFromProject } from "./sitemap-project-config.js";

const workerCount = 10;
const delayMs = 200;
/** Stop after this many consecutive failures (e.g. 403). Then wait ~5 min and re-run the script. */
const maxConsecutiveFailures = 5;
/** Optional: stop after this many total failures across all workers. */
const maxFailures = 20;

/** Crawl target (e.g. http://localhost:1337). Set in main() after parse. */
let crawlBaseUrl = "http://localhost:1337";
let outDir = process.env.SITEMAP_OUT || "/tmp/sitemaps";
/** Directory for sitemap-halt.csv (same as outDir for legacy; `websites/<project>/tmp` for --project). */
let haltCsvDir = outDir;
/** If set, sitemap <loc> uses this origin (https://prod.example) instead of crawl URLs. */
let canonicalPublishOrigin = "";

function crawlHostname(): string {
  try {
    return new URL(crawlBaseUrl).hostname;
  } catch {
    return "localhost";
  }
}

/** First non-flag token that is not a flag value (legacy host argument). */
function legacyPositionalHost(argv: string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project" || a === "--crawl-base" || a === "--out" || a === "--canonical-origin") {
      i++;
      continue;
    }
    if (a.startsWith("-")) continue;
    return a;
  }
  return undefined;
}

async function parseGenerateArgs(): Promise<{
  crawlBase: string;
  outDir: string;
  haltCsvDir: string;
  canonicalOrigin: string;
}> {
  const argv = process.argv.slice(2);
  let project: string | undefined;
  let crawlBase = "";
  let parsedOut = process.env.SITEMAP_OUT || "/tmp/sitemaps";
  let outExplicit = false;
  let canonicalOrigin = "";
  let explicitCanonical: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project" && argv[i + 1]) {
      project = argv[++i];
      continue;
    }
    if (a === "--crawl-base" && argv[i + 1]) {
      crawlBase = argv[++i].replace(/\/$/, "");
      continue;
    }
    if (a === "--out" && argv[i + 1]) {
      parsedOut = argv[++i];
      outExplicit = true;
      continue;
    }
    if (a === "--canonical-origin" && argv[i + 1]) {
      const v = argv[++i];
      explicitCanonical = v.startsWith("http") ? v.replace(/\/$/, "") : `https://${v.replace(/\/$/, "")}`;
      continue;
    }
  }

  const thaliaRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

  if (project) {
    const projectRoot = path.join(thaliaRoot, "websites", project);
    if (!fs.existsSync(projectRoot)) {
      throw new Error(`Project not found: ${projectRoot}`);
    }
    if (!outExplicit) {
      parsedOut = path.join(projectRoot, "public");
    }
    if (!crawlBase) {
      const port = process.env.PORT || "1337";
      crawlBase = `http://localhost:${port}`;
    }
    if (explicitCanonical) {
      canonicalOrigin = explicitCanonical;
    } else {
      const loaded = await loadCanonicalOriginFromProject(projectRoot);
      if (loaded) {
        canonicalOrigin = loaded;
      } else {
        console.warn(
          "Warning: no canonical origin from config.domains; <loc> will use crawl URLs. Pass --canonical-origin or set config.domains.",
        );
      }
    }
  } else {
    const positional = legacyPositionalHost(argv);
    const domain = positional || "localhost:1337";
    crawlBase =
      domain === "localhost:1337"
        ? "http://localhost:1337"
        : domain.startsWith("http")
          ? domain.replace(/\/$/, "")
          : `https://${domain}`;
    if (explicitCanonical) {
      canonicalOrigin = explicitCanonical;
    }
  }

  const haltCsvDirResolved = project
    ? path.join(thaliaRoot, "websites", project!, "tmp")
    : parsedOut;

  return { crawlBase, outDir: parsedOut, haltCsvDir: haltCsvDirResolved, canonicalOrigin };
}

/** Normalised key -> full URL (for CSV output). */
const urlByKey: Record<string, string> = {};
/** Normalised key -> status (200, 403, or null if not visited yet). */
const urlStatus: Record<string, number | null> = {};
/** Normalised key -> SitemapUrl. Full data for sitemap; stubs for loaded 200s. */
const crawledUrls: Record<string, SitemapUrl> = {};

function normaliseKey(loc: string): string {
  const u = new URL(loc, crawlBaseUrl);
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
  const file = path.join(haltCsvDir, HALT_CSV);
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
  fs.mkdirSync(haltCsvDir, { recursive: true });
  const out = path.join(haltCsvDir, HALT_CSV);
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
    this.loc = new URL(loc, crawlBaseUrl).href;
    this.links = [];
    this.url = new URL(this.loc, crawlBaseUrl);

    const seg = this.url.pathname.split("/")[1];
    this.category = seg ? seg.charAt(0).toUpperCase() + seg.slice(1) : "Home";
    // this.priority = 1.0;
  }

  isSameDomain(): boolean {
    const h = this.url.hostname;
    if (h === "localhost" || h === "127.0.0.1") return true;
    return h === crawlHostname();
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
  fs.mkdirSync(haltCsvDir, { recursive: true });
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
    console.log(
      "Known URLs:",
      known,
      "| 200s:",
      ok,
      "| sitemap:",
      path.join(outDir, "sitemap.xml"),
      "| halt:",
      path.join(haltCsvDir, HALT_CSV),
    );
  }

  pool.on("finished", persistState);
  pool.on("halted", () => {
    persistState();
    console.warn("Halted (rate limit?). Re-run in a few minutes to resume.");
  });

  let pushed = 0;
  const homeKey = normaliseKey(crawlBaseUrl);
  if (urlByKey[homeKey] === undefined) {
    urlByKey[homeKey] = crawlBaseUrl;
    urlStatus[homeKey] = null;
  }
  if (urlStatus[homeKey] !== 200) {
    const entry = new SitemapUrl(crawlBaseUrl);
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

parseGenerateArgs()
  .then((opts) => {
    crawlBaseUrl = opts.crawlBase;
    outDir = opts.outDir;
    haltCsvDir = opts.haltCsvDir;
    canonicalPublishOrigin = opts.canonicalOrigin;
    if (canonicalPublishOrigin) {
      console.log("Canonical <loc> origin:", canonicalPublishOrigin);
    }
    console.log("Crawl base:", crawlBaseUrl);
    main();
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

function escapeXmlLoc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function publishedLocForXml(url: SitemapUrl): string {
  if (!canonicalPublishOrigin) return url.loc;
  const parsed = new URL(url.loc);
  const base = canonicalPublishOrigin.replace(/\/$/, "");
  return `${base}${parsed.pathname}${parsed.search}`;
}

function SitemapUrlToXmlMapping(url: SitemapUrl) {
  const loc = `<loc>${escapeXmlLoc(publishedLocForXml(url))}</loc>`;
  const lastmod = url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : "";
  const changefreq = url.changefreq ? `<changefreq>${url.changefreq}</changefreq>` : "";
  const priority = url.priority ? `<priority>${url.priority}</priority>` : "";
  return `  <url>\n    ${[loc, lastmod, changefreq, priority].filter(Boolean).join("\n  ")}\n  </url>`;
}

function writeSitemapXml(urls: SitemapUrl[]) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.filter((u) => u.statusCode === 200).map((u) => SitemapUrlToXmlMapping(u)).join("\n")}\n</urlset>`;
  fs.writeFileSync(path.join(outDir, "sitemap.xml"), xml);
}
