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
const connectPanel = await load('src/components/shared/ConnectPanel.jsx');
const connectStyles = await load('src/components/shared/connect.css');
const icons = await load('src/lib/icons.js');
const oauthComplete = await load('src/OAuthCompletePage.jsx');
const supabaseConfig = await load('src/supabase.js');
const packageSource = await load('package.json');

includesAll(app, [
  "import { Toast } from 'ssai-shared'",
  "import { ConnectPanel } from './components/shared/ConnectPanel'",
  "window.location.pathname === '/oauth-complete'",
  '<OAuthCompletePage />',
  'getToken={getToken}',
], 'SSAI_Connect app contract');

excludesAll(app, [
  "import SubscriptionBanner from './components/SubscriptionBanner'",
  '<SubscriptionBanner',
  'admin_type',
  'allowPublisherProxyConfig={isAdmin}',
], 'SSAI_Connect subscription banner removal contract');

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
  'const showPowConnectionSections = !hasSelectedServices || powSetupRequired',
  'const showCustomerDataSources = !hasSelectedServices || customerDataRequired',
  '{showSocialPlatforms && (',
  '{showPhotoFeedSources && (',
  '{showCustomerDataSources && (',
], 'SSAI_Connect local ConnectPanel upload contract');

excludesAll(connectPanel, [
  'Instagram shares the Facebook auth path',
  'Save and exit',
], 'SSAI_Connect finish button copy contract');

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
  "postMessage",
  "oauth-success",
  "oauth-error",
  "window.location.origin",
  "window.close()",
], 'SSAI_Connect OAuth completion contract');

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
], 'SSAI_Connect package contract');

console.log('SSAI_Connect cloud contract verified.');
