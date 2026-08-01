import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const PROCESS_TIMEOUT_MS = 12 * 60 * 1000;
const MAX_BUFFER_BYTES = 8 * 1024 * 1024;
const NULL_PATH = process.platform === 'win32' ? 'NUL' : '/dev/null';

const expectedSharedSha = process.env.EXPECTED_SHARED_SHA ?? '';
const expectedPackageSha256 = process.env.EXPECTED_SHARED_PACKAGE_JSON_SHA256 ?? '';
const expectedCanonicalTreeSha = process.env.EXPECTED_CANONICAL_CANDIDATE_TREE_SHA ?? '';
const install = process.argv.includes('--install');
assert.match(expectedSharedSha, SHA_PATTERN, 'EXPECTED_SHARED_SHA must be immutable');
assert.match(expectedPackageSha256, SHA256_PATTERN, 'EXPECTED_SHARED_PACKAGE_JSON_SHA256 must be immutable');
if (expectedCanonicalTreeSha) {
  assert.match(
    expectedCanonicalTreeSha,
    SHA_PATTERN,
    'EXPECTED_CANONICAL_CANDIDATE_TREE_SHA must be immutable',
  );
}
assert(!existsSync('.npmrc'), 'Repository .npmrc is forbidden during trusted Shared reconstruction');

const tempRoot = mkdtempSync(resolve(process.env.RUNNER_TEMP || tmpdir(), 'ssai-shared-reconstruct-'));
const gitConfig = resolve(tempRoot, 'gitconfig');
const npmUserConfig = resolve(tempRoot, 'npm-userconfig');
const npmGlobalConfig = resolve(tempRoot, 'npm-globalconfig');
const npmCache = resolve(tempRoot, 'npm-cache');

try {
  writeFileSync(gitConfig, [
    '[credential]',
    '\thelper =',
    '[core]',
    `\thooksPath = ${NULL_PATH}`,
    '[protocol "file"]',
    '\tallow = never',
    '[protocol "ext"]',
    '\tallow = never',
    '[url "https://github.com/"]',
    '\tinsteadOf = git+https://github.com/',
    '\tinsteadOf = ssh://git@github.com/',
    '\tinsteadOf = git+ssh://git@github.com/',
    '\tinsteadOf = git@github.com:',
    '',
  ].join('\n'));
  writeFileSync(npmUserConfig, '');
  writeFileSync(npmGlobalConfig, '');

  const env = sterileEnvironment(process.env, {
    GIT_CONFIG_GLOBAL: gitConfig,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_TERMINAL_PROMPT: '0',
    GIT_ASKPASS: NULL_PATH,
    SSH_ASKPASS: NULL_PATH,
    NPM_CONFIG_USERCONFIG: npmUserConfig,
    NPM_CONFIG_GLOBALCONFIG: npmGlobalConfig,
    NPM_CONFIG_CACHE: npmCache,
    NPM_CONFIG_IGNORE_SCRIPTS: 'true',
    NPM_CONFIG_AUDIT: 'false',
    NPM_CONFIG_FUND: 'false',
  });

  run('npm', [
    'install',
    `github:ScaleSmall/SSAI_Shared#${expectedSharedSha}`,
    '--save',
    '--package-lock-only',
    '--ignore-scripts',
    '--audit=false',
    '--fund=false',
  ], env);
  verifyPin(expectedSharedSha);

  if (install) {
    run('npm', ['ci', '--ignore-scripts', '--audit=false', '--fund=false'], env);
    const installedPackage = readFileSync('node_modules/ssai-shared/package.json');
    assert.equal(
      digest(installedPackage),
      expectedPackageSha256,
      'Installed Shared package.json differs from both exact-commit public readers',
    );
  }

  const unexpected = unexpectedReconstructionPaths(gitOutput([
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
  ], { trim: false }));
  assert.deepEqual(unexpected, [], `Shared reconstruction changed unexpected paths: ${unexpected.join(', ')}`);

  run('git', ['add', '--', 'package.json', 'package-lock.json'], process.env);
  const testedTreeSha = gitOutput(['write-tree']);
  const lockSha256 = digest(readFileSync('package-lock.json'));
  assert.match(testedTreeSha, SHA_PATTERN, 'Candidate tree SHA is malformed');
  assert.match(lockSha256, SHA256_PATTERN, 'Candidate lock digest is malformed');
  if (expectedCanonicalTreeSha) {
    assert.equal(
      testedTreeSha,
      expectedCanonicalTreeSha,
      'Installed gate reconstruction differs from trusted-main canonical candidate tree',
    );
  }

  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    appendFileSync(outputPath, `tested_tree_sha=${testedTreeSha}\n`);
    appendFileSync(outputPath, `lock_sha256=${lockSha256}\n`);
  }
  console.log(JSON.stringify({
    sharedSha: expectedSharedSha,
    packageJsonSha256: expectedPackageSha256,
    testedTreeSha,
    lockSha256,
    installVerified: install,
  }));
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

