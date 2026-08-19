# Themes

Thalia themes are named SCSS packs applied through `data-theme` on the document
root. They provide a common CSS custom-property contract for framework chrome,
Markdown, Bootstrap-compatible components, and site-specific components.

## Supported themes

The palette contains `thalia`, `thalia-dark`, `solarized-light`,
`solarized-dark`, `rose-pine`, `rose-pine-moon`, `rose-pine-dawn`, `dracula`,
`monokai`, and `agency`. `light` and `dark` are stable aliases for the two
Thalia defaults. `system` removes `data-theme` and follows the browser colour
scheme preference.

The active choice is stored as `thalia-theme` in `localStorage`. The early boot
partial applies it in the document head to avoid a flash of the wrong theme and
sets `data-color-scheme` to `light` or `dark` for consumers such as Mermaid.

## Using themes in a site

The framework wrapper includes `theme-boot` and the framework navigation
includes the palette toggle. A wrapped page can select a site default without
overwriting the visitor's saved preference:

```hbs
{{#> wrapper defaultTheme="agency"}}
  ...
{{/wrapper}}
```

Stored visitor choice wins over `defaultTheme`. Invalid defaults and invalid
stored values fall back to `system`.

The toggle partial supports three presentations:

```hbs
{{> theme-toggle }}
{{> theme-toggle binary=true }}
{{> theme-toggle palette=true }}
```

The default cycle is `system → light → dark`; binary cycles `light → dark`;
palette renders every public pack. A site may override the partial by basename
from its own `src/`, but should usually pass parameters to the framework partial
instead.

## Token contract

Every pack must define the same `--thalia-*` properties. The contract is broad
on purpose: examples and downstream sites may use the extended palette even
when the framework core does not yet consume every token.

- Foundations: fonts, ink, muted text, paper, accent, line, glow, surfaces,
  hover/hot states, pop/bubble layers, inset, and shadow.
- Semantic actions: `--thalia-cheat`, `--thalia-reject`, and
  `--thalia-submit`.
- Evaluation contrast: `--thalia-eval-white` and `--thalia-eval-black`.
- Markdown and highlighting: the `--thalia-md-*` properties.
- Bootstrap bridge: each pack also supplies the Bootstrap variables used by
  Thalia components.

Use an existing semantic token before introducing a component-specific colour.
When adding a token, add it to every pack and extend a deterministic example to
show why it exists. The unit suite enforces identical Thalia token names across
all packs.

## Adding or changing a theme

Theme metadata is deliberately repeated in the layers which need it before or
without browser JavaScript. A change is complete only when these stay aligned:

1. Add or update the SCSS mixin and `data-theme` selector in
   `src/css/thalia-themes.scss`.
2. Update the typed registry, scheme, label, swatch, and palette order in
   `src/js/theme-toggle.ts`.
3. Update the early `KNOWN` and `DARK` maps in
   `src/views/partials/theme-boot.hbs`.
4. Update palette markup in `src/views/partials/theme-toggle.hbs`.
5. Add or update a rendered example when the theme introduces a new integration
   pattern.
6. Run the registry unit tests, relevant request tests, and an SCSS compile.

The registry tests catch ID, order, dark-scheme, selector, and token drift. They
do not replace a visual check of foreground/background contrast and interactive
states.

## Source and public assets

Thalia serves browser TypeScript from a site's `src/js` first and framework
`src/js` second, compiling it on request through Bun. Therefore
`/js/theme-toggle.js` comes from `src/js/theme-toggle.ts`; do not maintain a
generated copy in `public/js`.

Use `public/` for files which must be served as-is, including vendor assets.
Site source overrides framework source at the same request path.

## Example ownership

- `example-src` is the deterministic theme-composition example and the main
  source-pipeline test fixture.
- `example-agency` is the static upstream visual reference used to compare the
  converted page; it is not a second theme tutorial.
- `example-minimal` demonstrates a public-only site and should remain free of
  source compilation and theme-customisation requirements.
- `example-auth` demonstrates security and database integration. Theme changes
  there should remain secondary to that purpose and its service-backed tests
  stay opt-in.
