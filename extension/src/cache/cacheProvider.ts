import { NarrationMode } from "../types";

export interface CacheEntry {
  filePath: string;
  mode: NarrationMode;
  lineHash: string;
  narration: string;
  updatedAt: number;
}

export interface CacheProvider {
  initialize(): Promise<void>;
  get(filePath: string, mode: NarrationMode, lineHash: string): string | undefined;
  set(filePath: string, mode: NarrationMode, lineHash: string, narration: string): void;
  flush(): Promise<void>;
}
