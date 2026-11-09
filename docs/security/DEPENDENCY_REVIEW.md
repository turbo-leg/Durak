# Dependency review

## Production hardening update — 2026-10-26

Updated the compatible Express dependency chain in the lockfile: Express 4.22.3, body-parser 1.20.9, and qs 6.16.1. This removes the reported compressed-body denial-of-service finding in body-parser. No forced Colyseus or Discord SDK major migration was applied.

The current `npm audit --omit=dev --json` reports **14 production package entries: 0 critical, 3 high, 9 moderate, and 2 low**. This production-only scope differs from the historical full dependency audit below. Raw output: `output/fix-audit-production.json` (local, ignored artifact).

The three remaining high package entries require explicit residual-risk review before public release:

- **nanoid 2.x through Colyseus 0.15.** The inspected Colyseus room/session/process/reconnection ID paths call its helper with the fixed default length 9. The advisory paths involve invalid/custom sizes; no client-provided ID size was found in those paths. This is a reachability assessment, not a claim that the package is patched. A blind nanoid 3.x override changes the CommonJS export shape from a callable default to an object and breaks the installed Colyseus helper. A supported framework migration or reviewed compatibility backport remains separate work.
- **Zod through the Discord SDK.** The installed SDK 1.9.0 requires `zod ^3.9.8`. The audit's proposed patched line is Zod 4; overriding that major without adapting the SDK parser is unsafe. Review a supported SDK upgrade or upstream patch and repeat real Discord embedding/authentication checks.
- **The Discord SDK entry** aggregates transitive findings, including Zod; it is not necessarily a separate vulnerability from the Zod entry. Browser-side SDK validation and server-side framework exposure should be assessed separately.

HTTP auth/matchmaking throttling and bounded server admission now reduce untrusted request volume, but do not replace dependency patches. The audit still exits nonzero. Deployment approval must record the residual dependency decision and the results of staging/Discord acceptance.

## Historical audit — 2026-10-20

Inspected 2026-10-20 during multiplayer/Three.js implementation. Evidence is the npm registry audit output in `dependencies-before.json` and `dependencies-after.json` in this directory.

| Audit                   | Critical | High | Moderate | Low | Total |
| ----------------------- | -------- | ---- | -------- | --- | ----- |
| Before compatible fixes | 4        | 13   | 31       | 5   | 53    |
| After compatible fixes  | 0        | 4    | 16       | 3   | 23    |

Ran `npm audit fix --ignore-scripts` without `--force`, then checked the resulting lockfile with tests/typecheck/build. Existing declared version ranges were retained. Three.js and its TypeScript definitions are the new presentation dependencies. Some installed packages have pending install scripts; no blanket script approval was applied.

Compatible updates removed the critical reports involving Capacitor native proxy behavior, proxy-addr and tar, and updated the Vite toolchain. Native iOS/Android builds have not been run, so native runtime compatibility remains unverified.

## Remaining work

- **High: braces / chokidar / nodemon.** The current audit reports no non-breaking fix for this dependency chain. npm proposes downgrading nodemon to 1.x with `--force`; that is not an appropriate automatic migration. Replace the development watcher deliberately or wait for a fixed upstream dependency. This watcher does not run under `start:prod`.
- **High: nanoid in Colyseus 0.15.** npm proposes a major Colyseus/Redis/testing upgrade. Plan a separate protocol/schema migration and repeat all network privacy/reconnect tests. Do not force a framework upgrade into the rendering change.
- **Moderate/low:** remaining reports include Vitest tooling, qs, esbuild and legacy OAuth/UUID/elliptic transitive dependencies. The attempted compatible fixes did not resolve them all. Some are under the legacy Colyseus/Discord dependency trees; evaluate actual reachable paths and upstream fixes before a public release.

`npm audit` still exits nonzero. Zero critical reports does not establish that the dependency tree is clear for release. Raw reports include advisory URLs and affected dependency paths; the counts are a dated snapshot, not a permanent guarantee.
