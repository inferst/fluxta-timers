import { Dialog, SelectField, TextField } from "@fluxta/sdk/ui";
import { useState } from "react";
import {
  formatDuration,
  parseDuration,
  validateDuration,
  validateTimerName,
  type RepeatedStart,
  type Timer,
  type TimerFields,
} from "timers-protocol";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** The Timer being edited. Absent when adding one. */
  timer?: Timer;
  /** Every configured Timer, so a clashing name is caught early. */
  timers: readonly Timer[];
  onSave: (fields: TimerFields) => void;
};

const REPEATED_START_OPTIONS: { value: RepeatedStart; label: string }[] = [
  { value: "restart", label: "Count down again from the start" },
  { value: "ignore", label: "Keep counting down as it was" },
];

type Draft = { name: string; duration: string; repeatedStart: RepeatedStart };

function draftOf(timer: Timer | undefined): Draft {
  return {
    name: timer?.name ?? "",
    duration: timer ? formatDuration(timer.durationMs) : "",
    repeatedStart: timer?.repeatedStart ?? "restart",
  };
}

export function TimerDialog(props: Props) {
  const { open, onOpenChange, title, timer, timers, onSave } = props;
  const [draft, setDraft] = useState(() => draftOf(timer));
  const set =
    <K extends keyof Draft>(key: K) =>
    (value: Draft[K]) =>
      setDraft((current) => ({ ...current, [key]: value }));

  // A reopened dialog shows the Timer as it stands now, not whatever was last
  // typed into it — reset while rendering the opening, which React prefers
  // over an effect that would render the stale value first.
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);

    if (open) {
      setDraft(draftOf(timer));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      onSubmit={() => {
        const problem =
          validateTimerName(draft.name, timers, timer?.id) ??
          validateDuration(draft.duration);

        if (problem) {
          return problem;
        }

        onSave({
          name: draft.name.trim(),
          durationMs: parseDuration(draft.duration)!,
          repeatedStart: draft.repeatedStart,
        });
      }}
    >
      <TextField
        label="Name"
        value={draft.name}
        onChange={set("name")}
        placeholder="Grace period"
        hint="Shown wherever a step, a condition or an Event picks this Timer."
      />
      <TextField
        label="Duration"
        value={draft.duration}
        onChange={set("duration")}
        placeholder="15:00"
        hint="Seconds (900) or a clock time (15:00, 1:30:00). Start Timer can count a different one."
      />
      <SelectField
        label="When started while running"
        options={REPEATED_START_OPTIONS}
        value={draft.repeatedStart}
        onChange={(value) => set("repeatedStart")(value as RepeatedStart)}
        hint={
          timer?.countdown.state === "running"
            ? "The countdown under way is not changed — a new duration counts from the next Start."
            : undefined
        }
      />
    </Dialog>
  );
}
