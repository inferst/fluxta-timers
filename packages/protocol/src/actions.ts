/**
 * The settings every Stopwatch Action saves — Start, Pause, Reset and Read
 * share one Action Editor.
 *
 * `stopwatch` is a Stopwatch's id. Unset, or naming a Stopwatch that has
 * since been deleted, the Action does nothing.
 */
export type StopwatchActionSettings = {
  stopwatch?: string;
};
