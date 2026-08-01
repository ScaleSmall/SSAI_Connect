#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const gitHead = execFileSync('git', ['rev-parse', '--verify', 'HEAD^{commit}'], {
  cwd: process.cwd(),
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],
}).trim();
assert.match(gitHead, SHA_PATTERN, 'Checked-out git HEAD must be one immutable lowercase commit SHA');

const declaredCandidates = [
  ['EXPECTED_BUILD_SHA', process.env.EXPECTED_BUILD_SHA],
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
const expectedSha = gitHead;

const rawIdentity = readFileSync('dist/build-identity.json', 'utf8');
const identity = JSON.parse(rawIdentity);
assert.deepEqual(
  Object.keys(identity),
  ['schema', 'service', 'repository', 'sha'],
  'Build identity must expose only its fixed nonsecret schema',
);
assert.equal(identity.schema, 'ssai.connect.build-identity.v1');
assert.equal(identity.service, 'SSAI_Connect');
assert.equal(identity.repository, 'ScaleSmall/SSAI_Connect');
assert.equal(identity.sha, expectedSha);

const index = readFileSync('dist/index.html', 'utf8');
const matches = [...index.matchAll(/<meta name="ssai-build-sha" content="([0-9a-f]{40})" \/>/g)];
assert.equal(matches.length, 1, 'Built HTML must expose exactly one nonsecret build SHA');
assert.equal(matches[0][1], expectedSha);

console.log(`[connect-build-identity] verified sha=${expectedSha}`);
