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

const app = await load('src/App.jsx');
const oauthComplete = await load('src/OAuthCompletePage.jsx');
const packageSource = await load('package.json');

includesAll(app, [
  "import { ConnectPanel, Toast } from 'ssai-shared'",
  "window.location.pathname === '/oauth-complete'",
  '<OAuthCompletePage />',
  'getToken={getToken}',
  'admin_type',
  "['admin', 'super_admin', 'sub_admin'].includes(String(user?.admin_type || ''))",
  'allowPublisherProxyConfig={isAdmin}',
], 'SSAI_Connect app contract');

includesAll(oauthComplete, [
  "postMessage",
  "oauth-success",
  "oauth-error",
  "window.location.origin",
  "window.close()",
], 'SSAI_Connect OAuth completion contract');

includesAll(packageSource, [
  '"ssai-shared": "github:ScaleSmall/SSAI_Shared',
  '"build": "vite build"',
], 'SSAI_Connect package contract');

console.log('SSAI_Connect cloud contract verified.');
