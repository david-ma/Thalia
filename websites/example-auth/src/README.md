# `websites/example-auth/src`

Source for the **example-auth** demo site: Handlebars pages, partials, styles, and a small script. Files here are compiled or copied according to Thalia’s dev server and build pipeline.

| Path | Role |
|------|------|
| `index.hbs` | Home page (requires **user** or **admin** per `config/config.ts`). Uses the framework `wrapper` partial, Bootstrap layout, session summary, links to auth and CRUD routes, and the shared `image` upload widget. |
| `uploadImage.hbs` | Optional full-page multipart upload form wrapped in `wrapper`. |
| `page.html` | Static HTML sample (served as-is from `public` or linked for comparison with `.hbs` pages). |
| `partials/content.hbs` | Legacy marketing-style content block (feature grid). Use when composing pages with `{{> content }}` from a controller. |
| `partials/header.hbs` / `partials/footer.hbs` | Site chrome fragments (older standalone layout); prefer `{{#> wrapper }}` for new pages. |
| `partials/login.hbs` | Minimal password prompt fragment for route-guard flows (`{{ route }}`, `{{ message }}`). |
| `partials/logs.hbs` | Log or debug partial (if used by a route). |
| `styles/main.scss` | Site-specific SCSS (variables, layout). Linked only if your build or partials inject it. |
| `css/test.scss` | Small SCSS asset for pipeline checks. |
| `js/example.js` | Example client script (console demo). |

Shared UI comes from Thalia (`src/views/partials/wrapper.hbs`, `src/css/crud.css`, security templates under `src/views/security/`, and `src/views/partials/image.hbs`).
