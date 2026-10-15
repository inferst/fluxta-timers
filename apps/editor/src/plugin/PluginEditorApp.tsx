import { EditorPage, PluginEditorLayout } from "@fluxta/sdk/ui";

import { LanguageCard } from "./LanguageCard";
import { StopwatchesCard } from "./StopwatchesCard";
import { TimersCard } from "./TimersCard";
import { usePluginStatus } from "./usePluginStatus";

/** A refusal the sidecar sent, shown above the list whose edit it refused. */
function Refusal({ message }: { message: string | undefined }) {
  return message ? (
    <p role="alert" className="text-destructive mb-4 text-xs/relaxed">
      {message}
    </p>
  ) : null;
}

export function PluginEditorApp() {
  const { status, refusal, sidecarSilent, send } = usePluginStatus();

  if (!status) {
    return (
      <EditorPage>
        {sidecarSilent ? (
          <p className="text-muted-foreground text-xs/relaxed">
            The plugin process is not answering. Fluxta does not restart a
            crashed process — start the plugin again from the settings list, and
            check its log if it keeps failing.
          </p>
        ) : null}
      </EditorPage>
    );
  }

  return (
    <PluginEditorLayout
      sections={[
        {
          id: "timers",
          label: "Timers",
          count: status.timers.length,
          content: (
            <>
              <Refusal
                message={refusal?.of === "timers" ? refusal.message : undefined}
              />
              <TimersCard timers={status.timers} send={send} />
            </>
          ),
        },
        {
          id: "stopwatches",
          label: "Stopwatches",
          count: status.stopwatches.length,
          content: (
            <>
              <Refusal
                message={
                  refusal?.of === "stopwatches" ? refusal.message : undefined
                }
              />
              <StopwatchesCard stopwatches={status.stopwatches} send={send} />
            </>
          ),
        },
        {
          id: "language",
          label: "Language",
          content: <LanguageCard language={status.language} send={send} />,
        },
      ]}
    />
  );
}
