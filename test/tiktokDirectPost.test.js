import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTikTokCreatorInfoRequest,
  buildTikTokCreatorInfoUrl,
  formatTikTokPrivacyLevel,
  parseTikTokCreatorInfoResponse,
  readBoundedJsonResponse,
} from '../src/tiktokDirectPost.js';

const CREATOR_RESPONSE = {
  ok: true,
  creator_info: {
    creator_username: 'scale.small',
    creator_nickname: 'Scale Small',
    creator_avatar_url: 'https://cdn.example.com/avatar.png',
    privacy_level_options: ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'],
    comment_disabled: false,
    duet_disabled: true,
    stitch_disabled: false,
    max_video_post_duration_sec: 180,
  },
};

test('creator verification targets only the authenticated TikTok creator-info operation', () => {
  assert.equal(
    buildTikTokCreatorInfoUrl('https://project.supabase.co/functions/v1/other'),
    'https://project.supabase.co/functions/v1/tiktok-post',
  );
  assert.deepEqual(buildTikTokCreatorInfoRequest('client_one'), {
    operation: 'creator_info',
    client_id: 'client_one',
  });
  assert.throws(() => buildTikTokCreatorInfoUrl('http://project.supabase.co'), /HTTPS/);
  assert.throws(() => buildTikTokCreatorInfoRequest('../other-tenant'), /client identifier/);
});

test('creator verification normalizes only the public allowlisted capability fields', () => {
  const result = parseTikTokCreatorInfoResponse(CREATOR_RESPONSE);
  assert.deepEqual(result, {
    creatorUsername: 'scale.small',
    creatorNickname: 'Scale Small',
    creatorAvatarUrl: 'https://cdn.example.com/avatar.png',
    privacyLevelOptions: ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'],
    commentDisabled: false,
    duetDisabled: true,
    stitchDisabled: false,
    maxVideoPostDurationSec: 180,
  });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.privacyLevelOptions), true);
  assert.equal(formatTikTokPrivacyLevel('PUBLIC_TO_EVERYONE'), 'Everyone');
  assert.equal(formatTikTokPrivacyLevel('ADMIN_ONLY'), 'Unavailable');
});

test('creator verification drops unsafe optional avatar URLs', () => {
  const result = parseTikTokCreatorInfoResponse({
    ...CREATOR_RESPONSE,
    creator_info: { ...CREATOR_RESPONSE.creator_info, creator_avatar_url: 'javascript:alert(1)' },
  });
  assert.equal(result.creatorAvatarUrl, null);
});

test('creator verification fails closed on malformed capability fields', () => {
  const withCreator = creator_info => ({ ok: true, creator_info });
  assert.throws(() => parseTikTokCreatorInfoResponse({ ...CREATOR_RESPONSE, ok: false }), /verification failed/);
  assert.throws(() => parseTikTokCreatorInfoResponse(withCreator({
    ...CREATOR_RESPONSE.creator_info,
    privacy_level_options: ['ADMIN_ONLY'],
  })), /privacy options/);
  assert.throws(() => parseTikTokCreatorInfoResponse(withCreator({
    ...CREATOR_RESPONSE.creator_info,
    comment_disabled: 'false',
  })), /comment availability/);
  assert.throws(() => parseTikTokCreatorInfoResponse(withCreator({
    ...CREATOR_RESPONSE.creator_info,
    max_video_post_duration_sec: 601,
  })), /video limit/);
  assert.throws(() => parseTikTokCreatorInfoResponse(withCreator({
    ...CREATOR_RESPONSE.creator_info,
    creator_nickname: 'Unsafe\u0000name',
  })), /nickname/);
});

test('bounded JSON reader accepts a normal object and rejects oversized or invalid payloads', async () => {
  const normal = new Response(JSON.stringify(CREATOR_RESPONSE), {
    headers: { 'content-type': 'application/json' },
  });
  assert.deepEqual(await readBoundedJsonResponse(normal), CREATOR_RESPONSE);

  const declaredOversized = new Response('{}', { headers: { 'content-length': '40000' } });
  await assert.rejects(() => readBoundedJsonResponse(declaredOversized), /allowed size/);

  const actualOversized = new Response(JSON.stringify({ value: 'x'.repeat(128) }));
  await assert.rejects(() => readBoundedJsonResponse(actualOversized, 64), /allowed size/);

  await assert.rejects(() => readBoundedJsonResponse(new Response('[]')), /invalid response/);
  await assert.rejects(() => readBoundedJsonResponse(new Response('not json')), SyntaxError);
});
