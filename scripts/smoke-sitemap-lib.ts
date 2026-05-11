/**
 * Sitemap-driven smoke test: pure helpers + run function (injectable fetch for tests).
 */

import path from "path";
import * as cheerio from "cheerio";

export const MAX_REDIRECTS = 20;

/** Minimal fetch shape for smoke tests (avoids Bun’s `typeof fetch` extras such as `preconnect`). */
export type SmokeFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** If sitemap lives at `.../websites/<project>/public/sitemap.xml`, default report path under that project. */
export function defaultReportTxtPathForSitemap(sitemapPath: string): string | null {
  const resolved = path.resolve(sitemapPath);
  const norm = resolved.replace(/\\/g, "/");
  const m = norm.match(/^(.*)\/websites\/([^/]+)\/public\/sitemap\.xml$/i);
  if (!m) return null;
  return path.join(m[1], "websites", m[2], "tmp", "sitemap-report.txt");
}

export interface SmokeFailure {
  kind: "page" | "asset";
  url: string;
  reason: string;
  /** For asset failures: sitemap HTML pages that linked to this URL (post-redirect page URL). */
  referencedFrom?: string[];
}

export interface SmokeResult {
  pageCount: number;
  assetCount: number;
  failures: SmokeFailure[];
}

/** Extract all <loc> URLs from sitemap XML. */
export function extractLocsFromSitemapXml(xml: string): string[] {
  const locs: string[] = [];
  const re = /<loc>([^<]+)<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    locs.push(m[1].trim());
  }
  return locs;
}

/** Map sitemap <loc> to a URL on targetBase (pathname from loc + target origin/path). */
export function targetPageUrl(targetBase: string, loc: string): string {
  const base = targetBase.replace(/\/$/, "");
  let pathname: string;
  try {
    pathname = new URL(loc).pathname || "/";
  } catch {
    pathname = "/";
  }
  if (pathname === "/") return `${base}/`;
  return `${base}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

export function looksLikeHtml(buf: ArrayBuffer | ArrayBufferView, contentType: string | null): boolean {
  if (contentType?.toLowerCase().includes("text/html")) return true;
  const u8 =
    buf instanceof ArrayBuffer
      ? new Uint8Array(buf)
      : buf instanceof Uint8Array
        ? buf
        : new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const headBytes = u8.byteLength > 512 ? u8.subarray(0, 512) : u8;
  const head = new TextDecoder().decode(headBytes);
  return /^\s*</.test(head);
}

/**
 * Resolve and collect same-origin URLs from HTML (links and assets). Skips mailto, tel, javascript, data, hash-only.
 */
export function collectSameOriginAssetUrls(html: string, pageUrl: string, baseOrigin: string): string[] {
  const $ = cheerio.load(html);
  const out = new Set<string>();

  const add = (raw: string | undefined) => {
    if (!raw || raw.trim() === "") return;
    const t = raw.trim();
    if (
      t.startsWith("mailto:") ||
      t.startsWith("tel:") ||
      t.startsWith("javascript:") ||
      t.startsWith("data:")
    ) {
      return;
    }
    if (t === "#" || (t.startsWith("#") && !t.includes("://"))) return;

    let resolved: URL;
    try {
      resolved = new URL(t, pageUrl);
    } catch {
      return;
    }
    if (resolved.origin !== baseOrigin) return;
    out.add(resolved.href);
  };

  $("a[href]").each((_, el) => add($(el).attr("href")));
  $("img[src]").each((_, el) => add($(el).attr("src")));
  $("img[srcset]").each((_, el) => {
    const srcset = $(el).attr("srcset");
    if (!srcset) return;
    for (const part of srcset.split(",")) {
      const p = part.trim().split(/\s+/)[0];
      if (p) add(p);
    }
  });
  $("script[src]").each((_, el) => add($(el).attr("src")));
  $('link[rel="stylesheet"][href]').each((_, el) => add($(el).attr("href")));

  return [...out];
}

/**
 * Follow redirects manually; log each 3xx hop with logInfo (use for [info] lines).
 * Returns the final Response (body not consumed) and final URL.
 */
export async function fetchWithRedirectLog(
  url: string,
  logInfo: (line: string) => void,
  init: RequestInit | undefined,
  fetchImpl: SmokeFetch,
): Promise<{ response: Response; finalUrl: string }> {
  let current = url;
  for (let i = 0; i < MAX_REDIRECTS; i++) {
    const res = await fetchImpl(current, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      logInfo(`${res.status} ${current} -> ${loc ?? "(no Location)"}`);
      if (!loc) {
        return { response: res, finalUrl: current };
      }
      current = new URL(loc, current).href;
      continue;
    }
    return { response: res, finalUrl: current };
  }
  throw new Error(`Too many redirects from ${url}`);
}

function failureReason(status: number, emptyBody: boolean): string {
  if (emptyBody) return `HTTP ${status} with empty body`;
  return `HTTP ${status}`;
}

export interface RunSmokeOptions {
  targetBase: string;
  locs: string[];
  logInfo: (line: string) => void;
  fetchImpl?: SmokeFetch;
}

/**
 * For each sitemap loc, GET the target page (with redirect logging), then GET each same-origin asset discovered in HTML.
 */
export async function runSmoke(options: RunSmokeOptions): Promise<SmokeResult> {
  const fetchImpl: SmokeFetch = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const baseOrigin = new URL(options.targetBase).origin;
  const failures: SmokeFailure[] = [];
  /** Asset URL -> set of page URLs (final URL after redirects) whose HTML referenced that asset. */
  const assetReferrers = new Map<string, Set<string>>();

  function noteReferrer(assetUrl: string, referrerPageUrl: string): void {
    let set = assetReferrers.get(assetUrl);
    if (!set) {
      set = new Set<string>();
      assetReferrers.set(assetUrl, set);
    }
    set.add(referrerPageUrl);
  }

  for (const loc of options.locs) {
    const pageUrl = targetPageUrl(options.targetBase, loc);
    try {
      const { response, finalUrl } = await fetchWithRedirectLog(pageUrl, options.logInfo, { method: "GET" }, fetchImpl);
      const status = response.status;
      const buf = await response.arrayBuffer();
      const empty = buf.byteLength === 0;
      if (!response.ok || empty) {
        failures.push({ kind: "page", url: pageUrl, reason: failureReason(status, empty) });
        continue;
      }
      const ct = response.headers.get("content-type");
      if (!looksLikeHtml(buf, ct)) continue;
      const html = new TextDecoder().decode(buf);
      for (const u of collectSameOriginAssetUrls(html, finalUrl, baseOrigin)) {
        noteReferrer(u, finalUrl);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      failures.push({ kind: "page", url: pageUrl, reason: msg });
    }
  }

  for (const assetUrl of assetReferrers.keys()) {
    try {
      const { response } = await fetchWithRedirectLog(assetUrl, options.logInfo, { method: "GET" }, fetchImpl);
      const status = response.status;
      const buf = await response.arrayBuffer();
      const empty = buf.byteLength === 0;
      if (!response.ok || empty) {
        const refs = [...(assetReferrers.get(assetUrl) ?? [])].sort();
        failures.push({
          kind: "asset",
          url: assetUrl,
          reason: failureReason(status, empty),
          referencedFrom: refs,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const refs = [...(assetReferrers.get(assetUrl) ?? [])].sort();
      failures.push({ kind: "asset", url: assetUrl, reason: msg, referencedFrom: refs });
    }
  }

  return {
    pageCount: options.locs.length,
    assetCount: assetReferrers.size,
    failures,
  };
}