function unexpectedReconstructionPaths(statusOutput) {
  return String(statusOutput).split(/\r?\n/).filter(Boolean).filter(line => {
    assert.match(line, /^[ MADRCU?!]{2} /, `Malformed Git porcelain line: ${line}`);
    const path = line.slice(3).replace(/^"|"$/g, '');
    return path !== 'package.json' && path !== 'package-lock.json';
  });
}

function verifyPin(sharedSha) {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  const packageLock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  const expectedSpec = `github:ScaleSmall/SSAI_Shared#${sharedSha}`;
  assert.equal(packageJson.dependencies?.['ssai-shared'], expectedSpec, 'Manifest Shared pin is not exact');
  assert.equal(packageLock.packages?.['']?.dependencies?.['ssai-shared'], expectedSpec, 'Lock root Shared pin is not exact');
  const resolved = packageLock.packages?.['node_modules/ssai-shared']?.resolved;
  assert(
    resolved === `git+ssh://git@github.com/ScaleSmall/SSAI_Shared.git#${sharedSha}`
      || resolved === `git+https://github.com/ScaleSmall/SSAI_Shared.git#${sharedSha}`,
    'Lock artifact is not the exact canonical Shared commit',
  );
}

function sterileEnvironment(source, additions) {
  const allowedKeys = [
    'PATH',
    'Path',
    'PATHEXT',
    'SystemRoot',
    'WINDIR',
    'COMSPEC',
    'HOME',
    'USERPROFILE',
    'TEMP',
    'TMP',
    'TMPDIR',
    'LANG',
    'LC_ALL',
    'CI',
    'RUNNER_OS',
    'RUNNER_ARCH',
  ];
  const env = {};
  for (const key of allowedKeys) {
    if (source[key] !== undefined) env[key] = source[key];
  }
  return { ...env, ...additions };
}

function run(command, args, env) {
  const windowsNpmCli = process.platform === 'win32' && command === 'npm'
    ? resolveWindowsNpmCli()
    : null;
  const executable = windowsNpmCli ? process.execPath : command;
  const spawnArgs = windowsNpmCli ? [windowsNpmCli, ...args] : args;
  const result = spawnSync(executable, spawnArgs, {
    encoding: 'utf8',
    env,
    timeout: PROCESS_TIMEOUT_MS,
    windowsHide: true,
    maxBuffer: MAX_BUFFER_BYTES,
  });
  assert.equal(result.error, undefined, `${command} failed to start: ${result.error?.message ?? 'unknown error'}`);
  if (result.status !== 0) {
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
  }
  assert.equal(result.status, 0, `${command} exited ${result.status}`);
}

function resolveWindowsNpmCli() {
  const npmCli = resolve(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  assert(existsSync(npmCli), 'Unable to resolve the trusted npm CLI entry point beside Node.js');
  return npmCli;
}

function gitOutput(args, { trim = true } = {}) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    timeout: PROCESS_TIMEOUT_MS,
    windowsHide: true,
    maxBuffer: MAX_BUFFER_BYTES,
  });
  assert.equal(result.error, undefined, `git failed to start: ${result.error?.message ?? 'unknown error'}`);
  assert.equal(result.status, 0, `git exited ${result.status}: ${String(result.stderr).trim()}`);
  return trim ? result.stdout.trim() : result.stdout.replace(/\r?\n$/, '');
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
