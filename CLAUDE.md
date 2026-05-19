# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical: Next.js version

This project runs **Next.js 16.2** with **React 19.2** and **Tailwind v4** — APIs, conventions, and file structure may differ from training data. Before writing non-trivial Next.js / React code, consult `node_modules/next/dist/docs/` and heed deprecation notices. Do not assume App Router behavior matches older versions.

## Commands

```bash
npm run dev              # next dev — local development at http://localhost:3000
npm run build            # next build — produces a static export in ./out (output: "export")
npm run build:analyze    # ANALYZE=true next build — open bundle analyzer report
npm start                # next start
```

There is **no test runner, lint script, or typecheck script** wired up in `package.json`. To typecheck, run `npx tsc --noEmit`. Do not invent test commands.

## Language

Codebase, comments, UI strings, and domain terms are in **Uzbek** (Latin script, occasional Cyrillic). Preserve Uzbek when editing existing code/comments and when adding user-facing text. Domain vocabulary: `uzel` (node/depot), `zapravka` (refueling station), `lokomotiv`, `korxona` (enterprise), `qurulish` (construction), `tamirlash` (repair), `dasturchi` (developer).

## Architecture

This is a Firestore-backed PWA for diesel fuel accounting at Uzbek railway refueling stations. There is no custom backend — the client talks directly to Firestore, and access control is enforced by Firestore security rules in `firestore.rules`.

### Auth model (code-based, not email)

There is no traditional login. Users enter a numeric **access code** (`access_codes/{code}` doc holds `role`, `stationId`, `nodeId`). On successful entry, [lib/utils/session.ts](lib/utils/session.ts) calls `signInAnonymously(auth)` to mint a Firebase UID, then writes `active_sessions/{uid}` mapping that UID back to the code. Firestore rules in [firestore.rules](firestore.rules) resolve permissions by chaining `active_sessions/{auth.uid}` → `access_codes/{code}` → `role` / `stationId`. A copy of the session also lives in `localStorage` (key `uz_temiryo_session`) for client-side route guards.

Three roles: `worker`, `admin`, `developer`. The route-group [app/(main)/layout.tsx](app/(main)/layout.tsx) enforces `/dasturchi/*` → developer-only and `/admin/*` → admin+developer; Firestore rules enforce the same server-side. Always update *both* layers when changing access.

### Route groups

- `app/(auth)/login` — code entry
- `app/(main)/uzellar` — node picker (worker landing)
- `app/(main)/zapravka/[id]` — station-level submission flows
- `app/(main)/admin/*` — reports, approvals
- `app/(main)/dasturchi/*` — codes, limits, questions, variants, audit, bot-test
- `app/seed/page.tsx` — one-time bootstrap UI that writes `uzellar`, `zapravkalar`, and admin/developer codes to Firestore from constants in [lib/data/](lib/data/)

### Firebase init — known quirk

There are **two** Firebase initialization files and they are not interchangeable:

- [firbase.ts](firbase.ts) (note the typo, kept intentionally) at repo root — exports only `db` and `analytics`. Used by [lib/firebase/firestore-service.ts](lib/firebase/firestore-service.ts) (imports `../../firbase`).
- [lib/firebase/config.ts](lib/firebase/config.ts) — exports `db`, `auth`, `storage`. Used by everything that needs auth or storage (e.g. `lib/utils/session.ts`, `app/seed/page.tsx`).

Both call `initializeApp` with the same env-driven config and use a `getApps()` guard, so they coexist as separate Firebase app instances per file. When adding new code, prefer `@/lib/firebase/config` (it has `auth`). Do not "fix" the typo without auditing all importers.

### Submission domain model

Four submission shapes — `LokomotivSubmission`, `KorxonaSubmission`, `QurulishSubmission`, `TamirlashSubmission` — discriminated by `category`, all unioned as `Submission` in [lib/types/index.ts](lib/types/index.ts). All four land in the single `submissions` Firestore collection; reports filter by `category`. Each carries `stationId`/`nodeId` (used by rules to scope worker reads/writes) and limit metadata (`limit`, `isOverLimit`, `oshiqMiqdor`). A 24-hour edit window for non-admins is enforced in `firestore.rules`.

### Service layer

[lib/firebase/](lib/firebase/) contains one service file per Firestore collection (`submissions-service.ts`, `chat-service.ts`, `approval-service.ts`, `limits-service.ts`, etc.). Pages and forms should call these services rather than constructing Firestore queries inline. [lib/firebase/firestore-service.ts](lib/firebase/firestore-service.ts) is the generic CRUD helper used by dynamic forms — note its `sanitize()` strips `undefined` (Firestore rejects it) but preserves `null` and `""` as meaningful values.

### Offline submissions

[lib/offline/offline-storage.ts](lib/offline/offline-storage.ts) stores pending submissions in IndexedDB (`temiryo_offline` DB, `pending_submissions` store) via `idb`. `syncPendingSubmissions(uploadFn)` flushes them; it stops on the first failure (does not skip-and-continue) so a single bad item blocks the queue — keep this in mind when debugging "stuck" syncs. [components/common/online-status.tsx](components/common/online-status.tsx) drives connectivity UI.

### Static export deploy

[next.config.ts](next.config.ts) sets `output: "export"`, `images: { unoptimized: true }`, `trailingSlash: true`. The build emits `./out`, which was historically deployed to Firebase Hosting (`firebase.json` and `.firebaserc` are currently **deleted in the working tree** — a Firebase deploy will fail until they are restored). Because of static export, **no server-side Next.js features** (Route Handlers, Server Actions, dynamic SSR, middleware) will work at runtime; everything must be client-side or build-time.

### Service worker

[app/layout.tsx](app/layout.tsx) inlines a `navigator.serviceWorker.register('/sw.js')` script. The SW file itself is not in this repo — it must be present in `public/` (or `out/`) for PWA install/offline behavior. Manifest is referenced as `/manifest.json`.

### Path alias

`@/*` → repo root (see [tsconfig.json](tsconfig.json)). Imports like `@/lib/...`, `@/components/...`, `@/app/...` are standard.

## When changing Firestore access

A change to a collection's read/write semantics typically requires edits in three places:
1. [firestore.rules](firestore.rules) — server-side enforcement.
2. The matching service in [lib/firebase/](lib/firebase/) — query shape and any `where` clauses must satisfy the rule.
3. The route guard in [app/(main)/layout.tsx](app/(main)/layout.tsx) if a new role-restricted path is added.

Forgetting (1) silently breaks workers in production while admins continue to work (admin reads are unconditional in most rules).
