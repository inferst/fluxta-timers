# AGENTS.md

This document provides instructions for agentic coding agents working in this repository.

## Project Overview

Fluxta Timers is a [Fluxta](https://fluxta.app) plugin that measures time for scenarios. Its **Timers** count down and fire the `timer-elapsed` Event when they run out — even if that happened while Fluxta was closed, as soon as it is back. Its **Stopwatches** count time across pauses, keep counting while Fluxta is closed, and hand their Elapsed Time to later steps; an If/Else can ask whether either is running. The typical use is a stream session: a Stopwatch starts on "on air" and pauses on "off air", a Timer gives the stream fifteen minutes to come back, and when it fires the session is over and its length posted. See `CONTEXT.md`.

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
- `apps/editor` (`timers-editor`) — the editors, React + Vite + Tailwind, built into `dist/timers/editor/`: the Plugin Editor (`plugin.html`, the Timers, the Stopwatches and the language in Fluxta's settings) and the Action Editors.
- `packages/protocol` (`timers-protocol`) — what the sidecar and the editors share: a Timer, its countdown with the pure arithmetic of its Schedule (`startCountdown`, `elapse`) and the `timer-elapsed` fields (`timer.ts`), reading and writing a Duration (`duration.ts`), a Stopwatch, its timing and the pure arithmetic on it (`stopwatch.ts`), Elapsed Time's three forms and the language setting (`elapsed.ts`), the name rules both share (`names.ts`), the editor ↔ sidecar messages (`messages.ts`, each an object with an `event` discriminant, checked with zod), and every Action's settings type (`actions.ts`). Consumed as TypeScript source; it has no build.

### Plugin sidecar (`apps/plugin/src`)

```
index.ts          composition root: store, Timers, Stopwatches, Actions, Sources, Options, editor messages, publish()
plugin.ts         the single `Plugin` instance from @fluxta/sdk/api
store.ts          Plugin Settings — read once at startup, then written only by this process
clock.ts          the injected wall clock
timers/           what a step does to a named Timer, and the one wake that fires them (scheduler.ts)
stopwatches/      what a step does to a named Stopwatch
actions/          one StandaloneAction per manifest Action, file named after its `type`
sources/          the Query Sources `timerState`, `remainingSeconds`, `stopwatchState`
options/          the Options Sources their params, operands and the Event's `timer` field pick from
```

Every change goes through `store.ts`, which calls `onChange` → `index.ts` `publish()` → every open editor.

### Editors (`apps/editor`)

- One HTML entry per editor at the package root, each mounting `src/<editor>/main.tsx`. Fluxta never tells an editor which Action it edits — it only serves the path the manifest names — so Actions that need the same settings share a page: Start, Pause, Reset and Read Stopwatch all use `stopwatch.html`; Cancel Timer has `timer.html`, Start Timer `start-timer.html` and Add Time `add-time.html`. `vite.config.ts` picks up every `*.html` on its own.
- Editors are built from Fluxta's [UI Kit](https://fluxta.app/docs/plugins/reference/ui-kit) (`@fluxta/sdk/ui`) and read the Timers and Stopwatches from the sidecar through `timers-protocol` messages (`src/shared/useEditorStatus.ts`). A running Stopwatch's time and a running Timer's time left are worked out in the editor from `runningSince` and `dueAt` (`src/shared/useNow.ts`); the sidecar reports only changes, never ticks.
- A duration field in an Action Editor is a `TemplateField`, so it can hold a `{{…}}` reference; it is judged as a Duration only when it holds none (`src/shared/durationFieldError.ts`).

## Key Conventions

- **Manifest and code change together.** `manifest.json` declares every Action (with its `produces`), Source and the Options Sources they name, and the code registers exactly those, by the same `type` / `key`. Adding an Action means: its manifest entry, `apps/plugin/src/actions/<type>.ts` with tests, its registration in `index.ts`, its settings type in `timers-protocol`, an Action Editor page (or an existing one, when the settings are the same) and an icon in `icons/`.
- **Naming in the manifest** ([manifest reference](https://fluxta.app/docs/plugins/reference/manifest)): every kind — an Action or Event `type` — is kebab-case (`reset-stopwatch`, `timer-elapsed`); every key — a Source, a produced value, a param, an Event Field, an Options Source — is camelCase (`stopwatchState`, `elapsedWords`, `lateSeconds`, `stopwatchStates`).
- **The sidecar is the only writer of Plugin Settings, and reads them once.** Editors ask the sidecar for every change. Fluxta echoes each write back to the plugin, and an echo can arrive after a newer change was made in memory, so the store never takes settings in after startup — doing so would briefly undo a Start or a Pause, or bring back a Timer that has just fired. Everything that reads the store waits for `store.loaded` first: Fluxta may ask for an Action or a Source before the settings arrive.
- **Wall-clock time, persisted.** A Stopwatch stores when it started running and what it counted before; a Timer stores its Due Time. What they show is worked out when asked, and both go on counting while the process is down.
- **One wake, only while a Timer runs.** `Timers` holds a single scheduled wake, for the earliest Due Time but never more than `MAX_SLEEP_MS` away: a `setTimeout` stops counting while the computer sleeps, and the wall clock does not. Whatever is due when it wakes fires; a Timer cancelled or deleted meanwhile is simply not found. With no Timer running, nothing in the sidecar is scheduled. Timers that fell due while Fluxta was closed fire after the settings load — after `connect()`, or their Events would go nowhere.
- **A fired Timer is in its next Cycle, or idle, before its Event goes out**, so a step reacting to `timer-elapsed` sees what comes next and can start an idle one again.
- **The Schedule is taken at Start.** A running countdown carries its own interval and last Cycle, so editing the Timer changes nothing until the next Start; the next Cycle is counted from the current one's place on the Schedule (`scheduledAt`), never from when it fired or from an Add Time (`dueAt`).
- **Steps never fail.** An Action whose Timer or Stopwatch is unset or deleted logs a `console.warn` and produces no values; a Source answers `null` (absent), which sends an If/Else to its `else` branch. A step's duration that is not one is logged: Start counts the Timer's own, Add Time adds nothing. A failed settings write is logged, and the change still holds in memory.
- **The clock and the scheduler are injected.** `Timers` and `Stopwatches` take `now()`, and `Timers` a `Scheduler`; tests move time by hand and decide when the wake comes, including a computer that slept. No test sleeps or reads the real clock.
- **The sidecar bundle is self-contained.** Fluxta runs it with a bundled Node and no `node_modules`, so tsdown inlines every non-builtin dependency (`noExternal`). Do not externalize one.
- **File naming**: the sidecar and `timers-protocol` use kebab-case (`reset-stopwatch.ts`, `stopwatch-state.ts`). In the editors, React components are PascalCase (`StopwatchRow.tsx`), hooks are `useThing.ts`, other helpers camelCase (`durationFieldError.ts`).
- **Tests**: vitest, colocated `*.test.ts`. The arithmetic, parsing and formatting are tested in `timers-protocol`; the store against a fake settings writer; `Timers`, `Stopwatches`, the Actions, the Sources and the Options Sources against a real store loaded with fixtures.
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
