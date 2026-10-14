import {
  DEFAULT_LANGUAGE,
  LanguageSchema,
  StopwatchSchema,
  type Language,
  type Stopwatch,
  type StopwatchTiming,
} from "timers-protocol";

/** Plugin Settings as this plugin persists them. */
export type StoredSettings = {
  language: Language;
  stopwatches: Stopwatch[];
};

interface SettingsWriter {
  setPluginSettings(data: StoredSettings): Promise<void>;
}

/**
 * The plugin's Plugin Settings — the Stopwatches with their runs, and the
 * language of Elapsed in Words. The sidecar is their only writer: editors
 * ask it for changes, and every Action's state change is written here.
 *
 * Read once, at startup. Fluxta echoes every write back to the plugin, and
 * the echo of one write can arrive after a newer change was made here —
 * taking it in would undo, for a moment, a Start or a Pause that already
 * happened, and a step running in that moment would act on the old state.
 * Nothing else writes these settings, so after the load the copy in memory
 * is the truth and the echoes carry nothing new.
 */
export class SettingsStore {
  private settings: StoredSettings = {
    language: DEFAULT_LANGUAGE,
    stopwatches: [],
  };

  private markLoaded!: () => void;

  /**
   * Settles once {@link load} has run. Fluxta may ask for an Action, a
   * Source or an Options Source before the settings have arrived, and an
   * answer from the empty defaults would be wrong — so everything that reads
   * the store waits for this first.
   */
  readonly loaded = new Promise<void>((resolve) => {
    this.markLoaded = resolve;
  });

  constructor(
    private readonly plugin: SettingsWriter,
    /** Called after every change, to tell the open editors. */
    private readonly onChange: () => void = () => {},
  ) {}

  /**
   * Takes in the settings as persisted. Anything this version cannot read —
   * a malformed entry, an unknown language — is dropped rather than failing
   * the whole load.
   */
  load(raw: unknown): void {
    const record =
      typeof raw === "object" && raw !== null && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    const language = LanguageSchema.safeParse(record["language"]);
    const stopwatches = Array.isArray(record["stopwatches"])
      ? record["stopwatches"].flatMap((entry) => {
          const parsed = StopwatchSchema.safeParse(entry);
          return parsed.success ? [parsed.data] : [];
        })
      : [];

    this.settings = {
      language: language.success ? language.data : DEFAULT_LANGUAGE,
      stopwatches,
    };
    this.markLoaded();
  }

  language(): Language {
    return this.settings.language;
  }

  stopwatches(): readonly Stopwatch[] {
    return this.settings.stopwatches;
  }

  stopwatch(id: string): Stopwatch | undefined {
    return this.settings.stopwatches.find((stopwatch) => stopwatch.id === id);
  }

  async setLanguage(language: Language): Promise<void> {
    await this.write({ ...this.settings, language });
  }

  async addStopwatch(id: string, name: string): Promise<void> {
    await this.write({
      ...this.settings,
      stopwatches: [
        ...this.settings.stopwatches,
        { id, name: name.trim(), timing: { state: "idle" } },
      ],
    });
  }

  async renameStopwatch(id: string, name: string): Promise<void> {
    await this.changeStopwatch(id, (stopwatch) => ({
      ...stopwatch,
      name: name.trim(),
    }));
  }

  async removeStopwatch(id: string): Promise<void> {
    await this.write({
      ...this.settings,
      stopwatches: this.settings.stopwatches.filter(
        (stopwatch) => stopwatch.id !== id,
      ),
    });
  }

  async setTiming(id: string, timing: StopwatchTiming): Promise<void> {
    await this.changeStopwatch(id, (stopwatch) => ({ ...stopwatch, timing }));
  }

  private async changeStopwatch(
    id: string,
    change: (stopwatch: Stopwatch) => Stopwatch,
  ): Promise<void> {
    await this.write({
      ...this.settings,
      stopwatches: this.settings.stopwatches.map((stopwatch) =>
        stopwatch.id === id ? change(stopwatch) : stopwatch,
      ),
    });
  }

  /**
   * Takes the change in memory at once — the next step sees it even while
   * it is being saved — then persists the whole settings. A failed save is
   * logged, not thrown: the change still holds until the plugin restarts,
   * and no step should fail because Fluxta could not write a file.
   */
  private async write(next: StoredSettings): Promise<void> {
    this.settings = next;
    this.onChange();

    try {
      await this.plugin.setPluginSettings(next);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`Could not save the plugin's settings: ${reason}`);
    }
  }
}
