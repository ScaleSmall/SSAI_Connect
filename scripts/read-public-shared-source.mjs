import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const SHARED_REPOSITORY = 'ScaleSmall/SSAI_Shared';
const SHARED_MAIN_REF = 'refs/heads/main';
const SHARED_GIT_URL = 'https://github.com/ScaleSmall/SSAI_Shared.git';
const API_ROOT = 'https://api.github.com';
const RAW_ROOT = 'https://raw.githubusercontent.com';
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const MAX_RESPONSE_BYTES = 1_048_576;
const HTTP_TIMEOUT_MS = 15_000;
const HTTP_ATTEMPTS = 3;
const GIT_TIMEOUT_MS = 20_000;
const NULL_PATH = process.platform === 'win32' ? 'NUL' : '/dev/null';

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function parseLsRemote(stdout) {
  assert.equal(typeof stdout, 'string', 'Git Shared-main response is missing');
  const match = stdout.trim().match(/^([0-9a-f]{40})\s+refs\/heads\/main$/);
  assert(match, 'Git reader must return exactly one immutable Shared refs/heads/main commit');
  return match[1];
}

export function parseRefPayload(rawPayload) {
  const payload = parseJsonObject(rawPayload, 'GitHub Shared-main ref response');
  assert.equal(payload.ref, SHARED_MAIN_REF, 'GitHub ref reader returned a different Shared ref');
  assert.equal(payload.object?.type, 'commit', 'Shared main must resolve directly to a commit');
  assert.match(payload.object?.sha, SHA_PATTERN, 'GitHub ref reader returned a non-immutable Shared SHA');
  return payload.object.sha;
}

export function parseCommitPayload(rawPayload, expectedSha) {
  assert.match(expectedSha, SHA_PATTERN, 'Expected Shared SHA must be immutable');
  const payload = parseJsonObject(rawPayload, 'GitHub Shared commit response');
  assert.equal(payload.sha, expectedSha, 'GitHub commit reader returned another commit');
  assert.match(payload.tree?.sha, SHA_PATTERN, 'Shared commit must identify an immutable tree');
  assert(Array.isArray(payload.parents), 'Shared commit parents must be present');
  for (const parent of payload.parents) {
    assert.match(parent?.sha, SHA_PATTERN, 'Shared commit contains a malformed parent');
  }
  return { sha: payload.sha, treeSha: payload.tree.sha };
}

export function decodeContentsPayload(rawPayload, expectedSha) {
  assert.match(expectedSha, SHA_PATTERN, 'Expected Shared SHA must be immutable');
  const payload = parseJsonObject(rawPayload, 'GitHub Shared package contents response');
  assert.equal(payload.type, 'file', 'Shared package.json must be a file');
  assert.equal(payload.path, 'package.json', 'GitHub contents reader returned another artifact');
  assert.equal(payload.encoding, 'base64', 'GitHub contents reader must return base64 bytes');
  assert.equal(payload.sha?.length, 40, 'Shared package blob must identify an immutable Git object');
  assert.equal(typeof payload.content, 'string', 'Shared package contents are missing');
  const bytes = Buffer.from(payload.content.replace(/\s+/g, ''), 'base64');
  assert(bytes.length > 0 && bytes.length <= MAX_RESPONSE_BYTES, 'Shared package artifact size is invalid');
  return { bytes, blobSha: payload.sha };
}

export function verifySharedEvidence({
  gitSha,
  refSha,
  commit,
  contentsBytes,
  rawBytes,
  packageBlobSha,
}) {
  assert.match(gitSha, SHA_PATTERN, 'Git reader returned a malformed Shared SHA');
  assert.equal(refSha, gitSha, 'Independent Shared-main readers disagree');
  assert.equal(commit.sha, gitSha, 'Commit evidence does not match Shared main');
  assert.match(commit.treeSha, SHA_PATTERN, 'Shared tree evidence is malformed');
  assert.match(packageBlobSha, SHA_PATTERN, 'Shared package blob evidence is malformed');
  assert(Buffer.isBuffer(contentsBytes), 'GitHub contents package bytes are missing');
  assert(Buffer.isBuffer(rawBytes), 'Raw exact-commit package bytes are missing');
  assert(contentsBytes.equals(rawBytes), 'Independent exact-commit Shared package readers disagree byte-for-byte');

  const packageJsonSha256 = sha256(contentsBytes);
  assert.match(packageJsonSha256, SHA256_PATTERN, 'Shared package digest is malformed');
  const packageJson = parseJsonObject(contentsBytes.toString('utf8'), 'Shared package.json');
  assert.equal(packageJson.name, 'ssai-shared', 'Shared package identity is not authoritative');
  assert.equal(packageJson.private, true, 'Shared package must remain non-publishable');
  assert.equal(typeof packageJson.version, 'string', 'Shared package version is missing');
  assert.match(packageJson.version, /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/, 'Shared package version is malformed');

  return {
    repository: SHARED_REPOSITORY,
    ref: SHARED_MAIN_REF,
    sha: gitSha,
    treeSha: commit.treeSha,
    packageBlobSha,
    packageJsonSha256,
    packageVersion: packageJson.version,
  };
}

