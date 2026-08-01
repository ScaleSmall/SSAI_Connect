const OAUTH_RELAY_CHANNEL_PREFIX = 'ssai-oauth:';
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLIENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const OAUTH_AUTHORIZATION_TARGETS = Object.freeze({
  facebook: Object.freeze([Object.freeze({ hostname: 'www.facebook.com', pathname: /^\/(?:v\d+\.\d+\/)?dialog\/oauth\/?$/ })]),
  instagram: Object.freeze([Object.freeze({ hostname: 'www.facebook.com', pathname: /^\/(?:v\d+\.\d+\/)?dialog\/oauth\/?$/ })]),
  x: Object.freeze([Object.freeze({ hostname: 'x.com', pathname: /^\/i\/oauth2\/authorize\/?$/ })]),
  linkedin: Object.freeze([Object.freeze({ hostname: 'www.linkedin.com', pathname: /^\/oauth\/v2\/authorization\/?$/ })]),
  tiktok: Object.freeze([Object.freeze({ hostname: 'www.tiktok.com', pathname: /^\/v2\/auth\/authorize\/?$/ })]),
  youtube: Object.freeze([Object.freeze({ hostname: 'accounts.google.com', pathname: /^\/o\/oauth2\/v2\/auth\/?$/ })]),
  gbp: Object.freeze([Object.freeze({ hostname: 'accounts.google.com', pathname: /^\/o\/oauth2\/v2\/auth\/?$/ })]),
  google_drive: Object.freeze([Object.freeze({ hostname: 'accounts.google.com', pathname: /^\/o\/oauth2\/v2\/auth\/?$/ })]),
  companycam: Object.freeze([Object.freeze({ hostname: 'app.companycam.com', pathname: /^\/oauth\/authorize\/?$/ })]),
  hubspot: Object.freeze([Object.freeze({ hostname: 'app.hubspot.com', pathname: /^\/oauth\/authorize\/?$/ })]),
  gohighlevel: Object.freeze([Object.freeze({ hostname: 'marketplace.leadconnectorhq.com', pathname: /^\/oauth\/chooselocation\/?$/ })]),
  salesforce: Object.freeze([
    Object.freeze({ hostname: 'login.salesforce.com', pathname: /^\/services\/oauth2\/authorize\/?$/ }),
    Object.freeze({ hostname: 'test.salesforce.com', pathname: /^\/services\/oauth2\/authorize\/?$/ }),
  ]),
  jobber: Object.freeze([Object.freeze({ hostname: 'api.getjobber.com', pathname: /^\/api\/oauth\/authorize\/?$/ })]),
  dropbox: Object.freeze([Object.freeze({ hostname: 'www.dropbox.com', pathname: /^\/oauth2\/authorize\/?$/ })]),
});
const OAUTH_PLATFORMS = new Set(Object.keys(OAUTH_AUTHORIZATION_TARGETS));

export function isValidOAuthRequestId(value) {
  return REQUEST_ID_PATTERN.test(String(value || '').trim());
}

export function oauthRelayChannelName(requestId) {
  if (!isValidOAuthRequestId(requestId)) throw new Error('Invalid OAuth request identifier');
  return `${OAUTH_RELAY_CHANNEL_PREFIX}${requestId}`;
}

export function buildOAuthStartUrl({ baseUrl, requestedPlatform, clientId, origin, requestId }) {
  const platform = normalizePlatform(requestedPlatform);
  const tenant = String(clientId || '').trim();
  if (!CLIENT_ID_PATTERN.test(tenant)) throw new Error('Invalid client identifier');
  if (!isValidOAuthRequestId(requestId)) throw new Error('Invalid OAuth request identifier');

  const base = new URL(baseUrl);
  if (base.protocol !== 'https:') throw new Error('OAuth API must use HTTPS');

  const returnOrigin = new URL(origin);
  if (returnOrigin.origin !== origin) throw new Error('Invalid Connect origin');
  if (returnOrigin.protocol !== 'https:' && returnOrigin.hostname !== 'localhost' && returnOrigin.hostname !== '127.0.0.1') {
    throw new Error('OAuth return origin must use HTTPS');
  }

  const popupReturnUrl = new URL('/oauth-complete', returnOrigin.origin);
  popupReturnUrl.searchParams.set('oauth_request_id', requestId);

  const params = new URLSearchParams({
    platform,
    client_id: tenant,
    return_to: popupReturnUrl.toString(),
    format: 'json',
  });
  if (platform === 'gbp') params.set('google_product', 'gbp');

  return new URL(`/functions/v1/oauth-start?${params.toString()}`, base.origin).toString();
}

