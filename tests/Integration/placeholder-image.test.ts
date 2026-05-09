/**
 * Integration: framework-provided /placeholder-image SVG (200, image/svg+xml).
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { startTestServer, stopTestServer, fetchFromServer, waitForServerHttp } from "./helpers.js";

const PROJECT = "example-minimal";

describe("Placeholder image route", () => {
  let port: number;

  beforeAll(async () => {
    const { port: p } = await startTestServer(PROJECT);
    port = p;
    await waitForServerHttp(port);
  });

  afterAll(async () => {
    await stopTestServer(PROJECT);
  });

  test("GET /placeholder-image returns 200 SVG (defaults)", async () => {
    const response = await fetchFromServer("/placeholder-image", port);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/svg+xml");
    const body = await response.text();
    expect(body.length).toBeGreaterThan(0);
    expect(body).toContain("600 × 400");
  });

  test("GET /placeholder-image/100/200 returns sized SVG", async () => {
    const response = await fetchFromServer("/placeholder-image/100/200", port);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/svg+xml");
    const body = await response.text();
    expect(body).toContain('width="100"');
    expect(body).toContain('height="200"');
    expect(body).toContain("100 × 200");
  });

  test("GET /placeholder-image/ trailing slash normalised", async () => {
    const response = await fetchFromServer("/placeholder-image/", port);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("600 × 400");
  });
});
