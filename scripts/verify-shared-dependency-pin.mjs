import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sharedSha = process.env.EXPECTED_SHARED_SHA ?? '';
assert.match(
  sharedSha,
  /^[0-9a-f]{40}$/,
  'EXPECTED_SHARED_SHA must be an immutable lowercase 40-character Git commit SHA',
);

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const packageLock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const expectedSpecifier = `github:ScaleSmall/SSAI_Shared#${sharedSha}`;

assert.equal(
  packageJson.dependencies?.['ssai-shared'],
  expectedSpecifier,
  'package.json must pin ssai-shared to the dispatched immutable commit',
);
assert.equal(
  packageLock.packages?.['']?.dependencies?.['ssai-shared'],
  expectedSpecifier,
  'package-lock.json root dependency must match the dispatched immutable commit',
);

const resolved = packageLock.packages?.['node_modules/ssai-shared']?.resolved;
const allowedResolvedValues = new Set([
  `git+ssh://git@github.com/ScaleSmall/SSAI_Shared.git#${sharedSha}`,
  `git+https://github.com/ScaleSmall/SSAI_Shared.git#${sharedSha}`,
]);
assert(
  allowedResolvedValues.has(resolved),
  'package-lock.json must resolve ssai-shared from the exact ScaleSmall/SSAI_Shared commit',
);

console.log(`[shared-dependency-pin] OK (${sharedSha})`);
