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
    write: true,
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
  if (/VITE_SUPABASE_ANON_KEY:\s*\$\{\{\s*secrets\.SSAI_PROD_SUPABASE_ANON_KEY\s*\}\}/.test(text) === false) {
    failures.push(`${file}: workflow must provide VITE_SUPABASE_ANON_KEY from production secrets`);
  }
  if (/VITE_SUPABASE_URL:\s*\$\{\{\s*secrets\.SSAI_PROD_SUPABASE_URL\s*\}\}/.test(text) === false) {
    failures.push(`${file}: workflow must provide VITE_SUPABASE_URL from production secrets`);
  }
}
