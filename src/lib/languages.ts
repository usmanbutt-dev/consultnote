import { z } from "zod";

export const audioLanguageSchema = z.enum(["auto", "en", "ur", "en-ur"]);
export type AudioLanguage = z.infer<typeof audioLanguageSchema>;
export const notesLanguageSchema = z.literal("en");
export type NotesLanguage = z.infer<typeof notesLanguageSchema>;
export const noteSectionTitles = {
  discussion: "History",
  explanations: "Discussion",
  decisions: "Plan",
  followUp: "Follow-up",
  context: "Preferences and barriers",
};
