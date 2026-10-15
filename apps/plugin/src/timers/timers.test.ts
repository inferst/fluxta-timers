import type { Timer, TimerElapsed } from "timers-protocol";
import { describe, expect, it } from "vitest";

import { SettingsStore } from "../store";
import type { Scheduler } from "./scheduler";
import { MAX_SLEEP_MS, Timers } from "./timers";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const START = 1_700_000_000_000;

const GRACE: Timer = {
  id: "t1",
  name: "Grace",
  durationMs: 15 * MINUTE,
  repeatedStart: "restart",
  countdown: { state: "idle" },
};

/**
 * Timers against a clock and a scheduler the test drives. `advance` moves
 * time on and wakes the sidecar whenever it asked to be woken on the way;
 * `sleep` moves the wall clock while the computer is asleep — the pending
 * wake is postponed by as much, as a `setTimeout` is.
 */
function setup(timers: Timer[] = [GRACE]) {
  let now = START;
  let pending: { at: number; wake: () => void } | undefined;
  const fired: TimerElapsed[] = [];
  /** Each fired Timer's state as its Event went out. */
  const statesWhenFired: (string | undefined)[] = [];

  const scheduler: Scheduler = (delayMs, wake) => {
    const entry = { at: now + delayMs, wake };
    pending = entry;
    return () => {
      if (pending === entry) {
        pending = undefined;
      }
    };
  };

  const store = new SettingsStore({ setPluginSettings: async () => {} });
  store.load({ timers });

  return {
    store,
    fired,
    statesWhenFired,
    timers: new Timers(
      store,
      (elapsed) => {
        fired.push(elapsed);
        statesWhenFired.push(store.timer(elapsed.timer)?.countdown.state);
      },
      () => now,
      scheduler,
    ),
    now: () => now,
    pendingDelay: () => (pending ? pending.at - now : undefined),
    advance: (ms: number) => {
      const until = now + ms;

      while (pending && pending.at <= until) {
        const { at, wake } = pending;
        pending = undefined;
        now = at;
        wake();
      }

      now = until;
    },
    sleep: (ms: number) => {
      now += ms;

      if (pending) {
        pending.at += ms;
      }
    },
  };
}

describe("Timers", () => {
  it("fires once, after the duration, and is idle before its Event goes out", async () => {
    const { timers, fired, statesWhenFired, advance } = setup();

    await timers.start("t1");
    advance(15 * MINUTE - 1);
    expect(fired).toEqual([]);

    advance(1);
    expect(fired).toEqual([
      { timer: "t1", count: 1, lateSeconds: 0, missed: 0 },
    ]);
    expect(statesWhenFired).toEqual(["idle"]);

    advance(60 * MINUTE);
    expect(fired).toHaveLength(1);
  });

  it("takes a duration from the step over its own", async () => {
    const { timers, fired, advance } = setup();

    await timers.start("t1", 30 * SECOND);
    advance(30 * SECOND);

    expect(fired).toHaveLength(1);
  });

  it("does not fire once cancelled", async () => {
    const { timers, fired, advance } = setup();

    await timers.start("t1");
    advance(10 * MINUTE);
    expect(await timers.cancel("t1")).toBe(true);
    advance(60 * MINUTE);

    expect(fired).toEqual([]);
    expect(await timers.state("t1")).toBe("idle");
  });

  it("counts down again from the start when started while running", async () => {
    const { timers, fired, advance } = setup();

    await timers.start("t1");
    advance(10 * MINUTE);
    await timers.start("t1");
    advance(10 * MINUTE);
    expect(fired).toEqual([]);

    advance(5 * MINUTE);
    expect(fired).toHaveLength(1);
  });

  it("leaves a running countdown alone when told to ignore a repeated Start", async () => {
    const { timers, fired, advance } = setup([
      { ...GRACE, repeatedStart: "ignore" },
    ]);

    await timers.start("t1");
    advance(10 * MINUTE);
    await timers.start("t1", 60 * MINUTE);
    advance(5 * MINUTE);

    expect(fired).toHaveLength(1);
  });

  it("fires later by the time added, and adds nothing to an idle Timer", async () => {
    const { timers, fired, advance } = setup();

    await timers.addTime("t1", 5 * MINUTE);
    expect(await timers.state("t1")).toBe("idle");

    await timers.start("t1");
    advance(10 * MINUTE);
    await timers.addTime("t1", 5 * MINUTE);
    // Due at 20 minutes now, not 15.
    advance(10 * MINUTE - 1);
    expect(fired).toEqual([]);

    advance(1);
    expect(fired).toHaveLength(1);
  });

  it("knows how long is left while it counts down", async () => {
    const { timers, advance } = setup();

    expect(await timers.remainingMs("t1")).toBeUndefined();
    await timers.start("t1");
    advance(MINUTE + 500);

    expect(await timers.remainingMs("t1")).toBe(14 * MINUTE - 500);
  });

  it("fires, late, a Timer that fell due while Fluxta was closed", () => {
    const { timers, fired } = setup([
      {
        ...GRACE,
        countdown: { state: "running", dueAt: START - 2 * MINUTE - 400 },
      },
    ]);

    timers.fireDue();

    expect(fired).toEqual([
      { timer: "t1", count: 1, lateSeconds: 120, missed: 0 },
    ]);
  });

  it("goes on counting a Timer still due after Fluxta was closed", () => {
    const { timers, fired, advance } = setup([
      { ...GRACE, countdown: { state: "running", dueAt: START + MINUTE } },
    ]);

    timers.fireDue();
    expect(fired).toEqual([]);

    advance(MINUTE);
    expect(fired).toEqual([
      { timer: "t1", count: 1, lateSeconds: 0, missed: 0 },
    ]);
  });

  it("fires soon after the computer wakes from sleeping past the Due Time", async () => {
    const { timers, fired, advance, sleep } = setup();

    await timers.start("t1");
    advance(MINUTE);
    sleep(20 * MINUTE);
    advance(MAX_SLEEP_MS);

    expect(fired).toHaveLength(1);
    expect(fired[0]?.lateSeconds).toBeGreaterThan(5 * 60);
    expect(fired[0]?.lateSeconds).toBeLessThanOrEqual(
      6 * 60 + MAX_SLEEP_MS / SECOND,
    );
  });

  it("sleeps until the earliest Due Time, and not at all when nothing runs", async () => {
    const { timers, store, pendingDelay } = setup([
      GRACE,
      { ...GRACE, id: "t2", name: "Short", durationMs: 10 * SECOND },
    ]);

    timers.fireDue();
    expect(pendingDelay()).toBeUndefined();

    await timers.start("t1");
    expect(pendingDelay()).toBe(MAX_SLEEP_MS);

    await timers.start("t2");
    expect(pendingDelay()).toBe(10 * SECOND);

    await store.removeTimer("t2");
    await timers.cancel("t1");
    expect(pendingDelay()).toBeUndefined();
  });

  it("does nothing for a Timer that is not there, and a deleted one never fires", async () => {
    const { timers, store, fired, advance } = setup();

    expect(await timers.start(undefined)).toBeUndefined();
    expect(await timers.cancel("gone")).toBeUndefined();
    expect(await timers.addTime("gone", MINUTE)).toBeUndefined();
    expect(await timers.state("gone")).toBeUndefined();

    await timers.start("t1");
    await store.removeTimer("t1");
    advance(60 * MINUTE);

    expect(fired).toEqual([]);
  });
});
