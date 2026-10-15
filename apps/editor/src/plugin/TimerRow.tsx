import {
  Button,
  ListRow,
  StatusBadge,
  useConfirm,
  type StatusTone,
} from "@fluxta/sdk/ui";
import { useState } from "react";
import {
  formatDuration,
  remainingMs,
  type EditorMessage,
  type Timer,
  type TimerState,
} from "timers-protocol";

import { useNow } from "../shared/useNow";
import { TimerDialog } from "./TimerDialog";

type Props = {
  timer: Timer;
  timers: readonly Timer[];
  send: (message: EditorMessage) => void;
};

const TONES: Record<TimerState, StatusTone> = {
  idle: "idle",
  running: "ok",
};

const LABELS: Record<TimerState, string> = {
  idle: "Idle",
  running: "Running",
};

export function TimerRow({ timer, timers, send }: Props) {
  const [editing, setEditing] = useState(false);
  const confirm = useConfirm();
  const { countdown } = timer;
  const now = useNow(countdown.state === "running");
  const left = remainingMs(countdown, now);

  return (
    <>
      <ListRow
        title={timer.name}
        badges={
          <StatusBadge tone={TONES[countdown.state]}>
            {LABELS[countdown.state]}
          </StatusBadge>
        }
        description={
          left === undefined
            ? `Counts down ${formatDuration(timer.durationMs)}`
            : // Rounded up, as a countdown reads: 0:00 only once it fires.
              `${formatDuration(Math.ceil(left / 1000) * 1000)} left`
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                const sure = await confirm({
                  title: `Delete "${timer.name}"?`,
                  description:
                    "It will not fire, and every step, condition and Event pointed at this Timer will do nothing until it is given another one.",
                  confirmLabel: "Delete",
                  destructive: true,
                });

                if (sure) {
                  send({ event: "delete-timer", id: timer.id });
                }
              }}
            >
              Delete
            </Button>
          </>
        }
      />
      <TimerDialog
        open={editing}
        onOpenChange={setEditing}
        title="Edit Timer"
        timer={timer}
        timers={timers}
        onSave={(fields) =>
          send({ event: "update-timer", id: timer.id, timer: fields })
        }
      />
    </>
  );
}