export async function readPublicSharedSource({
  fetchImpl = globalThis.fetch,
  spawnImpl = spawnSync,
  sleepImpl = delay => new Promise(resolveDelay => setTimeout(resolveDelay, delay)),
} = {}) {
  assert.equal(typeof fetchImpl, 'function', 'A fetch implementation is required');
  const gitSha = readGitMain(spawnImpl);
  const headers = Object.freeze({
    Accept: 'application/vnd.github+json',
    'User-Agent': 'SSAI-Connect-local-shared-pull',
    'X-GitHub-Api-Version': '2022-11-28',
  });

  const refRaw = await fetchBoundedText(
    `${API_ROOT}/repos/${SHARED_REPOSITORY}/git/ref/heads/main`,
    { headers },
    { fetchImpl, sleepImpl },
  );
  const refSha = parseRefPayload(refRaw);
  assert.equal(refSha, gitSha, 'Independent Shared-main readers disagree');

  const [commitRaw, contentsRaw, rawPackage] = await Promise.all([
    fetchBoundedText(
      `${API_ROOT}/repos/${SHARED_REPOSITORY}/git/commits/${gitSha}`,
      { headers },
      { fetchImpl, sleepImpl },
    ),
    fetchBoundedText(
      `${API_ROOT}/repos/${SHARED_REPOSITORY}/contents/package.json?ref=${gitSha}`,
      { headers },
      { fetchImpl, sleepImpl },
    ),
    fetchBoundedBytes(
      `${RAW_ROOT}/${SHARED_REPOSITORY}/${gitSha}/package.json`,
      { headers: { 'User-Agent': headers['User-Agent'] } },
      { fetchImpl, sleepImpl },
    ),
  ]);

  const commit = parseCommitPayload(commitRaw, gitSha);
  const contents = decodeContentsPayload(contentsRaw, gitSha);
  return verifySharedEvidence({
    gitSha,
    refSha,
    commit,
    contentsBytes: contents.bytes,
    rawBytes: rawPackage,
    packageBlobSha: contents.blobSha,
  });
}

function readGitMain(spawnImpl) {
  const env = sanitizePublicEnvironment(process.env);
  const result = spawnImpl(
    'git',
    [
      '-c', 'credential.helper=',
      '-c', 'protocol.file.allow=never',
      '-c', 'protocol.ext.allow=never',
      '-c', 'http.followRedirects=false',
      '-c', 'http.lowSpeedLimit=1024',
      '-c', 'http.lowSpeedTime=10',
      'ls-remote',
      '--refs',
      SHARED_GIT_URL,
      SHARED_MAIN_REF,
    ],
    {
      encoding: 'utf8',
      env,
      timeout: GIT_TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: MAX_RESPONSE_BYTES,
    },
  );
  assert.equal(result.error, undefined, `Git Shared-main reader failed: ${result.error?.message ?? 'unknown error'}`);
  assert.equal(result.status, 0, `Git Shared-main reader exited ${result.status}: ${String(result.stderr).trim()}`);
  return parseLsRemote(result.stdout);
}

export function sanitizePublicEnvironment(source) {
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
  env.GIT_CONFIG_GLOBAL = NULL_PATH;
  env.GIT_CONFIG_NOSYSTEM = '1';
  env.GIT_TERMINAL_PROMPT = '0';
  env.GIT_ASKPASS = NULL_PATH;
  env.SSH_ASKPASS = NULL_PATH;
  return env;
}

async function fetchBoundedText(url, init, dependencies) {
  const bytes = await fetchBoundedBytes(url, init, dependencies);
  return bytes.toString('utf8');
}

async function fetchBoundedBytes(url, init, {
  fetchImpl,
  sleepImpl,
}) {
  let lastError;
  for (let attempt = 1; attempt <= HTTP_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        ...init,
        redirect: 'error',
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
      if (!response.ok) {
        const retryable = response.status === 408
          || response.status === 429
          || (response.status >= 500 && response.status <= 504);
        const error = new Error(`Public Shared reader returned HTTP ${response.status}`);
        if (!retryable) throw error;
        lastError = error;
      } else {
        const contentLength = Number(response.headers.get('content-length') ?? '0');
        if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
          throw new Error('Public Shared response exceeds the bounded size');
        }
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length === 0 || bytes.length > MAX_RESPONSE_BYTES) {
          throw new Error('Public Shared response size is invalid');
        }
        return bytes;
      }
    } catch (error) {
      lastError = error;
      if (attempt === HTTP_ATTEMPTS) break;
    }
    await sleepImpl((2 ** (attempt - 1)) * 500);
  }
  throw new Error(`Public Shared read failed after ${HTTP_ATTEMPTS} bounded attempts: ${lastError?.message ?? 'unknown error'}`);
}

function parseJsonObject(rawValue, label) {
  let parsed;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
  assert(parsed && typeof parsed === 'object' && !Array.isArray(parsed), `${label} must be a JSON object`);
  return parsed;
}

async function runCli() {
  const evidence = await readPublicSharedSource();
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    appendFileSync(outputPath, `shared_sha=${evidence.sha}\n`);
    appendFileSync(outputPath, `shared_tree_sha=${evidence.treeSha}\n`);
    appendFileSync(outputPath, `shared_package_blob_sha=${evidence.packageBlobSha}\n`);
    appendFileSync(outputPath, `shared_package_json_sha256=${evidence.packageJsonSha256}\n`);
    appendFileSync(outputPath, `shared_package_version=${evidence.packageVersion}\n`);
  }
  console.log(JSON.stringify(evidence));
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  runCli().catch(error => {
    console.error(`[shared-public-source] ${error.message}`);
    process.exitCode = 1;
  });
}
