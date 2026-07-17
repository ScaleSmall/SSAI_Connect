export const CONNECT_ACTIVE_SERVICE_STATUSES = new Set([
  'active',
  'trialing',
  'setup_required',
  'paused',
]);

export function activeServiceSlugs(rows, nowMs = Date.now()) {
  if (!Array.isArray(rows)) return [];

  const active = new Set();
  for (const row of rows) {
    const slug = String(row?.service_slug || '').trim();
    const status = String(row?.status || '').trim().toLowerCase();
    if (!slug || !CONNECT_ACTIVE_SERVICE_STATUSES.has(status)) continue;

    if (row?.active_until != null) {
      const expiresAt = Date.parse(String(row.active_until));
      if (!Number.isFinite(expiresAt) || expiresAt <= nowMs) continue;
    }

    active.add(slug);
  }

  return [...active];
}
