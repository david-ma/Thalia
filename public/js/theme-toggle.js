// src/js/theme-toggle.ts
var THEME_STORAGE_KEY = "thalia-theme";
var THEMES = [
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
  { id: "agency", label: "Bootstrap Agency", scheme: "light", swatch: "#ffc800" }
];
var BY_ID = Object.fromEntries(THEMES.map((t) => [t.id, t]));
var CYCLE_SYSTEM = ["system", "light", "dark"];
var CYCLE_BINARY = ["light", "dark"];
var PALETTE_IDS = [
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
  "agency"
];
function isThemeId(v) {
  return !!v && v in BY_ID;
}
function themeMeta(id) {
  return BY_ID[id];
}
function readThemeId() {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeId(v))
      return v;
  } catch {}
  return "system";
}
function resolvedScheme(id) {
  const meta = BY_ID[id];
  if (meta.scheme === "light" || meta.scheme === "dark")
    return meta.scheme;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}
function resolveColorScheme(id, prefersDark) {
  const meta = BY_ID[id];
  if (meta.scheme === "light" || meta.scheme === "dark")
    return meta.scheme;
  return prefersDark ? "dark" : "light";
}
function applyThemeId(id) {
  const root = document.documentElement;
  if (id === "system")
    root.removeAttribute("data-theme");
  else
    root.setAttribute("data-theme", id);
  root.setAttribute("data-color-scheme", resolvedScheme(id));
  const label = BY_ID[id].label;
  document.querySelectorAll("[data-theme-toggle-label]").forEach((el) => {
    el.textContent = label;
  });
  document.querySelectorAll("[data-theme-toggle]").forEach((el) => {
    el.setAttribute("aria-label", `Colour theme: ${label}`);
    el.setAttribute("title", `Theme: ${label}`);
  });
  document.querySelectorAll("[data-theme-set]").forEach((el) => {
    const active = el.getAttribute("data-theme-set") === id;
    el.classList.toggle("active", active);
    el.setAttribute("aria-current", active ? "true" : "false");
  });
}
function cycleThemeId(id, mode = "system") {
  const cycle = mode === "binary" ? CYCLE_BINARY : CYCLE_SYSTEM;
  const i = cycle.indexOf(id);
  if (i < 0)
    return cycle[0];
  return cycle[(i + 1) % cycle.length];
}
function setThemeId(id) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {}
  applyThemeId(id);
}
function readMode(el) {
  const m = el.getAttribute("data-theme-mode");
  if (m === "binary" || m === "palette" || m === "system")
    return m;
  return "system";
}
function initThemeToggle(root = document) {
  applyThemeId(readThemeId());
  root.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    if (btn.dataset.themeToggleBound === "1")
      return;
    btn.dataset.themeToggleBound = "1";
    const mode = readMode(btn);
    if (mode === "palette")
      return;
    btn.addEventListener("click", () => {
      setThemeId(cycleThemeId(readThemeId(), mode));
    });
  });
  root.querySelectorAll("[data-theme-set]").forEach((el) => {
    if (el.dataset.themeSetBound === "1")
      return;
    el.dataset.themeSetBound = "1";
    el.addEventListener("click", (ev) => {
      ev.preventDefault();
      const id = el.getAttribute("data-theme-set");
      if (isThemeId(id))
        setThemeId(id);
    });
  });
  if (typeof window !== "undefined") {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (readThemeId() === "system")
        applyThemeId("system");
    });
  }
}
if (typeof document !== "undefined") {
  initThemeToggle();
}
export {
  themeMeta,
  setThemeId,
  resolveColorScheme,
  readThemeId,
  isThemeId,
  initThemeToggle,
  cycleThemeId,
  applyThemeId,
  THEME_STORAGE_KEY,
  THEMES,
  PALETTE_IDS,
  CYCLE_SYSTEM,
  CYCLE_BINARY
};
