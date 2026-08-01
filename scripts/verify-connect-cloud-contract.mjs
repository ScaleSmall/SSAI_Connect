#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

async function load(path) {
  return readFile(path, 'utf8');
}

function includesAll(source, needles, label) {
  for (const needle of needles) {
    assert(source.includes(needle), `${label} missing "${needle}"`);
  }
}

function excludesAll(source, needles, label) {
  for (const needle of needles) {
    assert(!source.includes(needle), `${label} should not include "${needle}"`);
  }
}

const app = await load('src/App.jsx');
const header = await load('src/components/Header.jsx');
const connectPanel = await load('src/components/shared/ConnectPanel.jsx');
const connectStyles = await load('src/components/shared/connect.css');
const icons = await load('src/lib/icons.js');
const oauthComplete = await load('src/OAuthCompletePage.jsx');
const oauthFlow = await load('src/oauthFlow.js');
const tiktokDirectPost = await load('src/tiktokDirectPost.js');
const supabaseConfig = await load('src/supabase.js');
const packageSource = await load('package.json');
const envVerifier = await load('scripts/verify-connect-env.mjs');
const workflowVerifier = await load('scripts/verify-workflows.mjs');

includesAll(app, [
  "import { Toast } from 'ssai-shared'",
  "import { ConnectPanel } from './components/shared/ConnectPanel'",
  "import { activeServiceSlugs } from './serviceEntitlements'",
  "window.location.pathname === '/oauth-complete'",
  '<OAuthCompletePage />',
  'getToken={getToken}',
  ".from('client_services')",
  ".select('service_slug,status,active_until')",
  'activeServiceSlugs(entitlementRows)',
], 'SSAI_Connect app contract');

excludesAll(app, [
  "import SubscriptionBanner from './components/SubscriptionBanner'",
  '<SubscriptionBanner',
  'admin_type',
  'allowPublisherProxyConfig={isAdmin}',
  'OnboardingWizard',
  "from('client_profiles')",
  'services_enabled',
  '/functions/v1/stripe-checkout',
], 'SSAI_Connect subscription banner removal contract');

includesAll(header, [
  'src="/images/logo-140.webp"',
  'alt="SCALE SMALL.AI"',
], 'SSAI_Connect bundled logo contract');

excludesAll(header, [
  'https://scalesmall.ai/logo.png',
], 'SSAI_Connect external logo dependency contract');

includesAll(connectPanel, [
  "source_type: 'manual_photo_upload'",
  "iconFor('manual_photo_upload', 'UP')",
  '/functions/v1/upload-photo-feed',
  "fd.append('files', file)",
  'accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"',
  'Upload Photos',
  'Upload More',
  "connStatus === 'setup_required'",
  '/functions/v1/upload-crm-data',
  "fd.append('file', file)",
  "fd.append('client_id', clientId)",
  'CSV, TSV, JSON, XLSX, XLS, VCF',
  'Upload File',
  'manualUploadResult.customer_inserted',
  "const DATA_SOURCES = [",
  "const CRM_PLATFORMS = [",
  'sc-instagram-auth-note',
  'Instagram shares the Facebook authorization, connect Facebook first.',
  'Save & Setup Later',
  'CONTENT_ENGINE_SOCIAL_PLATFORM_SET',
  "const POSTING_SELECTION_SERVICE_SLUGS = new Set(['jobs_to_socials', 'content_engine'])",
  'contentEngineMissingSelectedPlatforms',
  'const socialConnectionsEnabled = !hasSelectedServices || hasAnyService(serviceSet, SOCIAL_CONNECTION_SERVICE_SLUGS)',
  'const showPhotoFeedSources = !hasSelectedServices || powSetupRequired || photoSourceConnected',
  'const showCustomerDataSources = !hasSelectedServices || customerDataRequired',
  'Content Engine social delivery uses Facebook, Instagram, TikTok, LinkedIn, and YouTube',
  'Publishing platforms ready',
  "window.open('about:blank'",
  'popup.opener = null',
  'verifyTikTokCreator',
  'buildTikTokCreatorInfoRequest(verificationClientId)',
  'buildTikTokCreatorInfoUrl(base)',
  'abortable(authHeaders(), controller.signal)',
  'clientIdRef.current !== verificationClientId',
  'details.tiktok_creator_info_supported === true',
  'validateOAuthAuthorizationUrl(data.auth_url, requestedPlatform)',
  'connectorAuthorizationMode(conn)',
  "authorizationMode === 'oauth'",
  'Connection method unavailable',
  "headers: { ...headers, Accept: 'application/json' }",
  "TikTok connected. Verify the creator account below before hosted publishing UAT.",
  'Direct Post account check',
  'Verify account',
  'This read-only check does not enable Direct Post or publish content.',
  '{showSocialPlatforms && (',
  '{showPhotoFeedSources && (',
  '{showCustomerDataSources && (',
], 'SSAI_Connect local ConnectPanel upload contract');

