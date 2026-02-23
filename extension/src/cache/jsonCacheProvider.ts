import * as vscode from "vscode";
import * as fs from "fs/promises";
import * as path from "path";
import { CacheProvider, CacheEntry } from "./cacheProvider";
import { NarrationMode } from "../types";
import { Logger } from "../utils/logger";

interface PersistedCache {
  entries: CacheEntry[];
}

export class JsonCacheProvider implements CacheProvider {
  private readonly cacheMap = new Map<string, CacheEntry>();
  private readonly cacheFilePath: string;
  private readonly logger: Logger;

  constructor(context: vscode.ExtensionContext, logger: Logger) {
    this.cacheFilePath = path.join(context.globalStorageUri.fsPath, "narration-cache.json");
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    await fs.mkdir(path.dirname(this.cacheFilePath), { recursive: true });
    try {
      const raw = await fs.readFile(this.cacheFilePath, "utf8");
      const parsed = JSON.parse(raw) as PersistedCache;
      for (const entry of parsed.entries ?? []) {
        this.cacheMap.set(this.toKey(entry.filePath, entry.mode, entry.lineHash), entry);
      }
      this.logger.info(`Loaded cache entries: ${this.cacheMap.size}`);
    } catch {
      this.logger.info("No existing narration cache found; starting fresh.");
    }
  }

  get(filePath: string, mode: NarrationMode, lineHash: string): string | undefined {
    return this.cacheMap.get(this.toKey(filePath, mode, lineHash))?.narration;
  }

  set(filePath: string, mode: NarrationMode, lineHash: string, narration: string): void {
    const entry: CacheEntry = {
      filePath,
      mode,
      lineHash,
      narration,
      updatedAt: Date.now()
    };
    this.cacheMap.set(this.toKey(filePath, mode, lineHash), entry);
    this.prune();
  }

  async flush(): Promise<void> {
    const payload: PersistedCache = { entries: Array.from(this.cacheMap.values()) };
    await fs.writeFile(this.cacheFilePath, JSON.stringify(payload, null, 2), "utf8");
    this.logger.info(`Cache persisted with ${payload.entries.length} entries.`);
  }

  private toKey(filePath: string, mode: NarrationMode, lineHash: string): string {
    return `${filePath}::${mode}::${lineHash}`;
  }

  private prune(): void {
    const config = vscode.workspace.getConfiguration("narrate");
    const maxEntries = config.get<number>("cache.maxEntries", 30000);
    if (this.cacheMap.size <= maxEntries) {
      return;
    }

    const overflow = this.cacheMap.size - maxEntries;
    const sortedOldest = Array.from(this.cacheMap.values()).sort((a, b) => a.updatedAt - b.updatedAt);
    for (let idx = 0; idx < overflow; idx += 1) {
      const entry = sortedOldest[idx];
      this.cacheMap.delete(this.toKey(entry.filePath, entry.mode, entry.lineHash));
    }
    this.logger.warn(`Cache pruned by ${overflow} entries.`);
  }
}
