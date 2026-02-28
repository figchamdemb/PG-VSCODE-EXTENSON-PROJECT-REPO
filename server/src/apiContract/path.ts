export function normalizeApiPath(rawPath: string): string {
  if (!rawPath) {
    return "/";
  }

  let value = rawPath.trim();
  if (/^https?:\/\//iu.test(value)) {
    try {
      const parsed = new URL(value);
      value = parsed.pathname;
    } catch {
      // Keep the original path when URL parsing fails.
    }
  }

  value = value.split("?")[0]?.split("#")[0] ?? value;
  if (!value.startsWith("/")) {
    value = `/${value}`;
  }

  value = value
    .replace(/\{[^}]+\}/gu, ":param")
    .replace(/\[[^\]]+\]/gu, ":param")
    .replace(/:[A-Za-z_][A-Za-z0-9_]*/gu, ":param")
    .replace(/\/{2,}/gu, "/");

  if (value.length > 1 && value.endsWith("/")) {
    value = value.slice(0, -1);
  }
  return value;
}

export function pathsMatch(leftPath: string, rightPath: string): boolean {
  const left = splitPath(leftPath);
  const right = splitPath(rightPath);
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] === right[index]) {
      continue;
    }
    if (left[index] === ":param" || right[index] === ":param") {
      continue;
    }
    return false;
  }
  return true;
}

function splitPath(value: string): string[] {
  return value.replace(/^\/+/u, "").split("/").filter(Boolean);
}
