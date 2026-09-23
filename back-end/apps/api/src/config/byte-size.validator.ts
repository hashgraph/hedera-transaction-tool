import * as Joi from 'joi';

// Mirrors the exact grammar body-parser's `limit` option accepts via the `bytes` package: an
// optional decimal number followed by one of kb/mb/gb/tb/pb, or a bare number (raw bytes).
// Anchored so nothing else can slip through -- `bytes.parse()` itself is lenient for anything
// that doesn't match its own stricter regex (e.g. "25mib" silently parses as 25 bytes via a
// parseInt fallback instead of failing), so this pattern is the actual safety gate; don't
// "simplify" this back to delegating to `bytes.parse() !== null`.
const BYTE_SIZE_PATTERN = /^\d+(\.\d+)?\s*(kb|mb|gb|tb|pb)?$/i;

export function byteSize() {
  return Joi.string()
    .pattern(BYTE_SIZE_PATTERN)
    .messages({ 'string.pattern.base': '{{#label}} must be a valid byte size (e.g. "25mb")' });
}