excludesAll(connectPanel, [
  'Instagram shares the Facebook auth path',
  'Save and exit',
  'buildFrozenTikTokOAuthStartUrl',
  "window.addEventListener('message'",
  'direct_publish_enabled',
  'TIKTOK_AUDITED_DIRECT_POST_CLIENT',
  "operation: 'publish'",
], 'SSAI_Connect client boundary contract');

includesAll(connectPanel, [
  'BRAND_ICON_STYLE',
  'BrandIcon',
  'sc-icon-brand',
  './connect.css',
  './connect-flow.css',
], 'SSAI_Connect dashboard-matched icon contract');

includesAll(icons, [
  "width: 36",
  "height: 36",
  "google_drive",
  "hubspot",
  "gohighlevel",
  "salesforce",
], 'SSAI_Connect local brand icon registry contract');

includesAll(connectStyles, [
  '.sc-icon{width:36px;height:36px;',
  '.sc-icon-brand svg{width:36px;height:36px;display:block}',
], 'SSAI_Connect dashboard icon size CSS contract');

includesAll(oauthComplete, [
  "BroadcastChannel",
  "parseOAuthCompletion",
  "completion.message",
  "window.close()",
  '[OAuthCompletePage] OAuth completion relay was unavailable',
], 'SSAI_Connect OAuth completion contract');

excludesAll(oauthComplete, [
  'catch {}',
  'window.opener',
  'postMessage(frozenTikTokCompletion',
], 'SSAI_Connect observable OAuth completion failure contract');

assert.equal(
  (oauthComplete.match(/window\.opener/g) ?? []).length,
  0,
  'SSAI_Connect OAuth completion must not depend on a popup opener',
);

includesAll(oauthFlow, [
  'isValidOAuthRequestId',
  'buildOAuthStartUrl',
  'isCurrentOAuthRequest',
  'parseOAuthCompletion',
  'isTrustedOAuthRelayMessage',
  'tiktok:',
  "hostname: 'app.companycam.com'",
  "hostname: 'api.getjobber.com'",
  "hostname: 'www.dropbox.com'",
  "hostname: 'accounts.google.com'",
  "hostname: 'app.hubspot.com'",
  "hostname: 'marketplace.leadconnectorhq.com'",
  "hostname: 'login.salesforce.com'",
  "hostname: 'test.salesforce.com'",
  'new Set(Object.keys(OAUTH_AUTHORIZATION_TARGETS))',
  'targets.some(target => url.hostname === target.hostname && target.pathname.test(url.pathname))',
  'Unsupported OAuth platform',
  'OAuth API must use HTTPS',
  "type: 'oauth-success'",
  "type: 'oauth-error'",
], 'SSAI_Connect executable OAuth flow contract');

excludesAll(oauthFlow, [
  "params.get('oauth_error') ||",
  'error: params.get',
  'FrozenTikTok',
  "platform === 'gbp' ? 'google'",
], 'SSAI_Connect raw OAuth error disclosure contract');

includesAll(tiktokDirectPost, [
  "new URL('/functions/v1/tiktok-post', base.origin)",
  "operation: 'creator_info'",
  'readBoundedJsonResponse',
  'parseTikTokCreatorInfoResponse',
  'privacy_level_options',
  'max_video_post_duration_sec',
  "url.protocol === 'https:'",
], 'SSAI_Connect TikTok creator verification contract');

excludesAll(tiktokDirectPost, [
  'direct_publish_enabled',
  'TIKTOK_AUDITED_DIRECT_POST_CLIENT',
  'TIKTOK_DIRECT_POST_UAT_CLIENT_IDS',
  'TIKTOK_DIRECT_POST_CLIENT_KEY',
  "operation: 'publish'",
], 'SSAI_Connect TikTok gate isolation contract');

includesAll(supabaseConfig, [
  'import.meta.env.VITE_SUPABASE_URL',
  'import.meta.env.VITE_SUPABASE_ANON_KEY',
  'Missing required VITE_SUPABASE_ANON_KEY',
], 'SSAI_Connect Supabase env contract');

excludesAll(supabaseConfig, [
  'eyJ',
], 'SSAI_Connect committed Supabase key contract');

includesAll(packageSource, [
  '"ssai-shared": "github:ScaleSmall/SSAI_Shared',
  '"build": "vite build"',
  '"check:env": "node scripts/verify-connect-env.mjs"',
  '"check:workflows": "node scripts/verify-workflows.mjs"',
], 'SSAI_Connect package contract');

includesAll(envVerifier, [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  "role !== 'anon'",
  'service_role',
], 'SSAI_Connect env verifier contract');

includesAll(workflowVerifier, [
  'ubuntu-latest',
  'node-version:',
  'persist-credentials: false',
  'npm run check',
], 'SSAI_Connect workflow verifier contract');

console.log('SSAI_Connect cloud contract verified.');
