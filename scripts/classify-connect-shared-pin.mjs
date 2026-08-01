import assert from 'node:assert/strict';
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const CANONICAL_SPEC_PATTERN = /^github:ScaleSmall\/SSAI_Shared(?:#([0-9a-f]{40}))?$/;
const CANONICAL_RESOLVED_PATTERN = /^git\+(?:ssh:\/\/git@|https:\/\/)github\.com\/ScaleSmall\/SSAI_Shared\.git#([0-9a-f]{40})$/;

export function classifyConnectSharedPin({ packageJson, packageLock, targetSha }) {
  assert.match(targetSha, SHA_PATTERN, 'Target Shared SHA must be immutable');
  const manifestSpec = packageJson?.dependencies?.['ssai-shared'];
  const lockSpec = packageLock?.packages?.['']?.dependencies?.['ssai-shared'];
  const resolved = packageLock?.packages?.['node_modules/ssai-shared']?.resolved;

  const manifestMatch = typeof manifestSpec === 'string' ? manifestSpec.match(CANONICAL_SPEC_PATTERN) : null;
  const lockMatch = typeof lockSpec === 'string' ? lockSpec.match(CANONICAL_SPEC_PATTERN) : null;
  const resolvedMatch = typeof resolved === 'string' ? resolved.match(CANONICAL_RESOLVED_PATTERN) : null;
  assert(manifestMatch, 'Connect manifest must reference only canonical ScaleSmall/SSAI_Shared');
  assert(lockMatch, 'Connect lock root must reference only canonical ScaleSmall/SSAI_Shared');
  assert(resolvedMatch, 'Connect lock artifact must resolve only canonical ScaleSmall/SSAI_Shared');

  const targetSpec = `github:ScaleSmall/SSAI_Shared#${targetSha}`;
  const noChange = manifestSpec === targetSpec
    && lockSpec === targetSpec
    && resolvedMatch[1] === targetSha;
  const currentSha = manifestMatch[1] || lockMatch[1] || resolvedMatch[1];
  if (currentSha) assert.match(currentSha, SHA_PATTERN, 'Current Shared pin is malformed');

  return {
    mode: noChange ? 'no_change' : 'update',
    currentSha: currentSha ?? '',
    targetSha,
  };
}

function runCli() {
  const targetSha = process.env.TARGET_SHARED_SHA ?? '';
  const result = classifyConnectSharedPin({
    packageJson: JSON.parse(readFileSync('package.json', 'utf8')),
    packageLock: JSON.parse(readFileSync('package-lock.json', 'utf8')),
    targetSha,
  });
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    appendFileSync(outputPath, `mode=${result.mode}\n`);
    appendFileSync(outputPath, `current_shared_sha=${result.currentSha}\n`);
  }
  console.log(`[connect-shared-pin] mode=${result.mode} current=${result.currentSha || 'floating'} target=${result.targetSha}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) runCli();
