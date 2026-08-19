/**
 * Theme registry + toggle modes (binary | system | palette).
 * See docs/guides/themes.md
 *
 * html[data-theme="<id>"] applies a pack from thalia-themes.scss.
 * html[data-color-scheme="light"|"dark"] is derived for Mermaid invert etc.
 * system → remove data-theme; CSS media query picks thalia / thalia-dark.
 */

export type ThemeId =
  | "system"
  | "light"
  | "dark"
  | "thalia"
  | "thalia-dark"
  | "solarized-light"
  | "solarized-dark"
  | "rose-pine"
  | "rose-pine-moon"
  | "rose-pine-dawn"
  | "dracula"
  | "monokai"
  | "agency";

export type ToggleMode = "binary" | "system" | "palette";

export type ThemeMeta = {
  id: ThemeId;
  label: string;
  /** Visual scheme for data-color-scheme + Mermaid. Ignored for system. */
  scheme: "light" | "dark" | "system";
  swatch: string;
};

export const THEME_STORAGE_KEY = "thalia-theme";

export const THEMES: ThemeMeta[] = [
  { id: "system", label: "System", scheme: "system", swatch: "linear-gradient(135deg,#ffffff 50%,#212529 50%)" },
  { id: "light", label: "Light", scheme: "light", swatch: "#ffffff" },
  { id: "dark", label: "Dark", scheme: "dark", swatch: "#212529" },
  { id: "thalia", label: "Thalia", scheme: "light", swatch: "#ffffff" },
  { id: "thalia-dark", label: "Thalia Dark", scheme: "dark", swatch: "#212529" },
  { id: "solarized-light", label: "Solarized Light", scheme: "light", swatch: "#fdf6e3" },
  { id: "solarized-dark", label: "Solarized Dark", scheme: "dark", swatch: "#002b36" },
  { id: "rose-pine-dawn", label: "Rosé Pine Dawn", scheme: "light", swatch: "#faf4ed" },
  { id: "rose-pine-moon", label: "Rosé Pine Moon", scheme: "dark", swatch: "#232136" },
  { id: "rose-pine", label: "Rosé Pine", scheme: "dark", swatch: "#191724" },
  { id: "dracula", label: "Dracula", scheme: "dark", swatch: "#282a36" },
  { id: "monokai", label: "Monokai", scheme: "dark", swatch: "#272822" },
  { id: "agency", label: "Bootstrap Agency", scheme: "light", swatch: "#ffc800" },
];

const BY_ID = Object.fromEntries(THEMES.map((t) => [t.id, t])) as Record<ThemeId, ThemeMeta>;

export const CYCLE_SYSTEM: ThemeId[] = ["system", "light", "dark"];
export const CYCLE_BINARY: ThemeId[] = ["light", "dark"];
export const PALETTE_IDS: ThemeId[] = [
  "system",
  "thalia",
  "thalia-dark",
  "solarized-light",
  "solarized-dark",
  "rose-pine-dawn",
  "rose-pine-moon",
  "rose-pine",
  "dracula",
  "monokai",
  "agency",
];

export function isThemeId(v: string | null | undefined): v is ThemeId {
  return !!v && v in BY_ID;
}

export function themeMeta(id: ThemeId): ThemeMeta {
  return BY_ID[id];
}

export function readThemeId(): ThemeId {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeId(v)) return v;
  } catch {
    /* private mode */
  }
  if (typeof document !== "undefined") {
    const siteDefault = document.documentElement.getAttribute("data-theme-default");
    if (isThemeId(siteDefault)) return siteDefault;
  }
  return "system";
}

function resolvedScheme(id: ThemeId): "light" | "dark" {
  const meta = BY_ID[id];
  if (meta.scheme === "light" || meta.scheme === "dark") return meta.scheme;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

/** Exported for unit tests (no DOM). */
export function resolveColorScheme(id: ThemeId, prefersDark: boolean): "light" | "dark" {
  const meta = BY_ID[id];
  if (meta.scheme === "light" || meta.scheme === "dark") return meta.scheme;
  return prefersDark ? "dark" : "light";
}

export function applyThemeId(id: ThemeId): void {
  const root = document.documentElement;
  if (id === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", id);

  root.setAttribute("data-color-scheme", resolvedScheme(id));

  const label = BY_ID[id].label;
  document.querySelectorAll<HTMLElement>("[data-theme-toggle-label]").forEach((el) => {
    el.textContent = label;
  });

  document.querySelectorAll<HTMLElement>("[data-theme-toggle]").forEach((el) => {
    el.setAttribute("aria-label", `Colour theme: ${label}`);
    el.setAttribute("title", `Theme: ${label}`);
  });

  document.querySelectorAll<HTMLElement>("[data-theme-set]").forEach((el) => {
    const active = el.getAttribute("data-theme-set") === id;
    el.classList.toggle("active", active);
    el.setAttribute("aria-current", active ? "true" : "false");
  });
}

export function cycleThemeId(id: ThemeId, mode: ToggleMode = "system"): ThemeId {
  const cycle = mode === "binary" ? CYCLE_BINARY : CYCLE_SYSTEM;
  const i = cycle.indexOf(id);
  if (i < 0) return cycle[0];
  return cycle[(i + 1) % cycle.length];
}

export function setThemeId(id: ThemeId): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
  applyThemeId(id);
}

function readMode(el: HTMLElement): ToggleMode {
  const m = el.getAttribute("data-theme-mode");
  if (m === "binary" || m === "palette" || m === "system") return m;
  return "system";
}

export function initThemeToggle(root: ParentNode = document): void {
  applyThemeId(readThemeId());

  root.querySelectorAll<HTMLElement>("[data-theme-toggle]").forEach((btn) => {
    if (btn.dataset.themeToggleBound === "1") return;
    btn.dataset.themeToggleBound = "1";
    const mode = readMode(btn);
    if (mode === "palette") return;
    btn.addEventListener("click", () => {
      setThemeId(cycleThemeId(readThemeId(), mode));
    });
  });

  root.querySelectorAll<HTMLElement>("[data-theme-set]").forEach((el) => {
    if (el.dataset.themeSetBound === "1") return;
    el.dataset.themeSetBound = "1";
    el.addEventListener("click", (ev) => {
      ev.preventDefault();
      const id = el.getAttribute("data-theme-set");
      if (isThemeId(id)) setThemeId(id);
    });
  });

  if (typeof window !== "undefined") {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (readThemeId() === "system") applyThemeId("system");
    });
  }
}

if (typeof document !== "undefined") {
  initThemeToggle();
}