export function validateOAuthAuthorizationUrl(value, requestedPlatform) {
  const platform = normalizePlatform(requestedPlatform);
  const targets = OAUTH_AUTHORIZATION_TARGETS[platform];
  if (!targets) throw new Error('OAuth authorization platform is not approved');
  let url;
  try {
    url = new URL(String(value || ''));
  } catch {
    throw new Error('OAuth authorization URL is invalid');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash
    || !targets.some(target => url.hostname === target.hostname && target.pathname.test(url.pathname))) {
    throw new Error('OAuth authorization URL is not approved');
  }
  return url.toString();
}

export function abortable(promise, signal) {
  if (!signal || typeof signal.addEventListener !== 'function') {
    throw new TypeError('Abort signal is required');
  }
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve(promise).then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

export function isCurrentClientOperation(current, sequence, clientId) {
  return Boolean(current)
    && current.sequence === sequence
    && current.clientId === clientId;
}

export function isCurrentOAuthRequest(currentRequestId, requestId) {
  return isValidOAuthRequestId(requestId) && currentRequestId === requestId;
}

export function closeOwnedOAuthPopup(popup, { currentRequestId, expectedRequestId = null } = {}) {
  if (expectedRequestId && !isCurrentOAuthRequest(currentRequestId, expectedRequestId)) return false;
  try {
    if (popup?.closed !== true && typeof popup?.close === 'function') popup.close();
  } catch (error) {
    console.warn('[oauthFlow] Owned OAuth popup could not be closed during cleanup', {
      name: error?.name || 'Error',
    });
  }
  return true;
}

export function parseOAuthCompletion(search, origin) {
  const params = new URLSearchParams(search);
  const requestId = String(params.get('oauth_request_id') || '').trim();
  if (!isValidOAuthRequestId(requestId)) return null;

  const connected = normalizeOptionalPlatform(params.get('connected'));
  const errorPlatform = normalizeOptionalPlatform(params.get('platform'));
  const failed = params.has('oauth_error') || !connected;
  const platform = connected || errorPlatform || '';

  return {
    requestId,
    platform,
    failed,
    message: failed
      ? {
          type: 'oauth-error',
          platform,
          requestId,
          source: 'oauth-complete',
          origin,
        }
      : {
          type: 'oauth-success',
          platform,
          requestId,
          source: 'oauth-complete',
          origin,
        },
  };
}

export function isTrustedOAuthRelayMessage(payload, { requestId, origin, expectedPlatform }) {
  if (!payload || typeof payload !== 'object') return false;
  if (!isValidOAuthRequestId(requestId) || payload.requestId !== requestId) return false;
  if (payload.source !== 'oauth-complete' || payload.origin !== origin) return false;
  if (payload.type !== 'oauth-success' && payload.type !== 'oauth-error') return false;
  let expected;
  try {
    expected = normalizePlatform(expectedPlatform);
  } catch {
    return false;
  }
  if (payload.type === 'oauth-success') return payload.platform === expected;
  return payload.platform === '' || payload.platform === expected;
}

function abortError() {
  return new DOMException('The operation was aborted', 'AbortError');
}

function normalizePlatform(value) {
  const platform = String(value || '').trim().toLowerCase();
  if (!OAUTH_PLATFORMS.has(platform)) throw new Error('Unsupported OAuth platform');
  return platform;
}

function normalizeOptionalPlatform(value) {
  try {
    return normalizePlatform(value);
  } catch {
    return '';
  }
}
