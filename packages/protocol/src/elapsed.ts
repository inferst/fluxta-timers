import { z } from "zod";

/** The languages Elapsed in Words can be written in. */
export const LanguageSchema = z.enum(["en", "ru"]);

export type Language = z.infer<typeof LanguageSchema>;

export const DEFAULT_LANGUAGE: Language = "en";

export const LANGUAGES: readonly { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ru", label: "Русский" },
];

/**
 * Abbreviated units, so a number never needs a plural form — "1 h" and
 * "5 h" read equally well, where Russian would need «час», «часа», «часов».
 */
const UNITS: Record<
  Language,
  { hours: string; minutes: string; seconds: string }
> = {
  en: { hours: "h", minutes: "min", seconds: "sec" },
  ru: { hours: "ч", minutes: "мин", seconds: "сек" },
};

/** What Pause, Reset and Read hand to later steps. */
export type ElapsedSnapshot = {
  /** `2:14:05` — hours are not capped at 24. */
  elapsed: string;
  /** `2 h 14 min` — see {@link formatWords}. */
  elapsedWords: string;
  /** Whole seconds. */
  elapsedSeconds: number;
};

function split(ms: number) {
  const total = Math.floor(Math.max(0, ms) / 1000);
  return {
    total,
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/** `H:MM:SS`: `0:45:00`, `2:14:05`, `26:00:00`. */
export function formatClock(ms: number): string {
  const { hours, minutes, seconds } = split(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${hours}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Hours and minutes, for a sentence such as "lasted 2 h 14 min". A unit
 * that is zero is left out (`2 h`, `45 min`), and seconds appear only when
 * there is not yet a whole minute (`30 sec`, `0 sec`). Rounded down, like
 * {@link formatClock}, so the two never disagree.
 */
export function formatWords(ms: number, language: Language): string {
  const { hours, minutes, seconds } = split(ms);
  const units = UNITS[language];

  if (hours === 0 && minutes === 0) {
    return `${seconds} ${units.seconds}`;
  }

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours} ${units.hours}`);
  }

  if (minutes > 0) {
    parts.push(`${minutes} ${units.minutes}`);
  }

  return parts.join(" ");
}

export function snapshotOf(ms: number, language: Language): ElapsedSnapshot {
  return {
    elapsed: formatClock(ms),
    elapsedWords: formatWords(ms, language),
    elapsedSeconds: split(ms).total,
  };
}
