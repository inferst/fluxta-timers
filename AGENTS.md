# AGENTS.md

This document provides instructions for agentic coding agents working in this repository.

## Project Overview

Fluxta Timers is a [Fluxta](https://fluxta.app) plugin that measures time for scenarios. Its **Stopwatches** count time across pauses, keep counting while Fluxta is closed, and hand their Elapsed Time to later steps; an If/Else can ask whether one is idle, running or paused. The typical use is a stream session: start on "on air", pause on "off air", reset when the stream is over and post how long it lasted. Countdown **Timers** that fire an Event are to follow (see `CONTEXT.md`).

It is a pnpm workspace (turbo) of three TypeScript packages. The Plugin API it builds against — `@fluxta/sdk` and the `fluxta` CLI from `@fluxta/cli` — is owned by Fluxta, not by this repo (see [Working against Fluxta](#working-against-fluxta)).

## Commands

### Setup

```bash
pnpm install     # Node ≥ 22.18, the pnpm version pinned in package.json
```

### Development & Build

```bash
pnpm build          # wipe dist/ and build the editors and the sidecar into dist/timers/
pnpm dev            # build the editors once, then watch both apps
pnpm typecheck      # tsc --noEmit in every package
pnpm test           # vitest in apps/plugin and packages/protocol
pnpm lint           # eslint over the whole workspace
pnpm format         # prettier --write; `pnpm format:check` only checks
```

`fluxta publish` runs `lint` and `format:check` itself and stops if either fails.

### Target a specific package

```bash
pnpm --filter timers-plugin test
pnpm --filter timers-protocol test
pnpm --filter timers-editor build
```

### Run it in Fluxta

`dist/timers/` is the build folder Fluxta loads (see Fluxta's [Development](https://fluxta.app/docs/plugins/getting-started/development) guide). Every successful sidecar build — `pnpm build` included — ends with `fluxta restart`, which, while Fluxta is running, links this build and restarts the plugin in it.

```bash
pnpm exec fluxta link dist/timers   # a development link to this build
pnpm dev                            # every successful sidecar build runs `fluxta restart`
pnpm exec fluxta link --status      # what is linked
pnpm exec fluxta unlink             # back to the installed package
```

Editor-only rebuilds restart nothing — reopen the editor in Fluxta to see them. The sidecar logs to `dist/timers/logs/timers.log`; `pnpm build` wipes `dist/` and the log with it.

## Architecture

### Packages

- `apps/plugin` (`timers-plugin`) — the Plugin sidecar: the Node.js process Fluxta starts. tsdown bundles it into `dist/timers/index.mjs` and copies `manifest.json` and `icons/` beside it.
- `apps/editor` (`timers-editor`) — the editors, React + Vite + Tailwind, built into `dist/timers/editor/`: the Plugin Editor (`plugin.html`, the Stopwatches and the language in Fluxta's settings) and the Action Editors.
- `packages/protocol` (`timers-protocol`) — what the sidecar and the editors share: a Stopwatch, its timing and the pure arithmetic on it (`stopwatch.ts`), Elapsed Time's three forms and the language setting (`elapsed.ts`), the editor ↔ sidecar messages (`messages.ts`, each an object with an `event` discriminant, checked with zod), and every Action's settings type (`actions.ts`). Consumed as TypeScript source; it has no build.

### Plugin sidecar (`apps/plugin/src`)

```
index.ts          composition root: store, Stopwatches, Actions, Source, Options, editor messages, publish()
plugin.ts         the single `Plugin` instance from @fluxta/sdk/api
store.ts          Plugin Settings — read once at startup, then written only by this process
stopwatches/      what a step does to a named Stopwatch, against an injected clock
actions/          one StandaloneAction per manifest Action, file named after its `type`
sources/          the Query Source `stopwatchState`
options/          the Options Sources its param and operand pick from
```

Every change goes through `store.ts`, which calls `onChange` → `index.ts` `publish()` → every open editor.

### Editors (`apps/editor`)

- One HTML entry per editor at the package root, each mounting `src/<editor>/main.tsx`. Fluxta never tells an editor which Action it edits — it only serves the path the manifest names — so Actions that need the same settings share a page: Start, Pause, Reset and Read Stopwatch all use `stopwatch.html`. `vite.config.ts` picks up every `*.html` on its own.
- Editors are built from Fluxta's [UI Kit](https://fluxta.app/docs/plugins/reference/ui-kit) (`@fluxta/sdk/ui`) and read the Stopwatches from the sidecar through `timers-protocol` messages (`src/shared/useEditorStatus.ts`). A running Stopwatch's time is worked out in the editor from its `runningSince` (`src/shared/useNow.ts`); the sidecar does not tick.

## Key Conventions

- **Manifest and code change together.** `manifest.json` declares every Action (with its `produces`), Source and the Options Sources they name, and the code registers exactly those, by the same `type` / `key`. Adding an Action means: its manifest entry, `apps/plugin/src/actions/<type>.ts` with tests, its registration in `index.ts`, its settings type in `timers-protocol`, an Action Editor page (or an existing one, when the settings are the same) and an icon in `icons/`.
- **Naming in the manifest** ([manifest reference](https://fluxta.app/docs/plugins/reference/manifest)): every kind — an Action `type` — is kebab-case (`reset-stopwatch`); every key — a Source, a produced value, a param, an Options Source — is camelCase (`stopwatchState`, `elapsedWords`, `stopwatchStates`).
- **The sidecar is the only writer of Plugin Settings, and reads them once.** Editors ask the sidecar for every change. Fluxta echoes each write back to the plugin, and an echo can arrive after a newer change was made in memory, so the store never takes settings in after startup — doing so would briefly undo a Start or a Pause. Everything that reads the store waits for `store.loaded` first: Fluxta may ask for an Action or a Source before the settings arrive.
- **Wall-clock time, never ticks.** A Stopwatch stores when it started running and what it counted before; its Elapsed Time is worked out when asked. Nothing in the sidecar runs on an interval, and a Stopwatch keeps counting while the process is down.
- **Steps never fail.** An Action whose Stopwatch is unset or deleted logs a `console.warn` and produces no values; the Source answers `null` (absent), which sends an If/Else to its `else` branch. A failed settings write is logged, and the change still holds in memory.
- **The clock is injected.** `Stopwatches` takes `now()`; tests move it by hand. No test sleeps or reads the real clock.
- **The sidecar bundle is self-contained.** Fluxta runs it with a bundled Node and no `node_modules`, so tsdown inlines every non-builtin dependency (`noExternal`). Do not externalize one.
- **File naming**: the sidecar and `timers-protocol` use kebab-case (`reset-stopwatch.ts`, `stopwatch-state.ts`). In the editors, React components are PascalCase (`StopwatchRow.tsx`), hooks are `useThing.ts`.
- **Tests**: vitest, colocated `*.test.ts`. The arithmetic and formatting are tested in `timers-protocol`; the store against a fake settings writer; Actions, the Source and the Options Sources against a real store loaded with fixtures.
- **Comments say why** — the Fluxta behaviour that forces the code — and use the capitalized terms of `CONTEXT.md` and Fluxta's [Terminology](https://fluxta.app/docs/plugins/getting-started/terminology). A "run" in a comment is Fluxta's run of a program, never a Stopwatch's.

## Working against Fluxta

- **Fluxta owns the Plugin API contract**: `@fluxta/sdk`, the manifest schema and the `fluxta` CLI, documented at [fluxta.app/docs/plugins](https://fluxta.app/docs/plugins). When this plugin needs something they do not offer, do not work around the contract or patch `node_modules`: record the need in an issue here, label it `ready-for-human`, and stop — a person takes it to Fluxta (see `docs/agents/issue-tracker.md`). Once a release of the SDK or CLI provides it, it is adopted here.
- **The SDK and the CLI come from npm**, pinned once in the `catalog:` of `pnpm-workspace.yaml`; every package says `"catalog:"`. The installed typings — `apps/plugin/node_modules/@fluxta/sdk/dist/api.d.mts` (sidecar) and `ui.d.mts` (editors) — are the contract at the version in use; Fluxta's own working tree may be ahead of it.
- **Adopting a new SDK or CLI version**: bump its `catalog:` entry, add the exact version to `minimumReleaseAgeExclude` if pnpm refuses it as too young, `pnpm install`, and commit `pnpm-workspace.yaml` and `pnpm-lock.yaml` together.
- **Versions and publication**: the plugin's version is `version` in `manifest.json`. `pnpm exec fluxta publish` validates the package and opens a pull request to Fluxta's trusted catalog (`fluxta/plugins`). The catalog can hold a newer version than this repo, and `fluxta publish` merges against it rather than overwriting it. See Fluxta's [Publishing](https://fluxta.app/docs/plugins/getting-started/publishing) guide. Pushing a `version` bump to `main` also tags a draft GitHub Release (`.github/workflows/release.yml`).
- **Publishing is the user's call.** Run `fluxta publish` only when the user asks for it in the conversation.

## Commits

- [Conventional Commits](https://www.conventionalcommits.org/) without a scope, lowercase and imperative: `feat: named Stopwatches that count across pauses`, `fix: …`, `chore: bump version`.

## Agent skills

- Issues: GitHub Issues at `inferst/fluxta-timers`. See `docs/agents/issue-tracker.md`.
- Triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.
- Domain: `CONTEXT.md`, plus Fluxta's plugin docs. See `docs/agents/domain.md`.
