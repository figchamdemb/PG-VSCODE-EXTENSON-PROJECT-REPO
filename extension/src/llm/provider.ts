import { LineInput, NarrationItem, NarrationMode } from "../types";

export interface LlmProvider {
  narrateLines(filePath: string, mode: NarrationMode, lines: LineInput[]): Promise<NarrationItem[]>;
}
