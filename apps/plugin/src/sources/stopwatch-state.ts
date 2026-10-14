import type { Source, SourceContext } from "@fluxta/sdk/api";

import type { Stopwatches } from "../stopwatches/stopwatches";

export const STOPWATCH_STATE_SOURCE = "stopwatchState";

/**
 * Pull Query Source: whether the Stopwatch named by the `stopwatch` param is
 * `idle`, `running` or `paused`. Absent for a Stopwatch that no longer
 * exists, so a condition on it takes its `else` branch.
 */
export function createStopwatchStateSource(stopwatches: Stopwatches): Source {
  return {
    key: STOPWATCH_STATE_SOURCE,
    resolve: async (ctx: SourceContext) =>
      (await stopwatches.state(stopwatchArg(ctx.args))) ?? null,
  };
}

/** The Source's one param — see manifest `sources[].params`. */
function stopwatchArg(args: unknown): string | undefined {
  if (typeof args !== "object" || args === null || Array.isArray(args)) {
    return undefined;
  }

  const value = (args as Record<string, unknown>)["stopwatch"];
  return typeof value === "string" ? value : undefined;
}
