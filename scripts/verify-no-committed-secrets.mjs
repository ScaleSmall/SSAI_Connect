#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const ignoredDirectories = new Set([
  '.git',
  'node_modules',
  'dist',
  'dist-ssr',
  'build',
  'coverage',
  '.next',
  '.turbo',
  '.vite',
]);
const ignoredFiles = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']);
const maxBytes = 2 * 1024 * 1024;

const detectors = [
  ['Stripe secret or publishable key', /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{8,}\b/g],
  ['Stripe webhook signing secret', /\bwhsec_[A-Za-z0-9_]{16,}\b/g],
  ['JWT-shaped token', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g],
  ['AWS access key id', /\bAKIA[0-9A-Z]{16}\b/g],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ['OpenAI API key', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b/g],
  ['Anthropic API key', /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g],
  ['Resend API key', /\bre_[A-Za-z0-9_-]{16,}\b/g],
  ['GitHub token', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b|github_pat_[A-Za-z0-9_]{20,}/g],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g],
  ['SendGrid API key', /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g],
  ['Twilio account SID', /\bAC[0-9a-fA-F]{32}\b/g],
  ['Private key block', /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g],
];

const failures = [];

for (const file of candidateFiles()) {
  const text = readFileSync(file, 'utf8');
  const rel = relative(root, file).replaceAll('\\', '/');
  for (const [label, pattern] of detectors) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      failures.push(`${rel}: contains ${label}`);
    }
  }
}

if (failures.length) {
  console.error('[no-committed-secrets] FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[no-committed-secrets] OK');

function* walk(directory) {
  for (const entry of readdirSync(directory)) {
    if (ignoredDirectories.has(entry)) continue;
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      yield* walk(fullPath);
      continue;
    }
    if (!stats.isFile()) continue;
    if (ignoredFiles.has(entry)) continue;
    if (stats.size > maxBytes) continue;
    if (looksBinary(fullPath)) continue;
    yield fullPath;
  }
}

function candidateFiles() {
  try {
    return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .split(/\r?\n/)
      .filter(Boolean)
      .map((file) => join(root, file))
      .filter((file) => existsSync(file) && statSync(file).isFile())
      .filter((file) => !ignoredFiles.has(file.split(/[\\/]/).at(-1)))
      .filter((file) => statSync(file).size <= maxBytes)
      .filter((file) => !looksBinary(file));
  } catch {
    return [...walk(root)];
  }
}

function looksBinary(file) {
  if (!existsSync(file)) return true;
  const sample = readFileSync(file).subarray(0, 512);
  return sample.includes(0);
}
