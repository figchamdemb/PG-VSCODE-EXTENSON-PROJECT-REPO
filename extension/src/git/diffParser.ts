import { DiffFile, DiffHunk, DiffLine } from "./types";

const HUNK_HEADER_REGEX = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;

interface ParseState {
  files: DiffFile[];
  currentFile?: DiffFile;
  currentHunk?: DiffHunk;
  oldLineCursor: number;
  newLineCursor: number;
}

export function parseUnifiedDiff(rawDiff: string): DiffFile[] {
  const state = createParseState();
  for (const line of rawDiff.split(/\r?\n/)) {
    if (handleDiffFileHeader(state, line)) {
      continue;
    }
    if (!state.currentFile) {
      continue;
    }
    if (handleFileMetadataLine(state.currentFile, line)) {
      continue;
    }
    if (handleHunkHeaderLine(state, line)) {
      continue;
    }
    appendHunkDiffLine(state, line);
  }

  return finalizeParse(state);
}

function createParseState(): ParseState {
  return {
    files: [],
    oldLineCursor: 0,
    newLineCursor: 0
  };
}

function handleDiffFileHeader(state: ParseState, line: string): boolean {
  if (!line.startsWith("diff --git ")) {
    return false;
  }
  flushCurrentFile(state);
  const parsed = parseDiffHeader(line);
  state.currentFile = {
    oldPath: parsed.oldPath,
    newPath: parsed.newPath,
    status: "modified",
    hunks: []
  };
  return true;
}

function handleFileMetadataLine(currentFile: DiffFile, line: string): boolean {
  if (line.startsWith("new file mode ")) {
    currentFile.status = "added";
    return true;
  }
  if (line.startsWith("deleted file mode ")) {
    currentFile.status = "deleted";
    return true;
  }
  if (line.startsWith("rename from ") || line.startsWith("rename to ")) {
    currentFile.status = "renamed";
    return true;
  }
  if (line.startsWith("--- ")) {
    updateDiffPath(line, 4, (path) => {
      currentFile.oldPath = path;
    });
    return true;
  }
  if (line.startsWith("+++ ")) {
    updateDiffPath(line, 4, (path) => {
      currentFile.newPath = path;
    });
    return true;
  }
  return false;
}

function updateDiffPath(line: string, prefixLength: number, assign: (value: string) => void): void {
  const path = stripFilePrefix(line.slice(prefixLength).trim());
  if (path) {
    assign(path);
  }
}

function handleHunkHeaderLine(state: ParseState, line: string): boolean {
  const hunkMatch = line.match(HUNK_HEADER_REGEX);
  if (!hunkMatch || !state.currentFile) {
    return false;
  }
  flushCurrentHunk(state);
  const oldStart = Number(hunkMatch[1]);
  const oldCount = Number(hunkMatch[2] ?? 1);
  const newStart = Number(hunkMatch[3]);
  const newCount = Number(hunkMatch[4] ?? 1);
  const headerSuffix = hunkMatch[5] ?? "";
  state.currentHunk = {
    oldStart,
    oldCount,
    newStart,
    newCount,
    header: `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@${headerSuffix}`,
    lines: []
  };
  state.oldLineCursor = oldStart;
  state.newLineCursor = newStart;
  return true;
}

function appendHunkDiffLine(state: ParseState, rawLine: string): void {
  if (!state.currentHunk) {
    return;
  }
  const diffLine = parseDiffLine(rawLine, state.oldLineCursor, state.newLineCursor);
  if (!diffLine) {
    return;
  }
  state.currentHunk.lines.push(diffLine);
  advanceLineCursors(state, diffLine);
}

function advanceLineCursors(state: ParseState, diffLine: DiffLine): void {
  if (diffLine.kind === "context") {
    state.oldLineCursor += 1;
    state.newLineCursor += 1;
    return;
  }
  if (diffLine.kind === "removed") {
    state.oldLineCursor += 1;
    return;
  }
  state.newLineCursor += 1;
}

function flushCurrentFile(state: ParseState): void {
  if (!state.currentFile) {
    return;
  }
  flushCurrentHunk(state);
  state.files.push(state.currentFile);
  state.currentFile = undefined;
}

function flushCurrentHunk(state: ParseState): void {
  if (!state.currentFile || !state.currentHunk) {
    return;
  }
  state.currentFile.hunks.push(state.currentHunk);
  state.currentHunk = undefined;
}

function finalizeParse(state: ParseState): DiffFile[] {
  flushCurrentFile(state);
  return state.files.filter((file) => file.hunks.length > 0 || file.status !== "modified");
}

function parseDiffHeader(line: string): { oldPath: string; newPath: string } {
  // Example: diff --git a/src/a.ts b/src/a.ts
  const parts = line.trim().split(/\s+/);
  const oldPathToken = parts[2] ?? "a/unknown";
  const newPathToken = parts[3] ?? "b/unknown";
  return {
    oldPath: stripFilePrefix(oldPathToken),
    newPath: stripFilePrefix(newPathToken)
  };
}

function stripFilePrefix(token: string): string {
  if (token === "/dev/null") {
    return token;
  }
  if (token.startsWith("a/") || token.startsWith("b/")) {
    return token.slice(2);
  }
  return token;
}

function parseDiffLine(
  rawLine: string,
  oldLineCursor: number,
  newLineCursor: number
): DiffLine | undefined {
  if (rawLine.startsWith("\\ No newline at end of file")) {
    return undefined;
  }

  if (rawLine.startsWith("+")) {
    return {
      kind: "added",
      oldLineNumber: null,
      newLineNumber: newLineCursor,
      content: rawLine.slice(1)
    };
  }
  if (rawLine.startsWith("-")) {
    return {
      kind: "removed",
      oldLineNumber: oldLineCursor,
      newLineNumber: null,
      content: rawLine.slice(1)
    };
  }
  if (rawLine.startsWith(" ")) {
    return {
      kind: "context",
      oldLineNumber: oldLineCursor,
      newLineNumber: newLineCursor,
      content: rawLine.slice(1)
    };
  }

  return undefined;
}
