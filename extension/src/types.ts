export type NarrationMode = "dev" | "edu";

export interface LineInput {
  lineNumber: number;
  text: string;
}

export interface NarrationItem {
  lineNumber: number;
  narration: string;
}
