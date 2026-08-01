import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const ALLOWED_KINDS = new Set(['pending_pr', 'preexisting_ref']);
const EXPECTED_FILES = Object.freeze(['package-lock.json', 'package.json']);

export function validateReusedSharedCandidate({
  kind,
  branch,
  branchSha,
  parentSha,
  targetSharedSha,
  canonicalTreeSha,
  commit,
  comparison,
  pullFiles = null,
}) {
  assert(ALLOWED_KINDS.has(kind), 'Reused candidate kind is invalid');
  for (const [label, value] of Object.entries({
    branchSha,
    parentSha,
    targetSharedSha,
    canonicalTreeSha,
  })) {
    assert.match(value, SHA_PATTERN, `${label} must be immutable`);
  }
  assert.equal(
    branch,
    `automation/ssai-shared-${targetSharedSha}-${parentSha}`,
    'Reused branch does not encode the exact Shared target and Connect base',
  );

  assertObject(commit, 'Reused candidate commit');
  assert.equal(commit.sha, branchSha, 'Reused candidate commit SHA changed');
  assert.equal(commit.parents?.length, 1, 'Reused candidate must have exactly one parent');
  assert.equal(commit.parents[0]?.sha, parentSha, 'Reused candidate parent differs from Connect base');
  assert.match(commit.tree?.sha, SHA_PATTERN, 'Reused candidate tree is malformed');
  assert.equal(
    commit.tree.sha,
    canonicalTreeSha,
    'Reused candidate tree differs from trusted-main canonical reconstruction',
  );

  assertObject(comparison, 'Reused candidate comparison');
  assert.equal(comparison.status, 'ahead', 'Reused candidate must be ahead of its exact base');
  assert.equal(comparison.ahead_by, 1, 'Reused candidate must be exactly one commit ahead');
  assert.equal(comparison.behind_by, 0, 'Reused candidate must not be behind its exact base');
  assert.equal(comparison.commits?.length, 1, 'Reused candidate comparison must contain one commit');
  assert.equal(comparison.commits[0]?.sha, branchSha, 'Comparison commit differs from reused candidate');
  assert.deepEqual(sortedFilenames(comparison.files), EXPECTED_FILES, 'Reused candidate changes unexpected files');

  if (kind === 'pending_pr') {
    assert(Array.isArray(pullFiles), 'Pending review files are required');
    assert.deepEqual(sortedFilenames(pullFiles), EXPECTED_FILES, 'Pending review changes unexpected files');
  } else {
    assert.equal(pullFiles, null, 'Preexisting ref must not claim pull-request files');
  }

  return {
    kind,
    branch,
    branchSha,
    parentSha,
    targetSharedSha,
    canonicalTreeSha,
  };
}

function sortedFilenames(files) {
  assert(Array.isArray(files), 'Candidate file list is missing');
  const names = files.map(file => {
    assertObject(file, 'Candidate file entry');
    assert.equal(typeof file.filename, 'string', 'Candidate filename is missing');
    return file.filename;
  }).sort();
  return names;
}

function assertObject(value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
}

function runCli() {
  const raw = readFileSync(0, 'utf8');
  assert(raw.length > 0 && raw.length <= 4 * 1024 * 1024, 'Reused candidate validation input is invalid');
  const result = validateReusedSharedCandidate(JSON.parse(raw));
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  try {
    runCli();
  } catch (error) {
    console.error(`[reused-shared-candidate] ${error.message}`);
    process.exitCode = 1;
  }
}
