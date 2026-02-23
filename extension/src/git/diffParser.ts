import { DiffFile, DiffHunk, DiffLine } from "./types";

const HUNK_HEADER_REGEX = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;

export function parseUnifiedDiff(rawDiff: string): DiffFile[] {
  const lines = rawDiff.split(/\r?\n/);
  const files: DiffFile[] = [];

  let currentFile: DiffFile | undefined;
  let currentHunk: DiffHunk | undefined;
  let oldLineCursor = 0;
  let newLineCursor = 0;

  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      if (currentFile) {
        if (currentHunk) {
          currentFile.hunks.push(currentHunk);
          currentHunk = undefined;
        }
        files.push(currentFile);
      }
      const parsed = parseDiffHeader(line);
      currentFile = {
        oldPath: parsed.oldPath,
        newPath: parsed.newPath,
        status: "modified",
        hunks: []
      };
      continue;
    }

    if (!currentFile) {
      continue;
    }

    if (line.startsWith("new file mode ")) {
      currentFile.status = "added";
      continue;
    }
    if (line.startsWith("deleted file mode ")) {
      currentFile.status = "deleted";
      continue;
    }
    if (line.startsWith("rename from ") || line.startsWith("rename to ")) {
      currentFile.status = "renamed";
      continue;
    }
    if (line.startsWith("--- ")) {
      const oldPath = stripFilePrefix(line.slice(4).trim());
      if (oldPath) {
        currentFile.oldPath = oldPath;
      }
      continue;
    }
    if (line.startsWith("+++ ")) {
      const newPath = stripFilePrefix(line.slice(4).trim());
      if (newPath) {
        currentFile.newPath = newPath;
      }
      continue;
    }

    const hunkMatch = line.match(HUNK_HEADER_REGEX);
    if (hunkMatch) {
      if (currentHunk) {
        currentFile.hunks.push(currentHunk);
      }
      const oldStart = Number(hunkMatch[1]);
      const oldCount = Number(hunkMatch[2] ?? 1);
      const newStart = Number(hunkMatch[3]);
      const newCount = Number(hunkMatch[4] ?? 1);
      const headerSuffix = hunkMatch[5] ?? "";

      currentHunk = {
        oldStart,
        oldCount,
        newStart,
        newCount,
        header: `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@${headerSuffix}`,
        lines: []
      };
      oldLineCursor = oldStart;
      newLineCursor = newStart;
      continue;
    }

    if (!currentHunk) {
      continue;
    }

    const diffLine = parseDiffLine(line, oldLineCursor, newLineCursor);
    if (!diffLine) {
      continue;
    }
    currentHunk.lines.push(diffLine);

    if (diffLine.kind === "context") {
      oldLineCursor += 1;
      newLineCursor += 1;
    } else if (diffLine.kind === "removed") {
      oldLineCursor += 1;
    } else if (diffLine.kind === "added") {
      newLineCursor += 1;
    }
  }

  if (currentFile) {
    if (currentHunk) {
      currentFile.hunks.push(currentHunk);
    }
    files.push(currentFile);
  }

  return files.filter((file) => file.hunks.length > 0 || file.status !== "modified");
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
