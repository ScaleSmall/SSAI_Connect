#!/usr/bin/env node

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://oyyfpkpzalhxztpcdjgq.supabase.co';
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

failIfPlaceholder('VITE_SUPABASE_URL', supabaseUrl);
failIfPlaceholder('VITE_SUPABASE_ANON_KEY', anonKey);

let projectRef;
try {
  const parsed = new URL(supabaseUrl);
  const match = parsed.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/);
  if (!match) throw new Error('not a Supabase project host');
  projectRef = match[1];
} catch {
  fail('VITE_SUPABASE_URL must be a real https://<project-ref>.supabase.co URL');
}

const payload = parseJwtPayload(anonKey, 'VITE_SUPABASE_ANON_KEY');
const role = String(payload.role || '');
const ref = String(payload.ref || '');
const issuer = String(payload.iss || '');

if (role !== 'anon') {
  fail(`VITE_SUPABASE_ANON_KEY must be a browser-safe anon role key; observed role "${role || 'missing'}"`);
}

if (role === 'service_role') {
  fail('VITE_SUPABASE_ANON_KEY must never use a Supabase service_role key');
}

if (ref && ref !== projectRef) {
  fail('VITE_SUPABASE_ANON_KEY project ref does not match VITE_SUPABASE_URL');
}

if (!issuer || issuer !== 'supabase') {
  fail('VITE_SUPABASE_ANON_KEY must be issued by Supabase');
}

console.log('[connect-env] Supabase browser config OK');

function failIfPlaceholder(name, value) {
  if (!value) fail(`${name} is required`);
  if (/replace-with|placeholder|changeme|your-/i.test(value)) {
    fail(`${name} must be a real value, not a placeholder`);
  }
}

function parseJwtPayload(token, name) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) fail(`${name} must be a JWT-shaped Supabase anon key`);
  try {
    return JSON.parse(Buffer.from(toBase64(parts[1]), 'base64').toString('utf8'));
  } catch {
    fail(`${name} must contain a readable JWT payload`);
  }
}

function toBase64(base64Url) {
  const normalized = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  return normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
}

function fail(message) {
  console.error(`[connect-env] ${message}`);
  process.exit(1);
}
