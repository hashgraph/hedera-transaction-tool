const LINE_AND_PARAGRAPH_SEPARATORS = /[\u2028\u2029]/g;

// JSON.stringify escapes all C0 control characters (0x00-0x1F: \n, \r, \t, ESC, etc.), so
// values serialized through it can't already forge a fake log line or inject terminal
// escapes. It does *not* escape U+2028 (LINE SEPARATOR) or U+2029 (PARAGRAPH SEPARATOR)
// though -- those are valid inside a JSON string but some terminals and line-oriented log
// tooling treat them as line breaks. This catches that gap for any string headed for a log
// line, JSON-encoded or not.
export function sanitizeForLog(value: string): string {
  return value.replace(LINE_AND_PARAGRAPH_SEPARATORS, char => `\\u${char.charCodeAt(0).toString(16)}`);
}
