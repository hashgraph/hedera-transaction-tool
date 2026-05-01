// SPDX-License-Identifier: Apache-2.0

/**
 * Sorts auto-generated GitHub release notes into sections by conventional commit prefix.
 *
 * Usage: node sort-release-notes.mjs <raw-notes> <repo-url> <prev-tag> <release-tag>
 */

const [rawNotes, repoUrl, prevTag, releaseTag] = process.argv.slice(2);

const sections = {
  Features: [],
  Fixes: [],
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
  [/^\* docs(\(.*?\))?!?:/, 'Maintenance'],
  [/^\* refactor(\(.*?\))?!?:/, 'Maintenance'],
  [/^\* test(\(.*?\))?!?:/, 'Maintenance'],
  [/^\* perf(\(.*?\))?!?:/, 'Maintenance'],
];

for (const line of rawNotes.split('\n')) {
  if (!line.startsWith('* ')) continue;
  const section = prefixMap.find(([re]) => re.test(line))?.[1] ?? 'Other';
  sections[section].push(line);
}

let body = '';
for (const [title, entries] of Object.entries(sections)) {
  if (entries.length === 0) continue;
  body += `## ${title}\n\n${entries.join('\n')}\n\n`;
}
body += `**Full Changelog**: ${repoUrl}/compare/${prevTag}...${releaseTag}`;

process.stdout.write(body);
