import { describe, expect, it } from "vitest";

import { formatClock, formatWords, snapshotOf } from "./elapsed";

const at = (hours: number, minutes: number, seconds: number) =>
  ((hours * 60 + minutes) * 60 + seconds) * 1000;

describe("formatClock", () => {
  it("writes H:MM:SS, hours uncapped", () => {
    expect(formatClock(at(2, 14, 5))).toBe("2:14:05");
    expect(formatClock(at(0, 45, 0))).toBe("0:45:00");
    expect(formatClock(at(26, 0, 0))).toBe("26:00:00");
    expect(formatClock(0)).toBe("0:00:00");
  });

  it("rounds down to the second", () => {
    expect(formatClock(at(0, 0, 59) + 999)).toBe("0:00:59");
  });
});

describe("formatWords", () => {
  it("writes hours and minutes, without seconds", () => {
    expect(formatWords(at(2, 14, 5), "en")).toBe("2 h 14 min");
    expect(formatWords(at(2, 14, 5), "ru")).toBe("2 ч 14 мин");
  });

  it("leaves out a unit that is zero", () => {
    expect(formatWords(at(0, 45, 0), "en")).toBe("45 min");
    expect(formatWords(at(2, 0, 30), "en")).toBe("2 h");
    expect(formatWords(at(3, 0, 0), "ru")).toBe("3 ч");
  });

  it("falls back to seconds under a minute", () => {
    expect(formatWords(at(0, 0, 30), "en")).toBe("30 sec");
    expect(formatWords(0, "en")).toBe("0 sec");
    expect(formatWords(at(0, 0, 7), "ru")).toBe("7 сек");
  });

  it("rounds down, so it agrees with the clock", () => {
    expect(formatWords(at(1, 59, 59), "en")).toBe("1 h 59 min");
  });
});

describe("snapshotOf", () => {
  it("gives all three forms of the same time", () => {
    expect(snapshotOf(at(2, 14, 5) + 400, "en")).toEqual({
      elapsed: "2:14:05",
      elapsedWords: "2 h 14 min",
      elapsedSeconds: 8045,
    });
  });
});
