# Fluxta Timers

A [Fluxta](https://fluxta.app) plugin with named Stopwatches for scenario
builders: they count time across pauses, keep counting while Fluxta is
closed, and hand the time to later steps — for example, to post how long a
stream lasted without the minutes it was down. Countdown Timers that fire an
Event when they run out are to follow.

## Stopwatches

Open the Timers plugin's settings in Fluxta and **Add Stopwatch** with a name.
Each one shows whether it is idle, running or paused, and the time it has
counted. Under **Language**, choose whether durations in words read
`2 h 14 min` or `2 ч 14 мин`.

| Action              | What it does                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| **Start Stopwatch** | Starts an idle Stopwatch or resumes a paused one. A running one is left as it is.                   |
| **Pause Stopwatch** | Stops it counting and produces the time it has counted.                                             |
| **Read Stopwatch**  | Produces the time it has counted, changing nothing.                                                 |
| **Reset Stopwatch** | Puts it back to idle and produces the time it had counted _before_ — closing a session in one step. |

Pause, Read and Reset produce the time three ways: **Elapsed** (`2:14:05`),
**Elapsed in Words** (`2 h 14 min` — a unit that is zero is left out, so
`45 min`) and **Elapsed Seconds**. A later step reads them as Run Variables,
for example `{{timers.reset-stopwatch.elapsedWords}}`.

An **If/Else** can branch on **Stopwatch State** — idle, running or paused —
to tell a session that has not begun from one that is only paused.

A Stopwatch counts wall-clock time: one left running while Fluxta is closed
includes that time when it is read again. A step pointed at a Stopwatch that
was deleted does nothing.

## Development

```bash
pnpm install
pnpm build        # builds dist/timers/ and restarts the plugin in a running Fluxta
pnpm dev          # rebuild on change
pnpm test
pnpm lint && pnpm format:check
```

See [`AGENTS.md`](./AGENTS.md) for how the package is put together, and
Fluxta's [plugin docs](https://fluxta.app/docs/plugins) for the Plugin API.

## Releasing

`.github/workflows/release.yml` watches `manifest.json` on `main`. Push a
commit that bumps its `version`, and — once the `v<version>` tag doesn't
already exist — the workflow builds the plugin, packages it with
`fluxta package`, tags the commit, and opens a **draft** GitHub Release with
the zip attached. Publishing to Fluxta's catalog is `pnpm exec fluxta publish`.
