import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFrozenTikTokOAuthStartUrl,
  buildOAuthStartUrl,
  isTrustedOAuthRelayMessage,
  isValidOAuthRequestId,
  oauthRelayChannelName,
  parseFrozenTikTokCompletion,
  parseOAuthCompletion,
} from '../src/oauthFlow.js';

const REQUEST_ID = '123e4567-e89b-42d3-a456-426614174000';
const ORIGIN = 'https://connect-preview.example.com';

test('OAuth start binds the tenant, request, return origin, and JSON response mode', () => {
  const url = new URL(buildOAuthStartUrl({
    baseUrl: 'https://project.supabase.co',
    requestedPlatform: 'facebook',
    clientId: 'client_one',
    origin: ORIGIN,
    requestId: REQUEST_ID,
  }));

  assert.equal(url.origin, 'https://project.supabase.co');
  assert.equal(url.pathname, '/functions/v1/oauth-start');
  assert.equal(url.searchParams.get('platform'), 'facebook');
  assert.equal(url.searchParams.get('client_id'), 'client_one');
  assert.equal(url.searchParams.get('format'), 'json');
  assert.equal(url.searchParams.get('return_to'), `${ORIGIN}/oauth-complete?oauth_request_id=${REQUEST_ID}`);
});

test('GBP uses the Google OAuth provider with an exact GBP product request', () => {
  const url = new URL(buildOAuthStartUrl({
    baseUrl: 'https://project.supabase.co',
    requestedPlatform: 'gbp',
    clientId: 'client_two',
    origin: ORIGIN,
    requestId: REQUEST_ID,
  }));
  assert.equal(url.searchParams.get('platform'), 'google');
  assert.equal(url.searchParams.get('google_product'), 'gbp');
});

test('TikTok retains the approved pre-elevation OAuth request and callback contract', () => {
  const url = new URL(buildFrozenTikTokOAuthStartUrl({
    baseUrl: 'https://project.supabase.co',
    clientId: 'client_tiktok',
    origin: ORIGIN,
  }));
  assert.equal(url.searchParams.get('platform'), 'tiktok');
  assert.equal(url.searchParams.get('client_id'), 'client_tiktok');
  assert.equal(url.searchParams.get('format'), 'json');
  assert.equal(url.searchParams.get('return_to'), `${ORIGIN}/oauth-complete`);
  assert.equal(url.searchParams.has('oauth_request_id'), false);

  assert.deepEqual(parseFrozenTikTokCompletion('?connected=tiktok'), {
    platform: 'tiktok',
    failed: false,
    message: { type: 'oauth-success', platform: 'tiktok' },
  });
  assert.equal(parseFrozenTikTokCompletion('?connected=facebook'), null);
});

test('OAuth start rejects unknown platforms, unsafe API URLs, malformed tenants, and bad request IDs', () => {
  const base = { baseUrl: 'https://project.supabase.co', requestedPlatform: 'facebook', clientId: 'client_one', origin: ORIGIN, requestId: REQUEST_ID };
  assert.throws(() => buildOAuthStartUrl({ ...base, requestedPlatform: 'unknown' }), /Unsupported/);
  assert.throws(() => buildOAuthStartUrl({ ...base, baseUrl: 'http://project.supabase.co' }), /HTTPS/);
  assert.throws(() => buildOAuthStartUrl({ ...base, clientId: '../other-tenant' }), /client identifier/);
  assert.throws(() => buildOAuthStartUrl({ ...base, requestId: 'not-a-uuid' }), /request identifier/);
});

test('OAuth completion produces a bounded success relay', () => {
  const result = parseOAuthCompletion(`?connected=linkedin&oauth_request_id=${REQUEST_ID}`, ORIGIN);
  assert.deepEqual(result, {
    requestId: REQUEST_ID,
    platform: 'linkedin',
    failed: false,
    message: {
      type: 'oauth-success', platform: 'linkedin', requestId: REQUEST_ID, source: 'oauth-complete', origin: ORIGIN,
    },
  });
});

test('OAuth completion never relays provider or query-string error details', () => {
  const result = parseOAuthCompletion(`?platform=facebook&oauth_error=${encodeURIComponent('secret client configuration')}&oauth_request_id=${REQUEST_ID}`, ORIGIN);
  assert.equal(result.failed, true);
  assert.deepEqual(Object.keys(result.message).sort(), ['origin', 'platform', 'requestId', 'source', 'type']);
  assert.equal(JSON.stringify(result).includes('secret client configuration'), false);
});

test('OAuth completion ignores malformed request IDs and unknown callback platforms', () => {
  assert.equal(parseOAuthCompletion('?connected=facebook&oauth_request_id=bad', ORIGIN), null);
  const result = parseOAuthCompletion(`?connected=internal_admin&oauth_request_id=${REQUEST_ID}`, ORIGIN);
  assert.equal(result.failed, true);
  assert.equal(result.platform, '');
});

test('relay validation rejects request, source, origin, type, and platform spoofing', () => {
  const trusted = { type: 'oauth-success', platform: 'youtube', requestId: REQUEST_ID, source: 'oauth-complete', origin: ORIGIN };
  assert.equal(isTrustedOAuthRelayMessage(trusted, { requestId: REQUEST_ID, origin: ORIGIN }), true);
  assert.equal(isTrustedOAuthRelayMessage({ ...trusted, requestId: crypto.randomUUID() }, { requestId: REQUEST_ID, origin: ORIGIN }), false);
  assert.equal(isTrustedOAuthRelayMessage({ ...trusted, source: 'other' }, { requestId: REQUEST_ID, origin: ORIGIN }), false);
  assert.equal(isTrustedOAuthRelayMessage({ ...trusted, origin: 'https://attacker.example' }, { requestId: REQUEST_ID, origin: ORIGIN }), false);
  assert.equal(isTrustedOAuthRelayMessage({ ...trusted, type: 'token' }, { requestId: REQUEST_ID, origin: ORIGIN }), false);
  assert.equal(isTrustedOAuthRelayMessage({ ...trusted, platform: 'internal_admin' }, { requestId: REQUEST_ID, origin: ORIGIN }), false);
});

test('relay channel names require UUID request identifiers', () => {
  assert.equal(isValidOAuthRequestId(REQUEST_ID), true);
  assert.equal(oauthRelayChannelName(REQUEST_ID), `ssai-oauth:${REQUEST_ID}`);
  assert.throws(() => oauthRelayChannelName('shared-channel'), /request identifier/);
});
