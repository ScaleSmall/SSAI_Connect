import assert from 'node:assert/strict';
import test from 'node:test';
import {
  abortable,
  buildOAuthStartUrl,
  closeOwnedOAuthPopup,
  isCurrentClientOperation,
  isCurrentOAuthRequest,
  isTrustedOAuthRelayMessage,
  isValidOAuthRequestId,
  oauthRelayChannelName,
  parseOAuthCompletion,
  validateOAuthAuthorizationUrl,
} from '../src/oauthFlow.js';

const REQUEST_ID = '123e4567-e89b-42d3-a456-426614174000';
const ORIGIN = 'https://connect-preview.example.com';
const CONNECTOR_OAUTH_PROVIDERS = Object.freeze([
  { platform: 'companycam', authorizationUrl: 'https://app.companycam.com/oauth/authorize?client_id=public' },
  { platform: 'jobber', authorizationUrl: 'https://api.getjobber.com/api/oauth/authorize?client_id=public' },
  { platform: 'dropbox', authorizationUrl: 'https://www.dropbox.com/oauth2/authorize?client_id=public' },
  { platform: 'google_drive', authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=public' },
  { platform: 'hubspot', authorizationUrl: 'https://app.hubspot.com/oauth/authorize?client_id=public' },
  { platform: 'gohighlevel', authorizationUrl: 'https://marketplace.leadconnectorhq.com/oauth/chooselocation?client_id=public' },
  { platform: 'salesforce', authorizationUrl: 'https://login.salesforce.com/services/oauth2/authorize?client_id=public' },
]);

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

test('GBP preserves the Dashboard platform identity with an exact GBP product request', () => {
  const url = new URL(buildOAuthStartUrl({
    baseUrl: 'https://project.supabase.co',
    requestedPlatform: 'gbp',
    clientId: 'client_two',
    origin: ORIGIN,
    requestId: REQUEST_ID,
  }));
  assert.equal(url.searchParams.get('platform'), 'gbp');
  assert.equal(url.searchParams.get('google_product'), 'gbp');
});

test('TikTok uses the same request-bound OAuth relay as every approved provider', () => {
  const url = new URL(buildOAuthStartUrl({
    baseUrl: 'https://project.supabase.co',
    requestedPlatform: 'tiktok',
    clientId: 'client_tiktok',
    origin: ORIGIN,
    requestId: REQUEST_ID,
  }));
  assert.equal(url.searchParams.get('platform'), 'tiktok');
  assert.equal(url.searchParams.get('client_id'), 'client_tiktok');
  assert.equal(url.searchParams.get('format'), 'json');
  assert.equal(url.searchParams.get('return_to'), `${ORIGIN}/oauth-complete?oauth_request_id=${REQUEST_ID}`);

  assert.deepEqual(parseOAuthCompletion(`?connected=tiktok&oauth_request_id=${REQUEST_ID}`, ORIGIN), {
    requestId: REQUEST_ID,
    platform: 'tiktok',
    failed: false,
    message: {
      type: 'oauth-success', platform: 'tiktok', requestId: REQUEST_ID, source: 'oauth-complete', origin: ORIGIN,
    },
  });
});

test('connector OAuth starts preserve provider, tenant, and request-bound callback integrity', () => {
  for (const { platform } of CONNECTOR_OAUTH_PROVIDERS) {
    const url = new URL(buildOAuthStartUrl({
      baseUrl: 'https://project.supabase.co',
      requestedPlatform: platform,
      clientId: `client_${platform}`,
      origin: ORIGIN,
      requestId: REQUEST_ID,
    }));
    assert.equal(url.origin, 'https://project.supabase.co', platform);
    assert.equal(url.pathname, '/functions/v1/oauth-start', platform);
    assert.equal(url.searchParams.get('platform'), platform, platform);
    assert.equal(url.searchParams.get('client_id'), `client_${platform}`, platform);
    assert.equal(url.searchParams.get('format'), 'json', platform);
    assert.equal(
      url.searchParams.get('return_to'),
      `${ORIGIN}/oauth-complete?oauth_request_id=${REQUEST_ID}`,
      platform,
    );
  }
});

test('OAuth start rejects unknown platforms, unsafe API URLs, malformed tenants, and bad request IDs', () => {
  const base = { baseUrl: 'https://project.supabase.co', requestedPlatform: 'facebook', clientId: 'client_one', origin: ORIGIN, requestId: REQUEST_ID };
  assert.throws(() => buildOAuthStartUrl({ ...base, requestedPlatform: 'unknown' }), /Unsupported/);
  assert.throws(() => buildOAuthStartUrl({ ...base, requestedPlatform: 'google' }), /Unsupported/);
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
  const expected = { requestId: REQUEST_ID, origin: ORIGIN, expectedPlatform: 'youtube' };
  assert.equal(isTrustedOAuthRelayMessage(trusted, expected), true);
  assert.equal(isTrustedOAuthRelayMessage({ ...trusted, requestId: crypto.randomUUID() }, expected), false);
  assert.equal(isTrustedOAuthRelayMessage({ ...trusted, source: 'other' }, expected), false);
  assert.equal(isTrustedOAuthRelayMessage({ ...trusted, origin: 'https://attacker.example' }, expected), false);
  assert.equal(isTrustedOAuthRelayMessage({ ...trusted, type: 'token' }, expected), false);
  assert.equal(isTrustedOAuthRelayMessage({ ...trusted, platform: 'internal_admin' }, expected), false);
  assert.equal(isTrustedOAuthRelayMessage({ ...trusted, platform: 'tiktok' }, expected), false);
  assert.equal(isTrustedOAuthRelayMessage({ ...trusted, platform: '' }, expected), false);
  assert.equal(isTrustedOAuthRelayMessage({ ...trusted, type: 'oauth-error', platform: '' }, expected), true);
  assert.equal(isTrustedOAuthRelayMessage({ ...trusted, type: 'oauth-error', platform: 'tiktok' }, expected), false);
});

test('authorization redirects are bound to the exact approved provider host and path', () => {
  assert.match(
    validateOAuthAuthorizationUrl('https://www.tiktok.com/v2/auth/authorize/?client_key=public', 'tiktok'),
    /^https:\/\/www\.tiktok\.com\/v2\/auth\/authorize\//,
  );
  assert.throws(
    () => validateOAuthAuthorizationUrl('https://attacker.example/v2/auth/authorize/?client_key=public', 'tiktok'),
    /not approved/,
  );
  assert.throws(
    () => validateOAuthAuthorizationUrl('https://www.tiktok.com.evil.example/v2/auth/authorize/', 'tiktok'),
    /not approved/,
  );
  assert.throws(
    () => validateOAuthAuthorizationUrl('https://www.tiktok.com/account/login', 'tiktok'),
    /not approved/,
  );
});

test('connector authorization redirects match exact backend provider targets', () => {
  for (const { platform, authorizationUrl } of CONNECTOR_OAUTH_PROVIDERS) {
    assert.equal(validateOAuthAuthorizationUrl(authorizationUrl, platform), authorizationUrl, platform);

    const approved = new URL(authorizationUrl);
    const suffixAttack = new URL(authorizationUrl);
    suffixAttack.hostname = `${approved.hostname}.evil.example`;
    assert.throws(
      () => validateOAuthAuthorizationUrl(suffixAttack, platform),
      /not approved/,
      `${platform} rejects hostname suffix attacks`,
    );

    const wrongPath = new URL(authorizationUrl);
    wrongPath.pathname = '/account/login';
    assert.throws(
      () => validateOAuthAuthorizationUrl(wrongPath, platform),
      /not approved/,
      `${platform} rejects an unapproved provider path`,
    );

    const differentPlatform = platform === 'hubspot' ? 'dropbox' : 'hubspot';
    assert.throws(
      () => validateOAuthAuthorizationUrl(authorizationUrl, differentPlatform),
      /not approved/,
      `${platform} cannot be substituted into another provider request`,
    );
  }

  const sandboxUrl = 'https://test.salesforce.com/services/oauth2/authorize?client_id=public';
  assert.equal(validateOAuthAuthorizationUrl(sandboxUrl, 'salesforce'), sandboxUrl);
  assert.throws(
    () => validateOAuthAuthorizationUrl(
      'https://customer.my.salesforce.com/services/oauth2/authorize?client_id=public',
      'salesforce',
    ),
    /not approved/,
  );
});

test('connector callbacks and relays remain bound to exact provider and request identifiers', () => {
  const staleRequestId = '223e4567-e89b-42d3-a456-426614174000';
  for (const { platform } of CONNECTOR_OAUTH_PROVIDERS) {
    const completion = parseOAuthCompletion(
      `?connected=${encodeURIComponent(platform)}&oauth_request_id=${REQUEST_ID}`,
      ORIGIN,
    );
    assert.equal(completion?.failed, false, platform);
    assert.equal(completion?.platform, platform, platform);
    assert.equal(completion?.requestId, REQUEST_ID, platform);

    const expected = { requestId: REQUEST_ID, origin: ORIGIN, expectedPlatform: platform };
    assert.equal(isTrustedOAuthRelayMessage(completion.message, expected), true, platform);
    assert.equal(
      isTrustedOAuthRelayMessage({ ...completion.message, requestId: staleRequestId }, expected),
      false,
      `${platform} rejects a stale request`,
    );
    assert.equal(
      isTrustedOAuthRelayMessage({ ...completion.message, platform: platform === 'hubspot' ? 'dropbox' : 'hubspot' }, expected),
      false,
      `${platform} rejects a cross-provider callback`,
    );
  }
});

test('abortable bounds a never-resolving token provider', async () => {
  const controller = new AbortController();
  const pending = abortable(new Promise(() => {}), controller.signal);
  controller.abort();
  await assert.rejects(pending, error => error?.name === 'AbortError');
});

test('scoped async results cannot cross client boundaries', () => {
  const current = { sequence: 7, clientId: 'client_two' };
  assert.equal(isCurrentClientOperation(current, 7, 'client_two'), true);
  assert.equal(isCurrentClientOperation(current, 6, 'client_two'), false);
  assert.equal(isCurrentClientOperation(current, 7, 'client_one'), false);
});

test('OAuth cleanup ownership cannot cross request boundaries', () => {
  const replacementRequestId = '223e4567-e89b-42d3-a456-426614174000';
  assert.equal(isCurrentOAuthRequest(REQUEST_ID, REQUEST_ID), true);
  assert.equal(isCurrentOAuthRequest(replacementRequestId, REQUEST_ID), false);
  assert.equal(isCurrentOAuthRequest(null, REQUEST_ID), false);
  assert.equal(isCurrentOAuthRequest(REQUEST_ID, 'bad-request-id'), false);
});

test('overlapping OAuth request cleanup closes only the currently owned popup', () => {
  const replacementRequestId = '223e4567-e89b-42d3-a456-426614174000';
  const firstPopup = {
    closed: false,
    closeCalls: 0,
    close() {
      this.closeCalls += 1;
      this.closed = true;
    },
  };
  const replacementPopup = {
    closed: false,
    closeCalls: 0,
    close() {
      this.closeCalls += 1;
      this.closed = true;
    },
  };

  assert.equal(closeOwnedOAuthPopup(firstPopup, { currentRequestId: REQUEST_ID }), true);
  assert.equal(firstPopup.closeCalls, 1, 'supersession closes the previous owned popup');

  assert.equal(closeOwnedOAuthPopup(replacementPopup, {
    currentRequestId: replacementRequestId,
    expectedRequestId: REQUEST_ID,
  }), false);
  assert.equal(replacementPopup.closeCalls, 0, 'stale cleanup cannot close the replacement popup');

  assert.equal(closeOwnedOAuthPopup(replacementPopup, {
    currentRequestId: replacementRequestId,
    expectedRequestId: replacementRequestId,
  }), true);
  assert.equal(replacementPopup.closeCalls, 1, 'the replacement request can clean up its own popup');
});

test('owned popup cleanup remains fail-safe when the browser close call throws', () => {
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args);
  try {
    const popup = {
      closed: false,
      close() { throw new DOMException('Window is unavailable', 'InvalidStateError'); },
    };
    assert.equal(closeOwnedOAuthPopup(popup, {
      currentRequestId: REQUEST_ID,
      expectedRequestId: REQUEST_ID,
    }), true);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0][0], '[oauthFlow] Owned OAuth popup could not be closed during cleanup');
    assert.deepEqual(warnings[0][1], { name: 'InvalidStateError' });
  } finally {
    console.warn = originalWarn;
  }
});

test('relay channel names require UUID request identifiers', () => {
  assert.equal(isValidOAuthRequestId(REQUEST_ID), true);
  assert.equal(oauthRelayChannelName(REQUEST_ID), `ssai-oauth:${REQUEST_ID}`);
  assert.throws(() => oauthRelayChannelName('shared-channel'), /request identifier/);
});
