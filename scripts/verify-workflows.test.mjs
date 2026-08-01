import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const verifier = path.join(repoRoot, 'scripts', 'verify-workflows.mjs');
const workflowNames = [
  'validate.yml',
  'update-shared.yml',
  'pull-shared-with-protected-evidence.yml',
  'prove-shared-update-release.yml',
];
const workflows = Object.fromEntries(workflowNames.map((name) => [
  name,
  readFileSync(path.join(repoRoot, '.github', 'workflows', name), 'utf8').replace(/\r\n/g, '\n'),
]));

test('current workflows satisfy the credential-free protected pull contract', () => {
  const result = runVerifier();
  assert.equal(result.status, 0, result.stderr);
});

test('rejects a validation workflow that regains PAT or production-secret access', () => {
  for (const injection of [
    '          SCALESMALL_PAT: ${{ secrets.SCALESMALL_PAT }}\n',
    '          VITE_SUPABASE_URL: ${{ secrets.SSAI_PROD_SUPABASE_URL }}\n',
  ]) {
    const candidate = workflows['validate.yml'].replace(
      '          EXPECTED_BUILD_SHA: ${{ github.sha }}\n',
      `          EXPECTED_BUILD_SHA: \${{ github.sha }}\n${injection}`,
    );
    const result = runVerifier({ 'validate.yml': candidate });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must not (?:depend on the retired cross-repository PAT|expose repository secrets)/);
  }
});

test('rejects candidate validation with write authority', () => {
  const result = runVerifier({
    'validate.yml': workflows['validate.yml'].replace(
      'permissions:\n  contents: read',
      'permissions:\n  contents: write',
    ),
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must declare read-only contents permission|must not receive write permission/);
});

test('rejects unpinned runtime actions or persisted checkout credentials', () => {
  for (const candidate of [
    workflows['validate.yml'].replace(
      'actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e',
      'actions/setup-node@v4',
    ),
    workflows['validate.yml'].replace('persist-credentials: false', 'persist-credentials: true'),
  ]) {
    const result = runVerifier({ 'validate.yml': candidate });
    assert.notEqual(result.status, 0);
  }
});

test('rejects validation that drops lifecycle-script isolation or the full gate', () => {
  for (const candidate of [
    workflows['validate.yml'].replace(
      'npm ci --ignore-scripts --audit=false --fund=false',
      'npm ci',
    ),
    workflows['validate.yml'].replace('npm run check', 'npm run build'),
  ]) {
    const result = runVerifier({ 'validate.yml': candidate });
    assert.notEqual(result.status, 0);
  }
});

test('rejects any reactivation of the retired consumer workflow', () => {
  for (const candidate of [
    workflows['update-shared.yml'].replace('workflow_dispatch:', 'repository_dispatch:'),
    workflows['update-shared.yml'].replace('if: ${{ false }}', 'if: ${{ true }}'),
    `${workflows['update-shared.yml']}\n# SCALESMALL_PAT\n`,
    `${workflows['update-shared.yml']}\n# git push origin main\n`,
  ]) {
    const result = runVerifier({ 'update-shared.yml': candidate });
    assert.notEqual(result.status, 0);
  }
});

test('rejects a missing protected propagation workflow', () => {
  const result = runVerifier({}, new Set(['prove-shared-update-release.yml']));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /prove-shared-update-release\.yml: missing workflow/);
});

function runVerifier(overrides = {}, omitted = new Set()) {
  const root = mkdtempSync(path.join(tmpdir(), 'ssai-connect-workflows-'));
  try {
    const workflowDir = path.join(root, '.github', 'workflows');
    mkdirSync(workflowDir, { recursive: true });
    for (const name of workflowNames) {
      if (omitted.has(name)) continue;
      writeFileSync(path.join(workflowDir, name), overrides[name] ?? workflows[name]);
    }
    return spawnSync(process.execPath, [verifier], {
      cwd: root,
      encoding: 'utf8',
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
