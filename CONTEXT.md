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
Timer Elapsed. Created in the Plugin Editor with its name, its duration and
its Repeated Start; persisted in Plugin settings, and picked by its id in
steps, conditions and Event Filters. Steps can start it (for its own
duration or one the step gives), cancel it, and add time to it. A step, a
condition or a filter pointed at a deleted Timer does nothing, and a deleted
Timer never fires.
_Avoid_: countdown (what a running Timer does, not what it is), alarm,
stopwatch (a Stopwatch counts up).

**Timer State**:
Whether a Timer is `idle` or `running`. A Timer is idle from creation, after
it is cancelled, and from the moment it fires — so a step reacting to its
Timer Elapsed already sees it idle and can start it again. The Value Source
`timerState` answers it for an If/Else; `remainingSeconds` answers how long a
running one has left, rounded up.

**Due Time**:
When a running Timer fires: wall-clock time, set by Start to now plus the
duration and moved later by Add Time. Persisted, so a Timer keeps counting
while Fluxta is closed.

**Repeated Start**:
What Start does to a Timer that is already running — `restart` (count down
the full duration again from now, the default) or `ignore` (leave the
countdown as it is). A setting on the Timer, not on the step.

**Timer Elapsed**:
The Event Source `timer-elapsed`: a Timer reached its Due Time. Its Fields
are `timer` (the Timer's id, filterable by name), `count` (always 1 for a
one-shot Timer), `lateSeconds` (how long after its Due Time it fired) and
`missed` (always 0 for a one-shot Timer). A Timer that fell due while Fluxta
was closed fires once as soon as the plugin is back, with `lateSeconds`
saying how late; a scenario that does not want such firings filters on it.
_Avoid_: timer finished, timeout.

**Duration**:
How long a Timer counts down, or how much Add Time adds: seconds (`900`) or
a clock time (`15:00`, `1:30:00` — the shape of a Stopwatch's Elapsed), more
than zero and at most 7 days. A step's duration may be a `{{…}}` reference;
one that does not come out as a duration makes Start count the Timer's own,
and Add Time add nothing.

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
