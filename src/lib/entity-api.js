import { supabase } from '../supabase';
import { ENTITY_API_BASE } from '../config';

async function getHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const h = { 'Content-Type': 'application/json' };
  if (session?.access_token) h['Authorization'] = `Bearer ${session.access_token}`;
  return h;
}

async function request(method, path, body) {
  const headers = await getHeaders();
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${ENTITY_API_BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const entityApi = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  patch: (path, body) => request('PATCH', path, body),
};
