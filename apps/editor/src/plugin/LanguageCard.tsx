import { Section, SelectField } from "@fluxta/sdk/ui";
import {
  LANGUAGES,
  LanguageSchema,
  type EditorMessage,
  type Language,
} from "timers-protocol";

type Props = {
  language: Language;
  send: (message: EditorMessage) => void;
};

export function LanguageCard({ language, send }: Props) {
  return (
    <Section
      title="Durations in words"
      description="The language Elapsed in Words is written in — “2 h 14 min” or “2 ч 14 мин”. It applies from the next step that reads a Stopwatch."
    >
      <SelectField
        label="Language"
        options={LANGUAGES}
        value={language}
        onChange={(value) => {
          const parsed = LanguageSchema.safeParse(value);

          if (parsed.success) {
            send({ event: "set-language", language: parsed.data });
          }
        }}
      />
    </Section>
  );
}
