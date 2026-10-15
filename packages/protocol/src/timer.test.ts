import { describe, expect, it } from "vitest";

import {
  IDLE_COUNTDOWN,
  remainingMs,
  TimerSchema,
  validateTimerName,
} from "./timer";

const grace = {
  id: "t1",
  name: "Grace",
  durationMs: 900_000,
  repeatedStart: "restart",
};

describe("remainingMs", () => {
  it("counts down to the Due Time and stops at zero", () => {
    const countdown = { state: "running", dueAt: 10_000 } as const;

    expect(remainingMs(countdown, 4_000)).toBe(6_000);
    expect(remainingMs(countdown, 12_000)).toBe(0);
  });

  it("is undefined for a Timer that is not counting down", () => {
    expect(remainingMs(IDLE_COUNTDOWN, 0)).toBeUndefined();
  });
});

describe("TimerSchema", () => {
  it("reads both states back from persisted JSON", () => {
    for (const countdown of [
      IDLE_COUNTDOWN,
      { state: "running", dueAt: 1_700_000_000_000 },
    ]) {
      expect(TimerSchema.safeParse({ ...grace, countdown }).success).toBe(true);
    }
  });

  it("refuses a Timer it cannot make sense of", () => {
    for (const timer of [
      { ...grace, countdown: { state: "running" } },
      { ...grace, countdown: { state: "paused", dueAt: 0 } },
      { ...grace, durationMs: 0, countdown: IDLE_COUNTDOWN },
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
