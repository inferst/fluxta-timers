# Timers

The Fluxta plugin that measures time for scenarios. Its Stopwatches count
time across pauses and hand it to later steps; Timers that count down and
fire an Event are to follow.

Fluxta's own words — Action, Run Variable, Value Source, Options Source,
If/Else, Plugin Editor, Action Editor, Plugin settings — mean what Fluxta's
[Terminology](https://fluxta.app/docs/plugins/getting-started/terminology)
says and are not redefined here. In particular a **run** is Fluxta's: one
execution of a program. Nothing in this plugin is called a run.

## Language

### Stopwatches

**Stopwatch**:
A named object that counts time while it is running and stops counting while
it is paused, so what it counts leaves the pauses out. Created and named in
the Plugin Editor, persisted in Plugin settings, and picked by its id in
steps and conditions. It counts wall-clock time: one left running keeps
counting while Fluxta is closed, and one paused stays paused across a
restart. A step or a condition pointed at a deleted Stopwatch does nothing.
Steps can start (or resume), pause, read and reset it.
_Avoid_: timer (a Timer counts down), clock, session (what a scenario may use
a Stopwatch for, not what it is).

**Stopwatch State**:
Whether a Stopwatch is `idle`, `running` or `paused`. `idle` means not
started since it was created or last reset; `paused` means started and then
stopped, even if it counted nothing in between — so a scenario can tell "not
begun" from "stopped at zero". The Value Source `stopwatchState` answers it
for an If/Else.
_Avoid_: status, stopped.

**Elapsed Time**:
What a Stopwatch has counted: every interval it was running, none of its
pauses. Pause, Read and Reset produce it in three forms, all rounded down to
the second — **Elapsed** (`2:14:05`, hours uncapped), **Elapsed in Words**
(`2 h 14 min`: hours and minutes, a unit that is zero left out, seconds only
under a minute; English or Russian, as Plugin settings say) and **Elapsed
Seconds**. Reset produces the Elapsed Time from before it reset.
_Avoid_: duration (what a scenario makes of it), uptime.
