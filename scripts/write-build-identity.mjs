#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const distDirectory = join(process.cwd(), 'dist');
const indexPath = join(distDirectory, 'index.html');
const identityPath = join(distDirectory, 'build-identity.json');

const gitHead = execFileSync(
  'git',
  ['rev-parse', '--verify', 'HEAD^{commit}'],
  { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
).trim();
assert.match(gitHead, SHA_PATTERN, 'Checked-out git HEAD must be one immutable lowercase commit SHA');

const declaredCandidates = [
  ['VITE_SSAI_BUILD_SHA', process.env.VITE_SSAI_BUILD_SHA],
  ['CF_PAGES_COMMIT_SHA', process.env.CF_PAGES_COMMIT_SHA],
  ['GITHUB_SHA', process.env.GITHUB_SHA],
].filter(([, value]) => value);

for (const [name, value] of declaredCandidates) {
  assert.match(value, SHA_PATTERN, `${name} must be one immutable lowercase commit SHA`);
}

const explicitCandidates = declaredCandidates.filter(([name]) => name !== 'GITHUB_SHA');
const authoritativeCandidates = explicitCandidates.length > 0
  ? explicitCandidates
  : declaredCandidates.filter(([name]) => name === 'GITHUB_SHA');
for (const [name, value] of authoritativeCandidates) {
  assert.equal(value, gitHead, `${name} must match the checked-out git HEAD`);
}

// A workflow may create and validate a bounded local candidate commit. In that
// case GitHub leaves GITHUB_SHA bound to the original workflow-run commit, so
// the explicit candidate input is authoritative only after it matches git HEAD.
const sha = gitHead;

const identity = {
  schema: 'ssai.connect.build-identity.v1',
  service: 'SSAI_Connect',
  repository: 'ScaleSmall/SSAI_Connect',
  sha,
};
writeFileSync(identityPath, `${JSON.stringify(identity)}\n`, { encoding: 'utf8', mode: 0o644 });

const index = readFileSync(indexPath, 'utf8');
assert(!index.includes('name="ssai-build-sha"'), 'Built HTML already contains an ambiguous build identity');
assert(index.includes('</head>'), 'Built HTML is missing its head boundary');
const taggedIndex = index.replace(
  '</head>',
  `  <meta name="ssai-build-sha" content="${sha}" />\n  </head>`,
);
writeFileSync(indexPath, taggedIndex, { encoding: 'utf8', mode: 0o644 });

console.log(`[connect-build-identity] emitted sha=${sha}`);
