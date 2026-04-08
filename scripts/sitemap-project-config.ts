/**
 * Resolve canonical public origin for sitemap <loc> from a Thalia website config.
 */

import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import type { RawWebsiteConfig } from "thalia/types";

/** True for hosts we skip when picking the first "production" domain (interview 1a). */
export function isDevDomainHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.startsWith("127.")) return true;
  if (h.includes("localhost:")) return true;
  if (h.endsWith(".david-ma.net")) return true;
  return false;
}

/**
 * First non-dev entry in `domains` → `https://<host>` (no trailing slash).
 * Entries may be bare hostnames or full URLs.
 */
export function pickCanonicalOriginFromDomains(domains: string[]): string | null {
  for (const d of domains) {
    const host = d
      .replace(/^https?:\/\//, "")
      .split("/")[0]
      .split(":")[0]
      .trim();
    if (!host) continue;
    if (isDevDomainHost(host)) continue;
    return `https://${host}`;
  }
  return null;
}

/** Dynamic-import `config/config.ts` and read canonical origin; returns null if missing or unusable. */
export async function loadCanonicalOriginFromProject(projectRoot: string): Promise<string | null> {
  const configPath = path.join(projectRoot, "config", "config.ts");
  if (!fs.existsSync(configPath)) return null;
  const mod = (await import(pathToFileURL(configPath).href)) as { config?: RawWebsiteConfig };
  const config = mod.config;
  if (!config?.domains?.length) return null;
  return pickCanonicalOriginFromDomains(config.domains);
}
