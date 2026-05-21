import type { ChipMultiInputStrategy } from '@renderer/components/ui/ChipMultiInput.vue';

// HIP-1137 caps `associated_registered_node` at 20 entries, which is also the
// `maxIds` we pass to ChipMultiInput downstream. We short-circuit here once
// the parse exceeds that — both per-range (so a typo like `0-9999999999`
// errors immediately instead of trying to expand into a giant Set first) and
// across the whole input (so a paste like "1, 2, 3, ..." with thousands of
// tokens bails out instead of churning through them all).
const MAX_TOTAL_IDS = 20;

// Registered node IDs are non-negative integers (uint64). The input accepts
// a CSV of values and `start-end` ranges, e.g. `1, 5, 10-15`. The sanitize /
// parse / format hooks below all assume this grammar.
export const registeredNodeIdStrategy: ChipMultiInputStrategy<string> = {
  // Live filter as the user types or pastes. Only digits, commas, hyphens,
  // and whitespace are valid tokens in the CSV grammar; anything else (letters,
  // dots, slashes, etc.) can't lead to a legal parse, so we drop it on input
  // instead of waiting for commit to reject it. Runs of `,,` or `--` are
  // collapsed (whitespace-tolerant) since they're never meaningful and would
  // otherwise produce empty parts / malformed ranges at commit time.
  // Whitespace is also normalized: runs of tabs/spaces collapse to a single
  // space, and a leading space is stripped — the user can't start the input
  // with whitespace, and can't accidentally type multiple spaces in a row.
  sanitize(raw) {
    let cleaned = raw.replace(/[^0-9,\- \t]/g, '');
    cleaned = cleaned.replace(/,(\s*,)+/g, ',');
    cleaned = cleaned.replace(/-(\s*-)+/g, '-');
    cleaned = cleaned.replace(/[\t ]+/g, ' ').replace(/^ /, '');
    return cleaned;
  },

  // Split on `,`, then for each token expand `a-b` into the inclusive integer
  // range (rejecting `a > b` and negatives). Duplicates across tokens / ranges
  // are deduped via the Set. Returns sorted ascending so the chips render in a
  // predictable order regardless of the order the user typed.
  //
  // Internals use BigInt rather than Number so values above
  // `Number.MAX_SAFE_INTEGER` (2^53−1) don't silently lose precision — proto
  // `uint64` legally goes up to 2^64−1. `BigInt(...)` throws on non-integer or
  // non-numeric strings, which gives us validation for free (no separate
  // `isInteger`/`isNaN` checks needed). The public `ids` output is still
  // `string[]` so callers don't have to deal with BigInt themselves.
  parse(raw) {
    const parts = raw
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const seen = new Set<bigint>();
    for (const part of parts) {
      if (part.includes('-')) {
        // A valid range is exactly two non-empty bounds separated by one
        // hyphen. Without this check, `"1-2-3"` would silently destructure
        // to `[a="1", b="2"]` and drop the `3`, and `"-5"` / `"5-"` would
        // silently coerce the empty bound to `0n` (since `BigInt("") === 0n`).
        const segments = part.split('-').map(s => s.trim());
        if (segments.length !== 2 || segments[0] === '' || segments[1] === '') {
          return { error: `Invalid range: "${part}"` };
        }
        const [a, b] = segments;
        let start: bigint;
        let end: bigint;
        try {
          start = BigInt(a);
          end = BigInt(b);
        } catch {
          return { error: `Invalid range: "${part}"` };
        }
        if (start < 0n || end < 0n || start > end) {
          return { error: `Invalid range: "${part}"` };
        }
        // Inclusive length: `end - start + 1` is the entry count. Bounds the
        // inner loop so a giant range can't expand into the Set before the
        // post-loop total check fires.
        if (end - start + 1n > BigInt(MAX_TOTAL_IDS)) {
          return { error: `Range too large: "${part}" (max ${MAX_TOTAL_IDS} per range)` };
        }
        for (let i = start; i <= end; i++) seen.add(i);
      } else {
        let n: bigint;
        try {
          n = BigInt(part);
        } catch {
          return { error: `Invalid value: "${part}"` };
        }
        if (n < 0n) {
          return { error: `Invalid value: "${part}"` };
        }
        seen.add(n);
      }
      if (seen.size > MAX_TOTAL_IDS) {
        return { error: `Too many IDs (max ${MAX_TOTAL_IDS})` };
      }
    }

    return {
      ids: [...seen].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).map(String),
    };
  },

  // Render the current id set back into the text-input grammar, collapsing
  // runs of consecutive integers into `a-b`. This is what gets written back
  // into the input on commit and after a chip is removed, so the displayed
  // text always round-trips with `parse` and stays compact (e.g. removing 7
  // from "5-10" yields "5-6, 8-10" instead of six separate numbers). Uses
  // BigInt internally for the same precision reasons as `parse`.
  //
  // `format` is also called from the parent-update watcher with whatever the
  // parent passes in `modelValue` (draft load, API response, etc.), so it
  // can't assume every entry is well-formed or unique. Invalid entries
  // (non-integer strings or negatives) are silently skipped — better to
  // render the valid subset than crash the renderer on a single bad value.
  // Duplicates are dedup'd via the Set (BigInt has value semantics, so
  // `5n === 5n` and the Set collapses them) — without this, `['1','1','2']`
  // would render as `"1, 1-2"` because the run-collapsing loop would emit
  // the lone `1` and then start a fresh `1-2` run.
  format(ids) {
    if (!ids.length) return '';
    const seen = new Set<bigint>();
    for (const id of ids) {
      try {
        const n = BigInt(id);
        if (n >= 0n) seen.add(n);
      } catch {
        // skip invalid entry
      }
    }
    if (!seen.size) return '';
    const sorted = [...seen].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const ranges: string[] = [];
    let start = sorted[0];
    let end = sorted[0];
    // Walk the sorted list extending the current run; when the next value
    // breaks the run, flush the pending [start..end] to `ranges` and reset.
    // After the loop, one final range is always pending (the run that was
    // still being extended when we ran out of input) — push it explicitly
    // rather than relying on an off-by-one iteration to flush it.
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1n) {
        end = sorted[i];
      } else {
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        start = end = sorted[i];
      }
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    return ranges.join(', ');
  },

  display(id) {
    return id;
  },
};
