import { describe, expect, it } from "vitest";

import { isEditorMessage, isPluginMessage } from "./messages";

describe("isEditorMessage", () => {
  it("accepts every message an editor sends", () => {
    for (const message of [
      { event: "get-status" },
      { event: "create-stopwatch", name: "On air" },
      { event: "rename-stopwatch", id: "s1", name: "Break" },
      { event: "delete-stopwatch", id: "s1" },
      { event: "set-language", language: "ru" },
    ]) {
      expect(isEditorMessage(message)).toBe(true);
    }
  });

  it("refuses an unknown event or a malformed one", () => {
    expect(isEditorMessage({ event: "start-stopwatch", id: "s1" })).toBe(false);
    expect(isEditorMessage({ event: "create-stopwatch" })).toBe(false);
    expect(isEditorMessage({ event: "set-language", language: "de" })).toBe(
      false,
    );
    expect(isEditorMessage("get-status")).toBe(false);
    expect(isEditorMessage(null)).toBe(false);
  });
});

describe("isPluginMessage", () => {
  it("accepts what the sidecar sends and nothing else", () => {
    expect(
      isPluginMessage({
        event: "status",
        status: { stopwatches: [], language: "en" },
      }),
    ).toBe(true);
    expect(isPluginMessage({ event: "stopwatch-refused", message: "…" })).toBe(
      true,
    );
    expect(isPluginMessage({ event: "get-status" })).toBe(false);
    expect(isPluginMessage(undefined)).toBe(false);
  });
});
