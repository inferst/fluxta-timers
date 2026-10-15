# Timers

The Fluxta plugin that measures time for scenarios. Its Timers count down
and fire an Event when they run out; its Stopwatches count time across
pauses and hand it to later steps.

Fluxta's own words — Action, Run Variable, Event, Event Source, Event
Filter, Value Source, Options Source, If/Else, Plugin Editor, Action Editor,
Plugin settings — mean what Fluxta's
[Terminology](https://fluxta.app/docs/plugins/getting-started/terminology)
says and are not redefined here. In particular a **run** is Fluxta's: one
execution of a program. Nothing in this plugin is called a run.

## Language

### Timers

**Timer**:
A named object that counts down a duration and, when it runs out, fires a
Timer Elapsed — once, or on a Schedule when it repeats. Created in the
Plugin Editor with its name, its duration, its Repeated Start and whether it
repeats (and at most how many times); persisted in Plugin settings, and
picked by its id in steps, conditions and Event Filters. Steps can start it
(for its own duration or one the step gives), cancel it, and add time to
it. What a Start takes from the Timer holds until the next Start: editing a
running Timer does not change its countdown. A step, a condition or a
filter pointed at a deleted Timer does nothing, and a deleted Timer never
fires.
_Avoid_: countdown (what a running Timer does, not what it is), alarm,
stopwatch (a Stopwatch counts up).

**Timer State**:
Whether a Timer is `idle` or `running`. A Timer is idle from creation, after
it is cancelled, and from the moment its last Cycle fires — so a step
reacting to that Timer Elapsed already sees it idle and can start it again.
A repeating Timer is still running when its other Cycles fire. The Value
Source `timerState` answers it for an If/Else; `remainingSeconds` answers
how long the current Cycle of a running one has left, rounded up.

**Schedule**:
When a running Timer's Cycles fall due: one duration after Start, then
every duration after that — counted from Start, never from the moment a
Cycle fired, so a repeating Timer does not drift. A repeated Start with
`restart` begins a new Schedule from now; Add Time leaves it as it is.
_Avoid_: interval (the duration a repeating Timer repeats), grid.

**Cycle**:
One countdown on a Timer's Schedule, numbered from 1. A one-shot Timer has
one; a repeating Timer as many as it is allowed (**at most N times**),
or until cancelled. The limit counts Cycles on the Schedule, missed ones
included: "4 times every 30:00" is over two hours after Start, however long
Fluxta was closed in between.

**Due Time**:
When the current Cycle fires: its place on the Schedule, unless Add Time
moved it later — for that Cycle only. Wall-clock time, persisted, so a
Timer keeps counting while Fluxta is closed.

**Repeated Start**:
What Start does to a Timer that is already running — `restart` (a new
Schedule from now, the default) or `ignore` (leave the countdown as it is).
A setting on the Timer, not on the step.

**Timer Elapsed**:
The Event Source `timer-elapsed`: a Timer reached its Due Time. Its Fields
are `timer` (the Timer's id, filterable by name), `count` (the Cycle that
fired), `missed` (Cycles before it that never fired) and `lateSeconds` (how
long after its Due Time it fired). Cycles that fell due while Fluxta was
closed fire once as soon as the plugin is back — for the latest of them,
with the others as `missed` and `lateSeconds` saying how late — and the
Timer goes on at the next Cycle still ahead on its Schedule, or is idle if
its last one has passed. A scenario that does not want such firings filters
on `lateSeconds` or `missed`. Add Time longer than the duration of a
repeating Timer carries its Cycle past the next one's place on the
Schedule; that next one then counts as missed.
_Avoid_: timer finished, timeout.

**Duration**:
How long a Timer counts down, or how much Add Time adds: seconds (`900`) or
a clock time (`15:00`, `1:30:00` — the shape of a Stopwatch's Elapsed), more
than zero and at most 7 days. A repeating Timer repeats the duration it was
started with. A step's duration may be a `{{…}}` reference; one that does
not come out as a duration makes Start count the Timer's own, and Add Time
add nothing.

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
