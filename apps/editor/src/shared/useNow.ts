import { useEffect, useState } from "react";

/**
 * The current time, ticking once a second while `ticking` — so a running
 * Stopwatch's time moves on screen. The sidecar reports only when a
 * Stopwatch starts, pauses or resets; the editor works the time out from
 * `runningSince` itself, and the two share the machine's clock.
 *
 * Between ticks it may be up to a second behind, which a Stopwatch shown in
 * whole seconds absorbs: `elapsedMs` never lets a lagging clock count
 * backwards.
 */
export function useNow(ticking: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!ticking) {
      return;
    }

    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [ticking]);

  return now;
}
