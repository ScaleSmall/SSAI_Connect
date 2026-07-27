import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('a real staged update is committed before clean-tree validation', () => {
  withRepository(({ runner }) => {
    writeFileSync(path.join(runner, 'package.json'), '{"version":"2"}\n');
    git(runner, 'add', 'package.json');
    assert.notEqual(git(runner, 'diff', '--cached', '--quiet').status, 0);

    gitOk(runner, 'commit', '-m', 'chore: update ssai-shared dependency');

    assert.equal(git(runner, 'diff', '--quiet').status, 0);
    assert.equal(git(runner, 'diff', '--cached', '--quiet').status, 0);
  });
});

test('a retained automation branch can be safely replaced after main advances', () => {
  withRepository(({ remote, runner, upstream }) => {
    gitOk(runner, 'switch', '-c', 'automation/update-shared');
    writeFileSync(path.join(runner, 'package.json'), '{"version":"2"}\n');
    gitOk(runner, 'add', 'package.json');
    gitOk(runner, 'commit', '-m', 'first dependency update');
    gitOk(runner, 'push', 'origin', 'HEAD:refs/heads/automation/update-shared');
    const retainedSha = gitText(
      runner,
      'rev-parse',
      'refs/remotes/origin/automation/update-shared',
    );

    gitOk(upstream, 'fetch', 'origin');
    gitOk(upstream, 'switch', 'main');
    gitOk(upstream, 'merge', '--ff-only', 'origin/automation/update-shared');
    gitOk(upstream, 'push', 'origin', 'main');

    gitOk(runner, 'fetch', 'origin', 'main');
    gitOk(runner, 'rebase', 'origin/main');
    writeFileSync(path.join(runner, 'package.json'), '{"version":"3"}\n');
    gitOk(runner, 'add', 'package.json');
    gitOk(runner, 'commit', '-m', 'second dependency update');
    gitOk(
      runner,
      'push',
      `--force-with-lease=refs/heads/automation/update-shared:${retainedSha}`,
      'origin',
      'HEAD:refs/heads/automation/update-shared',
    );

    const remoteSha = gitText(
      runner,
      '--git-dir',
      remote,
      'rev-parse',
      'refs/heads/automation/update-shared',
    );
    assert.equal(remoteSha, gitText(runner, 'rev-parse', 'HEAD'));
  });
});

function withRepository(callback) {
  const root = mkdtempSync(path.join(tmpdir(), 'ssai-connect-update-shared-'));
  const remote = path.join(root, 'remote.git');
  const seed = path.join(root, 'seed');
  const runner = path.join(root, 'runner');
  const upstream = path.join(root, 'upstream');
  try {
    mkdirSync(seed);
    gitOk(root, 'init', '--bare', remote);
    gitOk(seed, 'init', '-b', 'main');
    configureIdentity(seed);
    writeFileSync(path.join(seed, 'package.json'), '{"version":"1"}\n');
    gitOk(seed, 'add', 'package.json');
    gitOk(seed, 'commit', '-m', 'initial');
    gitOk(seed, 'remote', 'add', 'origin', remote);
    gitOk(seed, 'push', '-u', 'origin', 'main');
    gitOk(root, '--git-dir', remote, 'symbolic-ref', 'HEAD', 'refs/heads/main');
    gitOk(root, 'clone', '--branch', 'main', remote, runner);
    gitOk(root, 'clone', '--branch', 'main', remote, upstream);
    configureIdentity(runner);
    configureIdentity(upstream);
    callback({ remote, runner, upstream });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function configureIdentity(repository) {
  gitOk(repository, 'config', 'user.name', 'Workflow Test');
  gitOk(repository, 'config', 'user.email', 'workflow-test@example.invalid');
}

function git(cwd, ...args) {
  return spawnSync('git', args, { cwd, encoding: 'utf8' });
}

function gitOk(cwd, ...args) {
  const result = git(cwd, ...args);
  assert.equal(
    result.status,
    0,
    `git ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`,
  );
  return result;
}

function gitText(cwd, ...args) {
  return gitOk(cwd, ...args).stdout.trim();
}
