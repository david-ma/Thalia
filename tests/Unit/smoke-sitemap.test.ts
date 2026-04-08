import { describe, expect, test } from "bun:test";
import {
  collectSameOriginAssetUrls,
  extractLocsFromSitemapXml,
  fetchWithRedirectLog,
  looksLikeHtml,
  runSmoke,
  targetPageUrl,
} from "../../scripts/smoke-sitemap-lib.js";

describe("extractLocsFromSitemapXml", () => {
  test("parses loc elements", () => {
    const xml = `<?xml version="1.0"?><urlset><url><loc>https://x.com/a</loc></url><url><loc>https://x.com/b</loc></url></urlset>`;
    expect(extractLocsFromSitemapXml(xml)).toEqual(["https://x.com/a", "https://x.com/b"]);
  });
});

describe("targetPageUrl", () => {
  test("maps loc pathname onto target base", () => {
    expect(targetPageUrl("http://localhost:1337", "https://legacy.com/foo/bar")).toBe(
      "http://localhost:1337/foo/bar",
    );
  });
  test("root loc", () => {
    expect(targetPageUrl("http://localhost:1337", "https://x/")).toBe("http://localhost:1337/");
  });
});

describe("looksLikeHtml", () => {
  test("content-type text/html", () => {
    expect(looksLikeHtml(new ArrayBuffer(0), "text/html; charset=utf-8")).toBe(true);
  });
  test("detects leading tag", () => {
    const enc = new TextEncoder().encode("  \n<html>");
    expect(looksLikeHtml(enc.buffer, null)).toBe(true);
  });
});

describe("collectSameOriginAssetUrls", () => {
  test("keeps same-origin hrefs and assets", () => {
    const html = `
      <a href="/page">x</a>
      <a href="https://other.com/x">ext</a>
      <img src="/i.png" />
      <script src="/app.js"></script>
      <link rel="stylesheet" href="/t.css" />
    `;
    const page = "http://localhost:1337/";
    const origin = "http://localhost:1337";
    const urls = collectSameOriginAssetUrls(html, page, origin).sort();
    expect(urls).toEqual(
      [
        "http://localhost:1337/app.js",
        "http://localhost:1337/i.png",
        "http://localhost:1337/page",
        "http://localhost:1337/t.css",
      ].sort(),
    );
  });
  test("skips mailto and hash-only", () => {
    const html = `<a href="mailto:a@b.com">m</a><a href="#">h</a><a href="/ok">o</a>`;
    const urls = collectSameOriginAssetUrls(html, "http://localhost/", "http://localhost");
    expect(urls).toEqual(["http://localhost/ok"]);
  });
});

describe("fetchWithRedirectLog", () => {
  test("logs redirect and returns final 200 response", async () => {
    const logs: string[] = [];
    const mockFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (u === "http://localhost:1337/old") {
        return new Response(null, {
          status: 302,
          headers: { Location: "http://localhost:1337/new" },
        });
      }
      if (u === "http://localhost:1337/new") {
        return new Response("<html>ok</html>", { status: 200, headers: { "Content-Type": "text/html" } });
      }
      return new Response("not found", { status: 404 });
    };

    const { response, finalUrl } = await fetchWithRedirectLog(
      "http://localhost:1337/old",
      (line) => logs.push(line),
      { method: "GET" },
      mockFetch,
    );
    expect(logs.some((l) => l.includes("302"))).toBe(true);
    expect(finalUrl).toBe("http://localhost:1337/new");
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("ok");
  });
});

describe("runSmoke", () => {
  test("reports page failure on 404", async () => {
    const mockFetch: typeof fetch = async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (u.includes("/missing")) {
        return new Response("no", { status: 404 });
      }
      return new Response("<html></html>", { status: 200, headers: { "Content-Type": "text/html" } });
    };

    const result = await runSmoke({
      targetBase: "http://localhost:1337",
      locs: ["https://x.com/missing"],
      logInfo: () => {},
      fetchImpl: mockFetch,
    });
    expect(result.failures.length).toBe(1);
    expect(result.failures[0].kind).toBe("page");
  });

  test("discovers and checks same-origin asset", async () => {
    const mockFetch: typeof fetch = async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (u.endsWith("/page") || u.includes("/page")) {
        return new Response(
          '<html><img src="http://localhost:1337/pixel.png" /></html>',
          { status: 200, headers: { "Content-Type": "text/html" } },
        );
      }
      if (u.includes("pixel.png")) {
        return new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "Content-Type": "image/png" },
        });
      }
      return new Response("?", { status: 500 });
    };

    const result = await runSmoke({
      targetBase: "http://localhost:1337",
      locs: ["https://x.com/page"],
      logInfo: () => {},
      fetchImpl: mockFetch,
    });
    expect(result.failures.length).toBe(0);
    expect(result.assetCount).toBe(1);
  });

  test("asset failure includes referencedFrom (source pages)", async () => {
    const mockFetch: typeof fetch = async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (u === "http://localhost:1337/foo" || u.endsWith("/foo")) {
        return new Response('<html><img src="/missing.png" /></html>', {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }
      if (u.includes("missing.png")) {
        return new Response("gone", { status: 404 });
      }
      return new Response("?", { status: 500 });
    };

    const result = await runSmoke({
      targetBase: "http://localhost:1337",
      locs: ["https://x.com/foo"],
      logInfo: () => {},
      fetchImpl: mockFetch,
    });
    expect(result.failures.length).toBe(1);
    expect(result.failures[0].kind).toBe("asset");
    expect(result.failures[0].referencedFrom).toEqual(["http://localhost:1337/foo"]);
  });
});
