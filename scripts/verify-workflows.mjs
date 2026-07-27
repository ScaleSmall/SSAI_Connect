#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const workflowDir = path.join(process.cwd(), '.github', 'workflows');
const workflows = [
  {
    file: 'validate.yml',
    write: false,
    requireCheck: true,
  },
  {
    file: 'update-shared.yml',
    write: false,
    requireCheck: true,
  },
];

const failures = [];

for (const workflow of workflows) {
  const fullPath = path.join(workflowDir, workflow.file);
  if (!existsSync(fullPath)) {
    failures.push(`${workflow.file}: missing workflow`);
    continue;
  }
  const text = readFileSync(fullPath, 'utf8');
  checkWorkflow(workflow.file, text, workflow);
}

if (failures.length) {
  console.error('[workflows] SSAI_Connect workflow hardening failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('[workflows] SSAI_Connect workflows hardened');

function checkWorkflow(file, text, { write, requireCheck }) {
  if (/runs-on:\s*ubuntu-latest\b/i.test(text)) {
    failures.push(`${file}: use ubuntu-24.04 instead of ubuntu-latest`);
  }
  if (/node-version:\s*['"]?2[02]['"]?\b/i.test(text)) {
    failures.push(`${file}: use Node 24 for validation/build parity`);
  }
  if (!/node-version:\s*['"]?24['"]?\b/i.test(text)) {
    failures.push(`${file}: missing Node 24 setup`);
  }
  if (/actions\/(?:checkout|setup-node)@v\d+/i.test(text)) {
    failures.push(`${file}: pin GitHub actions by commit SHA, not floating version tags`);
  }
  if (/actions\/checkout@/i.test(text) && !/persist-credentials:\s*false\b/i.test(text)) {
    failures.push(`${file}: checkout must set persist-credentials: false`);
  }
  const permissionPattern = write
    ? /permissions:\s*\r?\n\s*contents:\s*write\b/i
    : /permissions:\s*\r?\n\s*contents:\s*read\b/i;
  if (!permissionPattern.test(text)) {
    failures.push(`${file}: workflow must declare ${write ? 'write' : 'read-only'} contents permission`);
  }
  if (requireCheck && !/npm run check\b/.test(text)) {
    failures.push(`${file}: workflow must run npm run check`);
  }
  if (file === 'update-shared.yml') {
    if (/pull-requests:\s*write\b/i.test(text)) {
      failures.push(`${file}: the repository token must remain read-only`);
    }
    if (/GH_TOKEN:\s*\$\{\{\s*github\.token\s*\}\}/.test(text)) {
      failures.push(`${file}: repository GITHUB_TOKEN writes would suppress required PR checks`);
    }
    const patAuthoringBindings = text.match(
      /GH_TOKEN:\s*\$\{\{\s*secrets\.SCALESMALL_PAT\s*\}\}/g,
    ) ?? [];
    if (patAuthoringBindings.length < 3) {
      failures.push(`${file}: branch, rebase, and PR writes must use the existing automation PAT`);
    }
    if (!/gh pr create\b/.test(text)) {
      failures.push(`${file}: dependency automation must open a protected pull request`);
    }
    if (!/--base\s+main\b/.test(text)) {
      failures.push(`${file}: dependency automation pull requests must target main`);
    }
    const branchAssignments = [
      ...text.matchAll(/^\s*branch="([^"]+)"\s*$/gm),
    ].map((match) => match[1]);
    if (
      branchAssignments.length === 0
      || branchAssignments.some((branch) => branch !== 'automation/update-shared')
    ) {
      failures.push(`${file}: dependency automation must reuse one bounded branch`);
    }
    if (!/gh pr list[\s\S]*--state\s+open/.test(text)) {
      failures.push(`${file}: dependency automation must update an existing open pull request`);
    }
    if (!/git rev-list --count origin\/main\.\.HEAD/.test(text)) {
      failures.push(`${file}: dependency automation must recover an existing unmerged branch`);
    }
    if (!/HEAD:refs\/heads\/\$branch\b/.test(text)) {
      failures.push(`${file}: dependency automation must push only its generated branch`);
    }
    if (
      !/remote_branch_sha="\$\(/
        .test(text)
      || !/--force-with-lease="refs\/heads\/\$branch:\$REMOTE_BRANCH_SHA"/.test(text)
    ) {
      failures.push(`${file}: persistent automation branch updates must use an exact force-with-lease`);
    }
    const localCommitIndex = text.indexOf('git commit -m "chore: update ssai-shared dependency"');
    const fullCheckIndex = text.indexOf('run: npm run check');
    const remotePushIndex = text.indexOf('HEAD:refs/heads/$branch');
    if (
      localCommitIndex === -1
      || fullCheckIndex === -1
      || remotePushIndex === -1
      || !(localCommitIndex < fullCheckIndex && fullCheckIndex < remotePushIndex)
    ) {
      failures.push(`${file}: local commit must precede the full clean-tree check and remote push`);
    }
    if (
      /^\s*git\s+push\b[^\r\n]*(?:\s|:)main(?:\s|$)/im.test(text)
      || /^\s*git\s+push\s*$/im.test(text)
    ) {
      failures.push(`${file}: dependency automation must never push directly to main`);
    }
    if (!/if:\s*steps\.changes\.outputs\.changed\s*==\s*'true'/i.test(text)) {
      failures.push(`${file}: dependency automation must skip branch and PR writes when nothing changed`);
    }
  }
  if (/VITE_SUPABASE_ANON_KEY:\s*\$\{\{\s*secrets\.SSAI_PROD_SUPABASE_ANON_KEY\s*\}\}/.test(text) === false) {
    failures.push(`${file}: workflow must provide VITE_SUPABASE_ANON_KEY from production secrets`);
  }
  if (/VITE_SUPABASE_URL:\s*\$\{\{\s*secrets\.SSAI_PROD_SUPABASE_URL\s*\}\}/.test(text) === false) {
    failures.push(`${file}: workflow must provide VITE_SUPABASE_URL from production secrets`);
  }
}
