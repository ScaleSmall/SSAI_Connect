import test from 'node:test';
import assert from 'node:assert/strict';

import { activeServiceSlugs } from '../src/serviceEntitlements.js';

const now = Date.parse('2026-07-15T12:00:00.000Z');

test('Connect exposes only current authoritative service entitlements', () => {
  assert.deepEqual(activeServiceSlugs([
    { service_slug: 'jobs_to_socials', status: 'active', active_until: null },
    { service_slug: 'content_engine', status: 'trialing', active_until: '2026-07-16T00:00:00.000Z' },
    { service_slug: 'repeat_referral', status: 'setup_required', active_until: null },
    { service_slug: 'customer_intelligence', status: 'paused', active_until: null },
    { service_slug: 'seo_gbp_audit', status: 'cancelled', active_until: null },
  ], now), [
    'jobs_to_socials',
    'content_engine',
    'repeat_referral',
    'customer_intelligence',
  ]);
});

test('Connect fails closed on expired or malformed entitlement dates', () => {
  assert.deepEqual(activeServiceSlugs([
    { service_slug: 'jobs_to_socials', status: 'active', active_until: '2026-07-15T11:59:59.000Z' },
    { service_slug: 'content_engine', status: 'active', active_until: 'not-a-date' },
    { service_slug: 'repeat_referral', status: 'inactive', active_until: null },
  ], now), []);
});

test('Connect de-duplicates service rows and rejects malformed input', () => {
  assert.deepEqual(activeServiceSlugs([
    { service_slug: 'repeat_referral', status: 'active' },
    { service_slug: 'repeat_referral', status: 'setup_required' },
    { service_slug: '', status: 'active' },
    null,
  ], now), ['repeat_referral']);
  assert.deepEqual(activeServiceSlugs(null, now), []);
});
