import {
  IDLE_COUNTDOWN,
  remainingMs,
  type Countdown,
  type Timer,
  type TimerElapsed,
  type TimerState,
} from "timers-protocol";

import type { Clock } from "../clock";
import type { SettingsStore } from "../store";
import { systemScheduler, type Scheduler } from "./scheduler";

/**
 * The longest the sidecar sleeps while a Timer is counting down. A
 * `setTimeout` runs on a clock that stops while the computer sleeps, so a
 * wake set for a Due Time an hour away would come an hour late after an
 * hour asleep. Waking at least this often re-reads the wall clock, and a
 * Timer that fell due during sleep fires at most this long after waking.
 */
export const MAX_SLEEP_MS = 30_000;

/**
 * What the Actions and the Sources do to a named Timer, by its id, and the
 * one wake that fires them. Every method answers `undefined` for an id that
 * names no Timer — unset, or deleted since the step was saved — and the
 * caller decides what to log.
 *
 * The persisted Due Times are the schedule: the sidecar holds a single wake,
 * set for the earliest of them, and whatever it finds due when it wakes, it
 * fires. A Timer deleted or cancelled meanwhile is simply not found.
 */
export class Timers {
  private cancelWake: (() => void) | undefined;

  constructor(
    private readonly store: SettingsStore,
    /** Announces a Timer that ran out — the `timer-elapsed` Event. */
    private readonly onElapsed: (elapsed: TimerElapsed) => void,
    private readonly now: Clock = Date.now,
    private readonly schedule: Scheduler = systemScheduler,
  ) {}

  /**
   * Counts down from now — `durationMs`, or the Timer's own duration. A
   * running Timer counts down again from the start, or is left as it is,
   * as its Repeated Start says. `true` once it is running either way.
   */
  async start(
    id: string | undefined,
    durationMs?: number,
  ): Promise<true | undefined> {
    const timer = await this.find(id);

    if (!timer) {
      return undefined;
    }

    if (timer.countdown.state === "idle" || timer.repeatedStart === "restart") {
      await this.setCountdown(timer.id, {
        state: "running",
        dueAt: this.now() + (durationMs ?? timer.durationMs),
      });
    }

    return true;
  }

  /** Stops the countdown; the Timer does not fire. */
  async cancel(id: string | undefined): Promise<true | undefined> {
    const timer = await this.find(id);

    if (!timer) {
      return undefined;
    }

    if (timer.countdown.state !== "idle") {
      await this.setCountdown(timer.id, IDLE_COUNTDOWN);
    }

    return true;
  }

  /**
   * Moves a running countdown's Due Time later by `ms`. An idle Timer has no
   * countdown to move and stays idle — the next Start counts its full
   * duration.
   */
  async addTime(id: string | undefined, ms: number): Promise<true | undefined> {
    const timer = await this.find(id);

    if (!timer) {
      return undefined;
    }

    if (timer.countdown.state === "running") {
      await this.setCountdown(timer.id, {
        state: "running",
        dueAt: timer.countdown.dueAt + ms,
      });
    }

    return true;
  }

  async state(id: string | undefined): Promise<TimerState | undefined> {
    return (await this.find(id))?.countdown.state;
  }

  /** `undefined` both for a missing Timer and for one not counting down. */
  async remainingMs(id: string | undefined): Promise<number | undefined> {
    const timer = await this.find(id);
    return timer ? remainingMs(timer.countdown, this.now()) : undefined;
  }

  /**
   * Fires every Timer whose Due Time has come, then sleeps until the next
   * one. Called once the settings have loaded — so a Timer that fell due
   * while Fluxta was closed fires then, late — and on every wake after.
   *
   * A fired Timer is idle before its Event goes out, so a step reacting to
   * the Event already sees it so, and can start it again.
   */
  fireDue(): void {
    const now = this.now();

    for (const timer of this.store.timers()) {
      const { countdown } = timer;

      if (countdown.state !== "running" || countdown.dueAt > now) {
        continue;
      }

      // The store takes the change in memory at once and logs a failed save
      // itself — there is nothing to wait for here.
      void this.store.setCountdown(timer.id, IDLE_COUNTDOWN);
      this.onElapsed({
        timer: timer.id,
        count: 1,
        lateSeconds: Math.floor((now - countdown.dueAt) / 1000),
        missed: 0,
      });
    }

    this.sleep();
  }

  private async setCountdown(id: string, countdown: Countdown): Promise<void> {
    const saving = this.store.setCountdown(id, countdown);
    // The change is in memory already: the wake follows it now, not once
    // Fluxta has confirmed the save.
    this.sleep();
    await saving;
  }

  /** Sets the one wake for the earliest Due Time, or none if nothing runs. */
  private sleep(): void {
    this.cancelWake?.();
    this.cancelWake = undefined;

    const dueTimes = this.store
      .timers()
      .flatMap(({ countdown }) =>
        countdown.state === "running" ? [countdown.dueAt] : [],
      );

    if (dueTimes.length === 0) {
      return;
    }

    const untilDue = Math.max(0, Math.min(...dueTimes) - this.now());

    this.cancelWake = this.schedule(Math.min(untilDue, MAX_SLEEP_MS), () => {
      this.cancelWake = undefined;
      this.fireDue();
    });
  }

  private async find(id: string | undefined): Promise<Timer | undefined> {
    await this.store.loaded;
    return id ? this.store.timer(id) : undefined;
  }
}
