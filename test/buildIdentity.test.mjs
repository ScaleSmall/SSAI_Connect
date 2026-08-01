import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

const writer = resolve('scripts/write-build-identity.mjs');
const verifier = resolve('scripts/verify-connect-build-identity-dist.mjs');

function git(cwd, ...args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function createCandidateRepository() {
  const cwd = mkdtempSync(resolve(tmpdir(), 'ssai-connect-build-identity-'));
  git(cwd, 'init', '--initial-branch=main');
  git(cwd, 'config', 'user.email', 'connect-build-identity@example.invalid');
  git(cwd, 'config', 'user.name', 'Connect Build Identity Test');
  writeFileSync(resolve(cwd, 'source.txt'), 'base\n', 'utf8');
  git(cwd, 'add', 'source.txt');
  git(cwd, 'commit', '-m', 'base');
  const baseSha = git(cwd, 'rev-parse', 'HEAD');
  writeFileSync(resolve(cwd, 'source.txt'), 'candidate\n', 'utf8');
  git(cwd, 'add', 'source.txt');
  git(cwd, 'commit', '-m', 'candidate');
  const candidateSha = git(cwd, 'rev-parse', 'HEAD');
  mkdirSync(resolve(cwd, 'dist'));
  writeFileSync(resolve(cwd, 'dist', 'index.html'), '<html><head></head><body></body></html>\n', 'utf8');
  return { cwd, baseSha, candidateSha };
}

test('binds a bounded local candidate to git HEAD while GitHub SHA remains the run base', () => {
  const { cwd, baseSha, candidateSha } = createCandidateRepository();
  try {
    const environment = {
      ...process.env,
      VITE_SSAI_BUILD_SHA: candidateSha,
      GITHUB_SHA: baseSha,
    };
    const writeResult = spawnSync(process.execPath, [writer], { cwd, env: environment, encoding: 'utf8' });
    assert.equal(writeResult.status, 0, writeResult.stderr);
    const identity = JSON.parse(readFileSync(resolve(cwd, 'dist', 'build-identity.json'), 'utf8'));
    assert.equal(identity.sha, candidateSha);

    const verifyResult = spawnSync(process.execPath, [verifier], {
      cwd,
      env: { ...environment, EXPECTED_BUILD_SHA: candidateSha },
      encoding: 'utf8',
    });
    assert.equal(verifyResult.status, 0, verifyResult.stderr);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('rejects an explicit build identity that is not the checked-out commit', () => {
  const { cwd, baseSha, candidateSha } = createCandidateRepository();
  try {
    const result = spawnSync(process.execPath, [writer], {
      cwd,
      env: {
        ...process.env,
        VITE_SSAI_BUILD_SHA: baseSha,
        GITHUB_SHA: candidateSha,
      },
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /VITE_SSAI_BUILD_SHA must match the checked-out git HEAD/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('rejects verification against an expected SHA that is not git HEAD', () => {
  const { cwd, baseSha, candidateSha } = createCandidateRepository();
  try {
    const writeResult = spawnSync(process.execPath, [writer], {
      cwd,
      env: {
        ...process.env,
        VITE_SSAI_BUILD_SHA: candidateSha,
        GITHUB_SHA: baseSha,
      },
      encoding: 'utf8',
    });
    assert.equal(writeResult.status, 0, writeResult.stderr);

    const verifyResult = spawnSync(process.execPath, [verifier], {
      cwd,
      env: {
        ...process.env,
        EXPECTED_BUILD_SHA: baseSha,
        VITE_SSAI_BUILD_SHA: candidateSha,
        GITHUB_SHA: baseSha,
      },
      encoding: 'utf8',
    });
    assert.notEqual(verifyResult.status, 0);
    assert.match(verifyResult.stderr, /EXPECTED_BUILD_SHA must match the checked-out git HEAD/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
