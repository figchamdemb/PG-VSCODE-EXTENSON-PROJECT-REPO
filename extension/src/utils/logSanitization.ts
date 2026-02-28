const CONTROL_CHAR_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const MAX_LOG_LINE_LENGTH = 2000;

export function sanitizeLogMessage(input: string): string {
  const sanitized = input
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t")
    .replace(CONTROL_CHAR_REGEX, "?");
  if (sanitized.length <= MAX_LOG_LINE_LENGTH) {
    return sanitized;
  }
  return `${sanitized.slice(0, MAX_LOG_LINE_LENGTH)}...(truncated)`;
}
