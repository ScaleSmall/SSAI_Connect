#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const workflowDir = path.join(process.cwd(), '.github', 'workflows');
const failures = [];

const validate = readWorkflow('validate.yml');
const retired = readWorkflow('update-shared.yml');
readWorkflow('pull-shared-with-protected-evidence.yml');
readWorkflow('prove-shared-update-release.yml');

if (validate) verifyValidateWorkflow(validate);
if (retired) verifyRetiredWorkflow(retired);

if (failures.length) {
  console.error('[workflows] SSAI_Connect workflow hardening failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('[workflows] SSAI_Connect workflows hardened');

function readWorkflow(file) {
  const fullPath = path.join(workflowDir, file);
  if (!existsSync(fullPath)) {
    failures.push(`${file}: missing workflow`);
    return '';
  }
  return readFileSync(fullPath, 'utf8');
}

function verifyValidateWorkflow(text) {
  const file = 'validate.yml';
  verifyPinnedRuntime(file, text);
  requireMatch(file, text, /^on:\r?\n {2}workflow_dispatch:\r?\n/m,
    'must expose the exact correlated workflow_dispatch gate');
  requireMatch(file, text, /release_proof_id:[\s\S]*?required:\s*true/,
    'release_proof_id must be mandatory');
  requireMatch(file, text, /^ {2}pull_request:\s*\r?\n {2}push:\r?\n {4}branches:\s*\[main\]/m,
    'must retain pull-request and protected-main validation');
  requireMatch(file, text, /permissions:\r?\n {2}contents:\s*read\b/,
    'must declare read-only contents permission');
  requireMatch(file, text, /DISPATCH_ACTOR[\s\S]*github-actions\[bot\]/,
    'explicit release dispatch must bind the repository Actions bot');
  requireMatch(file, text, /DISPATCH_TRIGGERING_ACTOR[\s\S]*github-actions\[bot\]/,
    'explicit release retriggers must remain bot-owned');
  requireMatch(file, text, /Create nonsecret validation-only browser configuration/,
    'must construct only synthetic validation browser configuration');
  requireMatch(file, text, /npm ci --ignore-scripts --audit=false --fund=false/,
    'dependency installation must remain public and lifecycle-script free');
  requireMatch(file, text, /npm run check\b/,
    'must run the complete production-readiness check');
  requireMatch(file, text, /verify-connect-build-identity-dist\.mjs/,
    'must verify the exact candidate build identity');
  forbid(file, text, /secrets\./, 'must not expose repository secrets to candidate validation');
  forbid(file, text, /SCALESMALL_PAT/, 'must not depend on the retired cross-repository PAT');
  forbid(file, text, /pull-requests:\s*write|contents:\s*write|actions:\s*write/,
    'validation must not receive write permission');
}

function verifyRetiredWorkflow(text) {
  const file = 'update-shared.yml';
  requireMatch(file, text, /^name:\s*Retired legacy Shared package consumer\s*$/m,
    'must retain an explicit retired identity');
  requireMatch(file, text, /^on:\r?\n {2}workflow_dispatch:\s*\r?\n/m,
    'must be manual-only and inert');
  requireMatch(file, text, /^permissions:\s*\{\}\s*$/m,
    'must grant no workflow permission');
  requireMatch(file, text, /if:\s*\$\{\{\s*false\s*\}\}/,
    'retired job must be unconditionally skipped');
  for (const [pattern, reason] of [
    [/repository_dispatch/, 'must not accept the retired producer dispatch'],
    [/SCALESMALL_PAT|secrets\./, 'must not consume secrets'],
    [/contents:\s*write|pull-requests:\s*write|actions:\s*write/, 'must not hold write permission'],
    [/\bgit\s+push\b|\bgh\s+pr\b|\bnpm\s+(?:ci|install|run)\b/, 'must not author, execute, or publish code'],
  ]) forbid(file, text, pattern, reason);
}

function verifyPinnedRuntime(file, text) {
  forbid(file, text, /runs-on:\s*ubuntu-latest\b/i, 'use ubuntu-24.04 instead of ubuntu-latest');
  requireMatch(file, text, /runs-on:\s*ubuntu-24\.04\b/,
    'missing pinned Ubuntu runner');
  requireMatch(file, text, /node-version:\s*['"]?24['"]?\b/,
    'missing Node 24 setup');
  forbid(file, text, /actions\/(?:checkout|setup-node)@v\d+/i,
    'pin GitHub actions by commit SHA, not floating version tags');
  if (/actions\/checkout@/i.test(text) && !/persist-credentials:\s*false\b/i.test(text)) {
    failures.push(`${file}: checkout must set persist-credentials: false`);
  }
}

function requireMatch(file, text, pattern, reason) {
  if (!pattern.test(text)) failures.push(`${file}: ${reason}`);
}

function forbid(file, text, pattern, reason) {
  if (pattern.test(text)) failures.push(`${file}: ${reason}`);
}
