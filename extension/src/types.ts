export type NarrationMode = "dev" | "edu";
export type ReadingViewMode = "exact" | "section";
export type ReadingPaneMode = "sideBySide" | "fullPage";
export type ReadingSnippetMode = "withSource" | "narrationOnly";
export type EduDetailLevel = "standard" | "beginner" | "fullBeginner";

export interface LineInput {
  lineNumber: number;
  text: string;
}
export interface NarrationItem {
  lineNumber: number;
  narration: string;
}
