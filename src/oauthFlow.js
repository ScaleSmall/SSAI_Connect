const OAUTH_RELAY_CHANNEL_PREFIX = 'ssai-oauth:';
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLIENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const OAUTH_PLATFORMS = new Set([
  'facebook',
  'instagram',
  'x',
  'tiktok',
  'linkedin',
  'youtube',
  'google',
  'gbp',
]);

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
    platform: platform === 'gbp' ? 'google' : platform,
    client_id: tenant,
    return_to: popupReturnUrl.toString(),
    format: 'json',
  });
  if (platform === 'gbp') params.set('google_product', 'gbp');

  return new URL(`/functions/v1/oauth-start?${params.toString()}`, base.origin).toString();
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

export function isTrustedOAuthRelayMessage(payload, { requestId, origin }) {
  if (!payload || typeof payload !== 'object') return false;
  if (!isValidOAuthRequestId(requestId) || payload.requestId !== requestId) return false;
  if (payload.source !== 'oauth-complete' || payload.origin !== origin) return false;
  if (payload.type !== 'oauth-success' && payload.type !== 'oauth-error') return false;
  return payload.platform === '' || OAUTH_PLATFORMS.has(payload.platform);
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
