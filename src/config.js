import { SUPABASE_URL } from './supabase';

export const OAUTH_STATUS_URL = `${SUPABASE_URL}/functions/v1/oauth-status`;

export const PLATFORM_ORDER = [
  'facebook', 'instagram', 'x', 'youtube', 'linkedin', 'gbp', 'tiktok',
];

export const PLATFORM_META = {
  facebook:  { name: 'Facebook',        icon: 'f',  iconClass: 'ic-fb',  note: 'Page posting + connects Instagram' },
  instagram: { name: 'Instagram',       icon: '📷', iconClass: 'ic-ig',  note: 'Connected through Facebook', noOAuth: true },
  x:         { name: 'X / Twitter',     icon: '𝕏',  iconClass: 'ic-x',   note: 'Auto-refreshing 2-hour tokens' },
  youtube:   { name: 'YouTube',         icon: '▶',  iconClass: 'ic-yt',  note: 'YouTube Shorts from job photos' },
  linkedin:  { name: 'LinkedIn',        icon: 'in', iconClass: 'ic-li',  note: 'Company page posting' },
  gbp:       { name: 'Google Business', icon: 'G',  iconClass: 'ic-gbp', note: 'Local posts + photo gallery' },
  tiktok:    { name: 'TikTok',          icon: '♪',  iconClass: 'ic-tt',  note: 'Short-form video posting' },
  reddit:    { name: 'Reddit',          icon: 'R',  iconClass: 'ic-x',   hidden: true },
};
