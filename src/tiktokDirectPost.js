const CLIENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const DEFAULT_MAX_RESPONSE_BYTES = 32 * 1024;

const PRIVACY_LEVEL_LABELS = Object.freeze({
  PUBLIC_TO_EVERYONE: 'Everyone',
  MUTUAL_FOLLOW_FRIENDS: 'Friends',
  FOLLOWER_OF_CREATOR: 'Followers',
  SELF_ONLY: 'Only you',
});

const PRIVACY_LEVELS = new Set(Object.keys(PRIVACY_LEVEL_LABELS));

export function buildTikTokCreatorInfoUrl(baseUrl) {
  const base = new URL(baseUrl);
  if (base.protocol !== 'https:') throw new Error('TikTok API must use HTTPS');
  return new URL('/functions/v1/tiktok-post', base.origin).toString();
}

export function buildTikTokCreatorInfoRequest(clientId) {
  const tenant = String(clientId || '').trim();
  if (!CLIENT_ID_PATTERN.test(tenant)) throw new Error('Invalid client identifier');
  return { operation: 'creator_info', client_id: tenant };
}

export async function readBoundedJsonResponse(response, maxBytes = DEFAULT_MAX_RESPONSE_BYTES) {
  if (!response || typeof response.text !== 'function' || !Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error('Invalid response reader input');
  }

  const contentLength = response.headers?.get?.('content-length');
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > maxBytes) {
    throw new Error('TikTok response exceeded the allowed size');
  }

  const text = await readResponseTextBounded(response, maxBytes);
  if (!text.trim()) throw new Error('TikTok returned an empty response');

  const payload = JSON.parse(text);
  if (!isRecord(payload)) throw new Error('TikTok returned an invalid response');
  return payload;
}

async function readResponseTextBounded(response, maxBytes) {
  const reader = response.body?.getReader?.();
  if (!reader) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      throw new Error('TikTok response exceeded the allowed size');
    }
    return text;
  }

  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error('TikTok response exceeded the allowed size');
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
}

export function parseTikTokCreatorInfoResponse(payload) {
  const root = requireRecord(payload, 'TikTok creator response');
  if (root.ok !== true) throw new Error('TikTok creator verification failed');
  const info = requireRecord(root.creator_info, 'TikTok creator information');
  const privacyLevelOptions = normalizePrivacyLevels(info.privacy_level_options);

  const maxVideoPostDurationSec = Number(info.max_video_post_duration_sec);
  if (!Number.isSafeInteger(maxVideoPostDurationSec) || maxVideoPostDurationSec < 1 || maxVideoPostDurationSec > 600) {
    throw new Error('TikTok creator video limit is invalid');
  }

  return Object.freeze({
    creatorUsername: requireDisplayText(info.creator_username, 'TikTok creator username', 255),
    creatorNickname: requireDisplayText(info.creator_nickname, 'TikTok creator nickname', 255),
    creatorAvatarUrl: normalizeHttpsUrl(info.creator_avatar_url),
    privacyLevelOptions: Object.freeze(privacyLevelOptions),
    commentDisabled: requireBoolean(info.comment_disabled, 'TikTok comment availability'),
    duetDisabled: requireBoolean(info.duet_disabled, 'TikTok duet availability'),
    stitchDisabled: requireBoolean(info.stitch_disabled, 'TikTok stitch availability'),
    maxVideoPostDurationSec,
  });
}

export function formatTikTokPrivacyLevel(value) {
  return PRIVACY_LEVEL_LABELS[value] || 'Unavailable';
}

function normalizePrivacyLevels(value) {
  if (!Array.isArray(value)) throw new Error('TikTok creator privacy options are invalid');
  const options = [...new Set(value.map(item => String(item || '').trim()).filter(Boolean))];
  if (options.length < 1 || options.length > PRIVACY_LEVELS.size || options.some(item => !PRIVACY_LEVELS.has(item))) {
    throw new Error('TikTok creator privacy options are invalid');
  }
  return options;
}

function requireDisplayText(value, label, maxLength) {
  if (typeof value !== 'string') throw new Error(`${label} is invalid`);
  const text = value.trim();
  if (!text || text.length > maxLength || hasControlCharacter(text)) {
    throw new Error(`${label} is invalid`);
  }
  return text;
}

function hasControlCharacter(value) {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0x1f || codePoint === 0x7f) return true;
  }
  return false;
}

function requireBoolean(value, label) {
  if (typeof value !== 'boolean') throw new Error(`${label} is invalid`);
  return value;
}

function normalizeHttpsUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function requireRecord(value, label) {
  if (!isRecord(value)) throw new Error(`${label} is invalid`);
  return value;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
