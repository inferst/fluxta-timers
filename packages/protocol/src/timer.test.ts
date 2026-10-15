import { describe, expect, it } from "vitest";

import {
  elapse,
  IDLE_COUNTDOWN,
  remainingMs,
  startCountdown,
  TimerSchema,
  validateTimerName,
  type RunningCountdown,
} from "./timer";

const MINUTE = 60_000;

const grace = {
  id: "t1",
  name: "Grace",
  durationMs: 15 * MINUTE,
  repeatedStart: "restart",
  repeat: false,
  maxTimes: null,
} as const;

const water = { ...grace, repeat: true, durationMs: 30 * MINUTE };

/** A countdown of every 30 minutes, started at 0, in its `cycle`th cycle. */
function every30(cycle: number, lastCycle: number | null): RunningCountdown {
  const scheduledAt = cycle * 30 * MINUTE;
  return {
    state: "running",
    cycle,
    scheduledAt,
    dueAt: scheduledAt,
    intervalMs: 30 * MINUTE,
    lastCycle,
  };
}

describe("startCountdown", () => {
  it("counts the Timer's own duration once, for a one-shot Timer", () => {
    expect(startCountdown({ ...grace, maxTimes: 4 }, 1_000)).toEqual({
      state: "running",
      cycle: 1,
      scheduledAt: 1_000 + 15 * MINUTE,
      dueAt: 1_000 + 15 * MINUTE,
      intervalMs: 15 * MINUTE,
      lastCycle: 1,
    });
  });

  it("repeats a step's duration, as many times as the Timer allows", () => {
    expect(startCountdown({ ...water, maxTimes: 4 }, 0, MINUTE)).toMatchObject({
      dueAt: MINUTE,
      intervalMs: MINUTE,
      lastCycle: 4,
    });
    expect(startCountdown(water, 0).lastCycle).toBeNull();
  });
});

describe("elapse", () => {
  it("fires a cycle on time and goes on to the next on the schedule", () => {
    const fired = elapse(every30(1, null), 30 * MINUTE + 250);

    expect(fired).toEqual({
      count: 1,
      missed: 0,
      lateMs: 250,
      next: every30(2, null),
    });
  });

  it("follows the schedule, not the moment a cycle fired", () => {
    // Fired 20 seconds late: the next cycle is still at 60 minutes.
    expect(elapse(every30(1, null), 30 * MINUTE + 20_000).next).toEqual(
      every30(2, null),
    );
  });

  it("is idle once the last cycle has fired", () => {
    expect(elapse(every30(4, 4), 120 * MINUTE).next).toBe(IDLE_COUNTDOWN);
    expect(elapse(every30(1, 1), 30 * MINUTE).next).toBe(IDLE_COUNTDOWN);
  });

  it("fires once for the cycles it slept through, late from the latest", () => {
    // Due at 30, 60, 90 and 120 minutes; awake again at 125.
    const fired = elapse(every30(1, null), 125 * MINUTE);

    expect(fired).toEqual({
      count: 4,
      missed: 3,
      lateMs: 5 * MINUTE,
      next: every30(5, null),
    });
  });

  it("does not let cycles past the last one fall due", () => {
    // Four times every 30 minutes — over at 120 minutes, whatever the hour.
    const fired = elapse(every30(1, 4), 300 * MINUTE);

    expect(fired).toEqual({
      count: 4,
      missed: 3,
      lateMs: 180 * MINUTE,
      next: IDLE_COUNTDOWN,
    });
  });

  it("measures a moved cycle from its Due Time, and keeps the next on the schedule", () => {
    const moved = { ...every30(1, null), dueAt: 35 * MINUTE };

    expect(elapse(moved, 35 * MINUTE)).toEqual({
      count: 1,
      missed: 0,
      lateMs: 0,
      next: every30(2, null),
    });
  });
});

describe("remainingMs", () => {
  it("counts down to the Due Time and stops at zero", () => {
    const countdown = { ...every30(1, 1), dueAt: 10_000 };

    expect(remainingMs(countdown, 4_000)).toBe(6_000);
    expect(remainingMs(countdown, 12_000)).toBe(0);
  });

  it("is undefined for a Timer that is not counting down", () => {
    expect(remainingMs(IDLE_COUNTDOWN, 0)).toBeUndefined();
  });
});

describe("TimerSchema", () => {
  it("reads both states back from persisted JSON", () => {
    for (const countdown of [IDLE_COUNTDOWN, every30(3, 4), every30(1, null)]) {
      expect(TimerSchema.safeParse({ ...water, countdown }).success).toBe(true);
    }
  });

  it("refuses a Timer it cannot make sense of", () => {
    for (const timer of [
      { ...grace, countdown: { state: "running", dueAt: 0 } },
      { ...grace, countdown: { ...every30(1, 1), dueAt: 0 } },
      { ...grace, countdown: { ...every30(1, 1), state: "paused" } },
      { ...grace, durationMs: 0, countdown: IDLE_COUNTDOWN },
      { ...grace, maxTimes: 0, countdown: IDLE_COUNTDOWN },
      { ...grace, repeatedStart: "queue", countdown: IDLE_COUNTDOWN },
    ]) {
      expect(TimerSchema.safeParse(timer).success).toBe(false);
    }
  });
});

describe("validateTimerName", () => {
  it("names the Timer in what it refuses", () => {
    expect(validateTimerName("Break", [grace])).toBeUndefined();
    expect(validateTimerName("", [])).toBe("Give this Timer a name.");
    expect(validateTimerName("Grace", [grace])).toBe(
      'Another Timer is already named "Grace".',
    );
    expect(validateTimerName("Grace", [grace], "t1")).toBeUndefined();
  });
});
