# Build identity and readiness (schema 2)

`GET /version` is public. `GET /health` requires `THALIA_HEALTH_TOKEN` via
`Authorization: Bearer …` or `X-Thalia-Health-Token`. An unset server token yields
404; missing/incorrect credentials yield 401 with no diagnostics. Authorised
health returns 200 when ready and 503 otherwise. Both endpoints use no-store.

## Public identity

Both responses carry `schemaVersion: 2` and the same `identity` captured at Website
construction. `identity.application` and `identity.framework` contain `id`,
`version`, and `revision`; `identity.buildId` is an optional immutable build label.
Unknown values are null. The application ID defaults to package.json name, never
the website directory. For multiplex sites without package.json, supply an ID.

Packaging can supply `THALIA_APPLICATION_ID`, `THALIA_APPLICATION_VERSION`,
`THALIA_BUILD_ID`, `WEBSITE_GIT_HASH` (alias `THALIA_WEBSITE_GIT_HASH`), and
`THALIA_GIT_HASH`. These are explicitly PUBLIC inputs: do not put secrets, internal
paths or hostnames in them. Build IDs must be 1–128 letters, digits, `_` or `-`;
use an opaque immutable pipeline ID, not a timestamp generated on every boot.
Absent/invalid build IDs are null. Revisions accept 7–40 hex characters only.

Valid revision overrides win; next is local Git HEAD (short SHA, when root has
`.git`); then application package.json gitHash or framework .bun-tag, bun.lock,
package-lock.json. Installed metadata is inference, not proof of loaded bytes.
Git runs only at construction, locally, with a timeout; no production Git tree
or network is required. Nested sites without their own Git root report unknown
unless supplied/package metadata exists. Equal revisions need not mean identical
builds. Public identity and legacy hash aliases use seven-character revisions. Protected
revision provenance preserves the resolved value, including a full supplied SHA
when available; local Git resolution uses --short.

## Protected diagnostics

Health adds `diagnostics.capturedAt`, `captureScope: website-construction`, and
`observationScope: this-process-only`. `revisions` records source, precision and
nullable dirty status. Dirty applies only to the startup checkout inspected for
Git-derived revisions; it is unknown for supplied/installed revisions and never
claims that current files match loaded code. It is not a dirty-at-build claim.

`diagnostics.process` contains a process-lifetime random instanceId, optional
`THALIA_DEPLOYMENT_ID`, estimated process start time, actual runtime name/version,
separate Node compatibility version, hostname, PID, environment, platform and
architecture. All timestamps are ISO UTC. Separate collectors must report their
own identity. No token, config dump, SQL parameters or raw exception text is sent.
Machine free-form detail is omitted; errors become stable diagnostic codes.

## Readiness

`db.configured` reflects database configuration, `db.required` reflects that
configuration or an attached database, and `db.connected` reflects SELECT 1.
A configured database remains required if initialisation failed. A database-free
site can be ready. Config load failure always fails readiness. Reconnect progress
remains in `db`. Configured but absent machines, degraded machines and failed
machines fail readiness. `checks` separates success, failure and skipped states;
`readinessReasons` lists the reason codes responsible for failure.

Migration diagnostics retain legacy fields and expose `method: count-only` and
`schemaVerified: false` on completed probes. Missing ledger, pending counts,
ledger ahead, configuration error and query failure have distinct check reasons.
Missing ledgers fail readiness, including when zero SQL files exist. Legacy
`pending` is a count difference, not proven unapplied SQL when the ledger is
missing. A missing config/output directory is explicitly skipped. No migrations,
baselining or schema repairs run. Equal counts never prove schema equivalence.

## Compatibility and rollout

Hostname and NODE_ENV remain public for routine deployment debugging.
Schema 2 deliberately removes public PID, serverMode,
platform, runtime, nodeVersion and processStartTime. Consumers of these must move
to token-authenticated diagnostics before adopting this change. There is no
public compatibility switch for operational fields. Legacy public `websiteName`,
`version`, `gitHash`, `thaliaVersion`, `thaliaGitHash` remain, but websiteName now
means public application ID (nullable), and unknown versions/hashes use
`unknown`. Prefer identity; public hashes remain short. Template
`website.version` remains available for existing templates.

Nexus is not present in this checkout. Its consumers should accept schema 2,
nullable IDs, full hashes and skipped checks, and use readinessReasons instead
of treating every db.connected=false as a failure. Collector provenance remains
a separate Nexus concern. Release notes should call out this contract transition.
