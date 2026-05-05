// SPDX-License-Identifier: Apache-2.0

/**
 * Sorts auto-generated GitHub release notes into sections by conventional commit prefix.
 *
 * Usage: node sort-release-notes.mjs < <raw-notes>
 */

import { readFileSync } from 'fs';

const rawNotes = readFileSync('/dev/stdin', 'utf8');

const sections = {
  Features: [],
  Fixes: [],
  Documentation: [],
  Maintenance: [],
  'Dependency Updates': [],
  Other: [],
};

const prefixMap = [
  [/^\* feat(\(.*?\))?!?:/, 'Features'],
  [/^\* fix(\(.*?\))?!?:/, 'Fixes'],
  [/^\* chore\(deps/, 'Dependency Updates'],
  [/^\* chore(\(.*?\))?!?:/, 'Maintenance'],
  [/^\* ci(\(.*?\))?!?:/, 'Maintenance'],
  [/^\* docs(\(.*?\))?!?:/, 'Documentation'],
  [/^\* refactor(\(.*?\))?!?:/, 'Maintenance'],
  [/^\* test(\(.*?\))?!?:/, 'Maintenance'],
  [/^\* perf(\(.*?\))?!?:/, 'Maintenance'],
];

for (const line of rawNotes.split('\n')) {
  if (!line.trimStart().startsWith('* ')) continue;
  const trimmed = line.trimStart();
  const section = prefixMap.find(([re]) => re.test(trimmed))?.[1] ?? 'Other';
  sections[section].push(trimmed);
}

let body = '';
for (const [title, entries] of Object.entries(sections)) {
  if (entries.length === 0) continue;
  body += `## ${title}\n\n${entries.join('\n')}\n\n`;
}

process.stdout.write(body.trimEnd());
