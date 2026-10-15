import { z } from "zod";

import { DURATION_MAX_MS } from "./duration";
import { validateName } from "./names";

/**
 * Whether a Timer is counting down. `dueAt` is its Due Time, wall-clock epoch
 * milliseconds: persisted as such, so a Timer keeps counting while Fluxta is
 * closed, and one that fell due meanwhile fires as soon as the plugin is
 * back.
 */
export type Countdown = { state: "idle" } | { state: "running"; dueAt: number };

export type TimerState = Countdown["state"];

export const TIMER_STATES = [
  "idle",
  "running",
] as const satisfies readonly TimerState[];

export const IDLE_COUNTDOWN: Countdown = { state: "idle" };

/**
 * What Start does to a Timer that is already running: count down again from
 * the start, or leave it be.
 */
export type RepeatedStart = "restart" | "ignore";

export const REPEATED_STARTS = [
  "restart",
  "ignore",
] as const satisfies readonly RepeatedStart[];

/** One named Timer, as persisted and as every editor sees it. */
export type Timer = {
  id: string;
  name: string;
  durationMs: number;
  repeatedStart: RepeatedStart;
  countdown: Countdown;
};

export const DurationMsSchema = z
  .number()
  .int()
  .positive()
  .max(DURATION_MAX_MS);

export const RepeatedStartSchema = z.enum(REPEATED_STARTS);

export const CountdownSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("idle") }),
  z.object({ state: z.literal("running"), dueAt: z.number().finite() }),
]);

export const TimerSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  durationMs: DurationMsSchema,
  repeatedStart: RepeatedStartSchema,
  countdown: CountdownSchema,
});

/**
 * How long a Timer has left at `now` — `undefined` when it is not counting
 * down. A Due Time already passed reads as zero: the Timer fires on the
 * sidecar's next wake.
 */
export function remainingMs(
  countdown: Countdown,
  now: number,
): number | undefined {
  return countdown.state === "running"
    ? Math.max(0, countdown.dueAt - now)
    : undefined;
}

/** Refuses a name the plugin would refuse — see {@link validateName}. */
export function validateTimerName(
  name: string,
  others: readonly Pick<Timer, "id" | "name">[],
  editingId?: string,
): string | undefined {
  return validateName("Timer", name, others, editingId);
}

export const TIMER_ELAPSED_EVENT = "timer-elapsed";

/**
 * The fields of a `timer-elapsed` Event, as `manifest.json` declares them.
 * A one-shot Timer fires once per countdown, so `count` is 1 and `missed`
 * 0; `lateSeconds` says how long after its Due Time it fired — more than a
 * moment only when the plugin was not running then.
 */
export type TimerElapsed = {
  timer: string;
  count: number;
  lateSeconds: number;
  missed: number;
};
