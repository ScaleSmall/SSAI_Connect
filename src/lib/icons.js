import googleIcon from '../assets/icons/google.svg?raw';
import facebookIcon from '../assets/icons/facebook.svg?raw';
import instagramIcon from '../assets/icons/instagram.svg?raw';
import linkedinIcon from '../assets/icons/linkedin.svg?raw';
import youtubeIcon from '../assets/icons/youtube.svg?raw';
import dropboxIcon from '../assets/icons/dropbox.svg?raw';
import companycamIcon from '../assets/icons/companycam.svg?raw';
import jobberIcon from '../assets/icons/jobber.svg?raw';
import servicetitanIcon from '../assets/icons/servicetitan.svg?raw';
import bingIcon from '../assets/icons/bing.svg?raw';
import googleDriveIcon from '../assets/icons/google-drive.svg?raw';
import appleBusinessConnectIcon from '../assets/icons/apple-business-connect.svg?raw';
import xIcon from '../assets/icons/x.svg?raw';
import tiktokIcon from '../assets/icons/tiktok.svg?raw';
import hubspotIcon from '../assets/icons/hubspot.svg?raw';
import gohighlevelIcon from '../assets/icons/gohighlevel.svg?raw';
import salesforceIcon from '../assets/icons/salesforce.svg?raw';

const ICONS = {
  home: '🏠',
  connect: '🔗',
  clients: '👥',
  services: '🧩',
  connections: '🔗',
  billing: '💳',
  gallery: '🖼️',
  tasks: '✅',
  scans: '🔎',
  metrics: '📊',
  entity: '📍',
  intelligence: '🧠',
  referral: '🔁',
  health: '🩺',
  settings: '⚙️',
  help: '❓',
  messages: '💬',
  facebook: facebookIcon,
  instagram: instagramIcon,
  x: xIcon,
  twitter: xIcon,
  tiktok: tiktokIcon,
  linkedin: linkedinIcon,
  youtube: youtubeIcon,
  gbp: googleIcon,
  website: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect width="36" height="36" rx="8" fill="#0F4C81"/><circle cx="18" cy="18" r="10" fill="none" stroke="#fff" stroke-width="1.8"/><ellipse cx="18" cy="18" rx="5" ry="10" fill="none" stroke="#fff" stroke-width="1.8"/><line x1="8" y1="14" x2="28" y2="14" stroke="#fff" stroke-width="1.5"/><line x1="8" y1="22" x2="28" y2="22" stroke="#fff" stroke-width="1.5"/></svg>',
  companycam: companycamIcon,
  jobber: jobberIcon,
  servicetitan: servicetitanIcon,
  dropbox: dropboxIcon,
  google_drive: googleDriveIcon,
  hubspot: hubspotIcon,
  gohighlevel: gohighlevelIcon,
  salesforce: salesforceIcon,
  crm: 'CRM',
  billing_source: 'BILL',
  intelligence_source: 'INSIGHT',
  proof_of_work: '⚡',
  content_engine: '✍️',
  repeat_referral: '🔁',
  entity_system: '📍',
  google: googleIcon,
  apple: appleBusinessConnectIcon,
  bing: bingIcon,
  data_axle: 'DX',
  website_source: '??',
  info: '??',
  action_required: '!',
  approval: '✓',
  success: '✓',
  warning: '!',
  error: '!',
};

export function iconFor(key, fallback = '') {
  if (!key) return fallback;
  return ICONS[String(key).toLowerCase()] || fallback;
}

export { ICONS };

export const BRAND_ICON_STYLE = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 36,
  height: 36,
  lineHeight: 1,
  overflow: 'hidden',
};
