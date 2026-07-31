import type { NestedControllerMap } from '../website.js'

/**
 * Replace `securityConfig()`'s default `controllers.admin` leaf (scaffold) with an
 * explicit path → controller map. Merge the return value into site `controllers.admin`
 * **after** `securityConfig()` via `recursiveObjectMerge` — an object replaces the
 * framework function (see `recursiveObjectMerge`).
 *
 * Prefer listing pages with **`wrap('….hbs')`** (or a custom controller) so config readers
 * can see what lives under `/admin`. Pure HBS fallthrough after `admin: {}` still works
 * but is harder to audit. (`hbs` / `md_file` are lower-level backends used by `wrap`.)
 *
 * @example
 * ```ts
 * import { wrap } from 'thalia/controllers'
 * import { claimAdminNamespace } from 'thalia/security'
 *
 * controllers: {
 *   admin: claimAdminNamespace({
 *     overview: wrap('admin_overview.hbs'),
 *   }),
 * }
 * ```
 * Then `/admin` can fall through to site `src/admin.hbs` / `src/admin/index.hbs`,
 * and `/admin/overview` hits the wrapped template.
 */
export function claimAdminNamespace(
  controllers: Record<string, NestedControllerMap>,
): Record<string, NestedControllerMap> {
  return controllers
}
