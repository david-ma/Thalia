import { describe, expect, test } from "bun:test";
import {
  isDevDomainHost,
  pickCanonicalOriginFromDomains,
} from "../../scripts/sitemap-project-config.js";

describe("pickCanonicalOriginFromDomains", () => {
  test("skips localhost and takes first production host", () => {
    expect(
      pickCanonicalOriginFromDomains(["localhost", "universalbearings.com.au", "www.universalbearings.com.au"]),
    ).toBe("https://universalbearings.com.au");
  });
  test("skips david-ma dev host", () => {
    expect(pickCanonicalOriginFromDomains(["ubc-public.david-ma.net", "universalbearings.com.au"])).toBe(
      "https://universalbearings.com.au",
    );
  });
  test("accepts https URL in list", () => {
    expect(pickCanonicalOriginFromDomains(["https://www.example.com/path"])).toBe("https://www.example.com");
  });
  test("returns null if only dev hosts", () => {
    expect(pickCanonicalOriginFromDomains(["localhost", "127.0.0.1"])).toBeNull();
  });
});

describe("isDevDomainHost", () => {
  test("david-ma.net is dev", () => {
    expect(isDevDomainHost("foo.david-ma.net")).toBe(true);
  });
  test("production is not dev", () => {
    expect(isDevDomainHost("universalbearings.com.au")).toBe(false);
  });
});
