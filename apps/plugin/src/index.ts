import { randomUUID } from "node:crypto";

import {
  isEditorMessage,
  validateStopwatchName,
  type EditorMessage,
  type PluginMessage,
} from "timers-protocol";

import { PauseStopwatchAction } from "./actions/pause-stopwatch";
import { ReadStopwatchAction } from "./actions/read-stopwatch";
import { ResetStopwatchAction } from "./actions/reset-stopwatch";
import { StartStopwatchAction } from "./actions/start-stopwatch";
import { createStopwatchStatesOptions } from "./options/stopwatch-states";
import { createStopwatchesOptions } from "./options/stopwatches";
import { plugin } from "./plugin";
import { createStopwatchStateSource } from "./sources/stopwatch-state";
import { Stopwatches } from "./stopwatches/stopwatches";
import { SettingsStore } from "./store";

const store = new SettingsStore(plugin, () => publish());
const stopwatches = new Stopwatches(store);

plugin.registerAction(new StartStopwatchAction(stopwatches));
plugin.registerAction(new PauseStopwatchAction(stopwatches));
plugin.registerAction(new ResetStopwatchAction(stopwatches));
plugin.registerAction(new ReadStopwatchAction(stopwatches));

plugin.registerSource(createStopwatchStateSource(stopwatches));

plugin.registerOptions(createStopwatchesOptions(store));
plugin.registerOptions(createStopwatchStatesOptions());

/** Tells every open editor how the Stopwatches and the language stand. */
function publish(): void {
  plugin.sendToEditor({
    event: "status",
    status: {
      stopwatches: [...store.stopwatches()],
      language: store.language(),
    },
  } satisfies PluginMessage);
}

function refuse(message: string): void {
  plugin.sendToEditor({
    event: "stopwatch-refused",
    message,
  } satisfies PluginMessage);
}

async function handle(message: EditorMessage): Promise<void> {
  await store.loaded;

  switch (message.event) {
    case "get-status":
      publish();
      return;

    case "create-stopwatch": {
      const refusal = validateStopwatchName(message.name, store.stopwatches());

      if (refusal) {
        refuse(refusal);
        return;
      }

      await store.addStopwatch(randomUUID(), message.name);
      return;
    }

    case "rename-stopwatch": {
      if (!store.stopwatch(message.id)) {
        refuse("This Stopwatch no longer exists.");
        return;
      }

      const refusal = validateStopwatchName(
        message.name,
        store.stopwatches(),
        message.id,
      );

      if (refusal) {
        refuse(refusal);
        return;
      }

      await store.renameStopwatch(message.id, message.name);
      return;
    }

    case "delete-stopwatch":
      await store.removeStopwatch(message.id);
      return;

    case "set-language":
      await store.setLanguage(message.language);
      return;
  }
}

// Attached before connecting, so nothing sent while the editor was already
// open is missed once the authenticated handshake completes. A message that
// arrives before the settings have loaded waits for them in `handle`.
plugin.onReceiveFromEditor((message: unknown) => {
  if (isEditorMessage(message)) {
    void handle(message);
  }
});

await plugin.connect();

// Read once — the store explains why the echoes of its own writes are not
// read again. Settings are only readable over the authenticated connection.
const { payload } = await plugin.getPluginSettings();
store.load(payload);
publish();
