#!/usr/bin/env bun
/**
 * Interactive sitemap helper for Thalia projects (aligns with `bun dev <project>`).
 *
 * From Thalia repo root:
 *   bun run sitemap [project]
 *
 * Checks `websites/<project>/public/sitemap.xml`, shows age, offers smoke / regenerate.
 * Non-TTY: require project; use --smoke or --regenerate (no prompts).
 */

import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import readline from "readline";

function getThaliaRoot(): string {
  const rootPath = process.cwd();
  if (!fs.existsSync(path.join(rootPath, "websites"))) {
    console.error("Run from Thalia repo root (needs ./websites).");
    process.exit(1);
  }
  return rootPath;
}

function listProjects(thaliaRoot: string): string[] {
  const dir = path.join(thaliaRoot, "websites");
  return fs
    .readdirSync(dir)
    .filter((f) => fs.statSync(path.join(dir, f)).isDirectory() && f !== "default");
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

function parseArgs(argv: string[]): { project?: string; smoke: boolean; regenerate: boolean } {
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const rest = argv.filter((a) => !a.startsWith("--"));
  return {
    project: rest[0],
    smoke: flags.has("--smoke"),
    regenerate: flags.has("--regenerate"),
  };
}

async function main(): Promise<void> {
  const thaliaRoot = getThaliaRoot();
  const raw = process.argv.slice(2);
  const { project: projectFromArgs, smoke: wantSmoke, regenerate: wantRegen } = parseArgs(raw);
  const projects = listProjects(thaliaRoot);

  let projectName = projectFromArgs;
  if (!projectName) {
    if (!process.stdin.isTTY) {
      console.error("Usage: bun run sitemap <project> [--smoke|--regenerate]");
      process.exit(1);
    }
    console.log("Projects:\n");
    projects.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
    const n = await prompt("Project number or name: ");
    const idx = parseInt(n, 10);
    if (!isNaN(idx) && idx >= 1 && idx <= projects.length) {
      projectName = projects[idx - 1];
    } else {
      projectName = n;
    }
  }

  if (!projectName || !projects.includes(projectName)) {
    console.error(`Unknown project: ${projectName ?? "(none)"}`);
    process.exit(1);
  }

  const sitemapPath = path.join(thaliaRoot, "websites", projectName, "public", "sitemap.xml");
  const port = process.env.PORT || "1337";
  const targetBase = `http://localhost:${port}`;

  const runSmoke = (): void => {
    const r = spawnSync(
      process.execPath,
      [path.join(thaliaRoot, "scripts/smoke-sitemap.ts"), "--sitemap", sitemapPath, "--target", targetBase],
      { cwd: thaliaRoot, stdio: "inherit" },
    );
    process.exit(r.status ?? 1);
  };

  const runGenerate = (): void => {
    const r = spawnSync(
      process.execPath,
      [path.join(thaliaRoot, "scripts/generate-sitemaps.ts"), "--project", projectName!],
      { cwd: thaliaRoot, stdio: "inherit" },
    );
    process.exit(r.status ?? 1);
  };

  if (wantSmoke) {
    if (!fs.existsSync(sitemapPath)) {
      console.error("No sitemap at", sitemapPath);
      process.exit(1);
    }
    runSmoke();
  }
  if (wantRegen) {
    runGenerate();
  }

  if (!fs.existsSync(sitemapPath)) {
    console.log(`No sitemap at ${sitemapPath}`);
    if (!process.stdin.isTTY) {
      console.log("Generate: bun scripts/generate-sitemaps.ts --project", projectName);
      process.exit(1);
    }
    const a = await prompt("Generate now? [y/N]: ");
    if (a.toLowerCase() === "y" || a.toLowerCase() === "yes") {
      runGenerate();
    }
    process.exit(0);
  }

  const st = fs.statSync(sitemapPath);
  const ageMin = Math.round((Date.now() - st.mtimeMs) / 60000);
  console.log(`Sitemap: ${sitemapPath}`);
  console.log(`Last modified: ${st.mtime.toISOString()} (~${ageMin} min ago)\n`);

  if (!process.stdin.isTTY) {
    console.log("Non-TTY: pass --smoke or --regenerate after the project name.");
    process.exit(0);
  }

  console.log("1) Smoke test");
  console.log("2) Regenerate (crawl)");
  console.log("3) Exit");
  const c = await prompt("Choice [1-3]: ");
  if (c === "1") runSmoke();
  if (c === "2") runGenerate();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
