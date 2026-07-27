import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const verifier = path.join(repoRoot, 'scripts', 'verify-workflows.mjs');
const validateWorkflow = readFileSync(
  path.join(repoRoot, '.github', 'workflows', 'validate.yml'),
  'utf8',
);
const updateWorkflow = readFileSync(
  path.join(repoRoot, '.github', 'workflows', 'update-shared.yml'),
  'utf8',
);

test('current workflows satisfy the protected pull-request contract', () => {
  const result = runVerifier(updateWorkflow);
  assert.equal(result.status, 0, result.stderr);
});

test('rejects a direct push to the protected main branch', () => {
  const result = runVerifier(
    updateWorkflow.replace(
      'git push --set-upstream origin "HEAD:refs/heads/$branch"',
      'git push origin main',
    ),
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must never push directly to main/);
});

test('rejects dependency automation that does not create a pull request', () => {
  const result = runVerifier(updateWorkflow.replace('gh pr create \\', 'echo blocked \\'));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must open a protected pull request/);
});

test('rejects an unbounded per-run automation branch', () => {
  const result = runVerifier(
    updateWorkflow.replace(
      'branch="automation/update-shared"',
      'branch="automation/update-shared-${GITHUB_RUN_ID}"',
    ),
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must reuse one bounded branch/);
});

test('rejects automation that abandons an existing unmerged branch', () => {
  const result = runVerifier(
    updateWorkflow.replace('git rev-list --count origin/main..HEAD', 'echo 0'),
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must recover an existing unmerged branch/);
});

function runVerifier(candidateUpdateWorkflow) {
  const root = mkdtempSync(path.join(tmpdir(), 'ssai-connect-workflows-'));
  try {
    const workflowDir = path.join(root, '.github', 'workflows');
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(path.join(workflowDir, 'validate.yml'), validateWorkflow);
    writeFileSync(path.join(workflowDir, 'update-shared.yml'), candidateUpdateWorkflow);
    return spawnSync(process.execPath, [verifier], {
      cwd: root,
      encoding: 'utf8',
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
