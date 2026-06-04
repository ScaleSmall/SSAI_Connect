import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, SUPABASE_URL } from '../../lib/supabase';
import { BRAND_ICON_STYLE, iconFor } from '../../lib/icons';
import './connect.css';
import './connect-flow.css';

const CRM_PLATFORMS = [
  { connector_type: 'hubspot',      platform: 'hubspot',      label: 'HubSpot',      icon: iconFor('hubspot', 'HS') },
  { connector_type: 'gohighlevel',  platform: 'gohighlevel',  label: 'GoHighLevel',  icon: iconFor('gohighlevel', 'GHL') },
  { connector_type: 'salesforce',   platform: 'salesforce',   label: 'Salesforce',   icon: iconFor('salesforce', 'SF') },
];

const DATA_SOURCES = [
  { source_type: 'companycam', label: 'CompanyCam', icon: iconFor('companycam', 'cc') },
  { source_type: 'jobber', label: 'Jobber', icon: iconFor('jobber', 'jb') },
  { source_type: 'dropbox', label: 'Dropbox', icon: iconFor('dropbox', 'db') },
  { source_type: 'google_drive', label: 'Google Drive', icon: iconFor('google_drive', 'gd') },
  { source_type: 'manual_photo_upload', label: 'Manual Upload', icon: iconFor('manual_photo_upload', 'UP') },
];
const LIVE_PHOTO_SOURCE_CONNECTOR_TYPES = new Set(['companycam', 'jobber', 'dropbox', 'google_drive', 'manual_photo_upload']);
const PHOTO_SOURCE_CONNECTOR_TYPES = new Set(['companycam', 'jobber', 'dropbox', 'google_drive', 'manual_photo_upload']);

const SOCIAL_PLATFORMS = [
  { platform: 'facebook', label: 'Facebook', icon: iconFor('facebook', 'f') },
  { platform: 'instagram', label: 'Instagram', icon: iconFor('instagram', 'ig') },
  { platform: 'x', label: 'X (Twitter)', icon: iconFor('x', 'X') },
  { platform: 'tiktok', label: 'TikTok', icon: iconFor('tiktok', 'tt') },
  { platform: 'linkedin', label: 'LinkedIn', icon: iconFor('linkedin', 'in') },
  { platform: 'youtube', label: 'YouTube', icon: iconFor('youtube', 'yt') },
  { platform: 'gbp', label: 'Google Business Profile', icon: iconFor('gbp', 'g') },
  { platform: 'website', label: 'Website', icon: iconFor('website', 'ww') },
];

const SOCIAL_PLATFORM_SLUGS = SOCIAL_PLATFORMS.map(item => item.platform);
const SOCIAL_PLATFORM_SET = new Set(SOCIAL_PLATFORM_SLUGS);

function normalizeSelectedPlatforms(value, fallback = SOCIAL_PLATFORM_SLUGS) {
  if (!Array.isArray(value)) return fallback;
  const selected = [];
  for (const platform of value) {
    if (SOCIAL_PLATFORM_SET.has(platform) && !selected.includes(platform)) selected.push(platform);
  }
  return selected.length > 0 ? selected : fallback;
}

function dashboardHomeUrl() {
  if (typeof window === 'undefined') return '/';
  return window.location.hostname === 'connect.scalesmall.ai'
    ? 'https://dashboard.scalesmall.ai/'
    : '/';
}

function BrandIcon({ icon }) {
  if (typeof icon === 'string' && icon.includes('<svg')) {
    return <span className="sc-icon sc-icon-brand" aria-hidden="true" style={BRAND_ICON_STYLE} dangerouslySetInnerHTML={{ __html: icon }} />;
  }
  return <span className="sc-icon sc-icon-badge" aria-hidden="true" style={BRAND_ICON_STYLE}>{icon}</span>;
}

function RowBadge({ connected, expired, disabled, connStatus }) {
  if (disabled) return <span className="sc-badge sc-badge-off">Disabled</span>;
  if (connStatus === 'not_configured') return <span className="sc-badge sc-badge-off">Unavailable</span>;
  if (connStatus === 'coming_soon') return <span className="sc-badge sc-badge-off">Coming soon</span>;
  if (connStatus === 'pending_discovery') return <span className="sc-badge sc-badge-amber">Verifying…</span>;
  if (connStatus === 'setup_required') return <span className="sc-badge sc-badge-amber">Setup required</span>;
  if (connStatus === 'needs_designator') return <span className="sc-badge sc-badge-amber">Setup required</span>;
  if (expired) return <span className="sc-badge sc-badge-amber">Expired</span>;
  return <span className={`sc-badge ${connected ? 'sc-badge-green' : 'sc-badge-red'}`}>{connected ? 'Connected' : 'Not connected'}</span>;
}

function linkedInOrgLabel(org, index) {
  const projectionName = org?.['organization~']?.localizedName;
  const name = org?.name || org?.display_name || org?.localizedName || org?.localized_name || projectionName;
  return name || `Company page ${index + 1}`;
}

function oauthPlatformFor(platform) {
  return platform === 'gbp' ? 'google' : platform;
}

function PageAccessModal({ onClose }) {
  return (
    <div className="sc-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="sc-modal" role="dialog" aria-modal="true" aria-labelledby="sc-page-access-title" onClick={event => event.stopPropagation()}>
        <div className="sc-modal-head">
          <h3 id="sc-page-access-title">Facebook and LinkedIn page access</h3>
          <button type="button" className="sc-modal-close" onClick={onClose} aria-label="Close page access help">Close</button>
        </div>
        <p>
          Use two logins in the right places. Your Scale Small AI login gets you into the dashboard or connect page.
          The Facebook or LinkedIn login in the popup must be the account that has admin access to the business page.
        </p>
        <div className="sc-flow" aria-label="Connection flow">
          <div className="sc-flow-step"><strong>1. Browser profile</strong><span>Open an incognito window or Chrome profile where the Facebook or LinkedIn account with page admin access is signed in.</span></div>
          <div className="sc-flow-step"><strong>2. Scale Small AI login</strong><span>Go to dashboard.scalesmall.ai or connect.scalesmall.ai and sign in with the normal client dashboard login.</span></div>
          <div className="sc-flow-step"><strong>3. Connect Platforms</strong><span>Click Connect for Facebook or LinkedIn.</span></div>
          <div className="sc-flow-step"><strong>4. Platform popup</strong><span>When Facebook or LinkedIn opens, continue with the personal or admin account that manages the business/company page.</span></div>
          <div className="sc-flow-step"><strong>5. Choose the page</strong><span>If asked, select the business page or company page, approve access, and return to Scale Small AI.</span></div>
        </div>
        <p className="sc-modal-note">
          Important: the personal Facebook or LinkedIn account is not your Scale Small AI login. It is only used inside the platform popup so Facebook or LinkedIn can show the pages that account manages.
        </p>
      </div>
    </div>
  );
}

export function ConnectPanel({ clientId, supabaseUrl, businessName, services = [], getToken, className = '', allowPublisherProxyConfig = false, focusPlatforms = [] }) {
  const [refreshTick, setRefreshTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [popupError, setPopupError] = useState(null);
  const [popupSuccess, setPopupSuccess] = useState(null);
  const [disconnectingKey, setDisconnectingKey] = useState(null);
  const errorRef = React.useRef(null);
  const [platformMap, setPlatformMap] = useState({});
  const [selectedPlatforms, setSelectedPlatforms] = useState(SOCIAL_PLATFORM_SLUGS);
  const [platformSelectionBusy, setPlatformSelectionBusy] = useState(null);
  const [platformSelectionError, setPlatformSelectionError] = useState(null);
  const [allConnectors, setAllConnectors] = useState([]);
  const [connectorMap, setConnectorMap] = useState({});
  const [legacyPhotoSourceCount, setLegacyPhotoSourceCount] = useState(0);
  const [tokenInputs, setTokenInputs] = useState({});
  const [tokenErrors, setTokenErrors] = useState({});
  const [tokenBusy, setTokenBusy] = useState({});
  const [embedVisible, setEmbedVisible] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [hasUploadPostKey, setHasUploadPostKey] = useState(false);
  const [hasUploadPostUser, setHasUploadPostUser] = useState(false);
  const [hasUploadPostReady, setHasUploadPostReady] = useState(false);
  const [uploadPostInput, setUploadPostInput] = useState('');
  const [uploadPostUserInput, setUploadPostUserInput] = useState('');
  const [showUploadPostForm, setShowUploadPostForm] = useState(false);
  const [uploadPostBusy, setUploadPostBusy] = useState(false);
  const [uploadPostError, setUploadPostError] = useState(null);
  const [selectionInputs, setSelectionInputs] = useState({});
  const [selectionBusy, setSelectionBusy] = useState(null);
  const [selectionError, setSelectionError] = useState(null);
  const [manualUploadBusy, setManualUploadBusy] = useState(false);
  const [manualUploadResult, setManualUploadResult] = useState(null);
  const [manualUploadError, setManualUploadError] = useState(null);
  const [photoUploadBusy, setPhotoUploadBusy] = useState(false);
  const [photoUploadResult, setPhotoUploadResult] = useState(null);
  const [photoUploadError, setPhotoUploadError] = useState(null);
  const [pageAccessInfoOpen, setPageAccessInfoOpen] = useState(false);
  const [connectFlowBusy, setConnectFlowBusy] = useState(false);
  const [connectFlowError, setConnectFlowError] = useState(null);
  const [connectFlowSaved, setConnectFlowSaved] = useState(null);
  const [customerRecordCount, setCustomerRecordCount] = useState(0);
  const fileInputRef = React.useRef(null);
  const photoFileInputRef = React.useRef(null);

  const base = supabaseUrl || SUPABASE_URL;
  const serviceSet = useMemo(() => new Set(services || []), [services]);
  const nonPowServiceSlugs = useMemo(
    () => (services || []).map(String).filter(slug => slug && slug !== 'jobs_to_socials'),
    [services],
  );
  const focusPlatformSet = useMemo(() => new Set(focusPlatforms || []), [focusPlatforms]);
  const selectedPlatformSet = useMemo(() => new Set(selectedPlatforms || []), [selectedPlatforms]);
  const refresh = useCallback(() => setRefreshTick(t => t + 1), []);

  const authHeaders = useCallback(async () => {
    const token = getToken ? await getToken() : null;
    return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
  }, [getToken]);

  const fetchStatuses = useCallback(async () => {
    if (!clientId) return;
    try {
      const headers = await authHeaders();
      const [pRes, cRes, customerRes, legacyPhotoRes] = await Promise.allSettled([
        fetch(`${base}/functions/v1/oauth-status?client_id=${encodeURIComponent(clientId)}`, { headers }),
        fetch(`${base}/functions/v1/connect-connector?client_id=${encodeURIComponent(clientId)}`, { headers }),
        supabase
          .from('client_crm_records')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .eq('record_type', 'contact'),
        supabase
          .from('client_photo_sources')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .eq('enabled', true),
      ]);
      if (pRes.status === 'fulfilled' && pRes.value.ok) {
        const pData = await pRes.value.json();
        if (pData.platforms) {
          const map = {};
          for (const p of pData.platforms) map[p.platform] = p;
          setPlatformMap(map);
        }
        if (Array.isArray(pData.selected_platforms)) {
          setSelectedPlatforms(normalizeSelectedPlatforms(pData.selected_platforms));
        }
        setHasUploadPostKey(!!pData.has_upload_post_key);
        setHasUploadPostUser(!!pData.has_upload_post_user);
        setHasUploadPostReady(!!pData.has_upload_post_ready);
      }
      if (cRes.status === 'fulfilled' && cRes.value.ok) {
        const cData = await cRes.value.json();
        if (cData.all_connectors) {
          setAllConnectors(cData.all_connectors);
          const map = {};
          for (const c of cData.all_connectors) map[c.connector_type] = c;
          setConnectorMap(map);
        }
      }
      if (customerRes.status === 'fulfilled' && !customerRes.value.error) {
        setCustomerRecordCount(customerRes.value.count || 0);
      }
      if (legacyPhotoRes.status === 'fulfilled' && !legacyPhotoRes.value.error) {
        setLegacyPhotoSourceCount(legacyPhotoRes.value.count || 0);
      }
    } catch (err) {
      console.warn('[ConnectPanel] fetchStatuses error:', err);
    }
  }, [clientId, base, authHeaders]);

  useEffect(() => { fetchStatuses(); }, [fetchStatuses, refreshTick]);

  useEffect(() => {
    const onMessage = (event) => {
      const allowed = [
        'https://connect.scalesmall.ai',
        'https://dashboard.scalesmall.ai',
        window.location.origin,
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:4173',
      ];
      if (!allowed.some(origin => event.origin.startsWith(origin))) return;
      if (event.data?.type === 'oauth-success') {
        setPopupError(null);
        refresh();
      }
      if (event.data?.type === 'oauth-error') {
        setPopupError(`Failed to connect ${event.data.platform || 'platform'}. Please try again.`);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [refresh]);

  const openPopup = useCallback(async (requestedPlatform) => {
    if (!clientId) return;
    setBusy(true);
    setPopupError(null);
    const popup = window.open('', 'oauth_popup', 'popup,width=600,height=700,noopener=no');
    if (!popup) {
      setPopupError('Popup blocked. Please allow popups for this site and try again.');
      setBusy(false);
      return;
    }
    try {
      // return_to points to /oauth-complete on this app — that page posts a message
      // back to this window and closes itself, so the user never sees an external page.
      const headers = await authHeaders();
      const oauthPlatform = oauthPlatformFor(requestedPlatform);
      const params = new URLSearchParams({
        platform: oauthPlatform,
        client_id: clientId,
        return_to: `${window.location.origin}/oauth-complete`,
        format: 'json',
      });
      if (requestedPlatform === 'gbp') params.set('google_product', 'gbp');
      const url = `${base}/functions/v1/oauth-start?${params.toString()}`;
      const res = await fetch(url, { headers: { ...headers, Accept: 'application/json' } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.auth_url) throw new Error(data.error || `Could not start OAuth (${res.status})`);
      popup.location.href = data.auth_url;
      // Fallback: if the message never arrives, refresh when the popup closes
      const timer = setInterval(() => {
        if (popup.closed) { clearInterval(timer); refresh(); }
      }, 800);
      setTimeout(() => clearInterval(timer), 5 * 60 * 1000);
    } catch (err) {
      popup.close();
      setPopupError(err.message);
    } finally {
      setBusy(false);
    }
  }, [clientId, base, authHeaders, refresh]);

  const disconnectPlatform = useCallback(async (platform) => {
    try {
      setDisconnectingKey(platform);
      setPopupError(null);
      setPopupSuccess(null);
      const headers = await authHeaders();
      const res = await fetch(`${base}/functions/v1/oauth-status`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ client_id: clientId, action: 'disconnect_platform', platform, request_id: crypto.randomUUID() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed to disconnect (${res.status})`);
      setPopupSuccess(`${platform} disconnected successfully.`);
      setTimeout(() => setPopupSuccess(null), 3000);
      refresh();
    } catch (err) {
      setPopupError(err.message || 'Failed to disconnect');
      setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    } finally {
      setDisconnectingKey(null);
    }
  }, [clientId, base, authHeaders, refresh]);

  const togglePlatformUse = useCallback(async (platform, selected) => {
    const nextAction = selected ? 'remove_platform' : 'add_platform';
    if (selected && selectedPlatforms.length <= 1) {
      setPlatformSelectionError('Keep at least one posting platform selected for PoW.');
      return;
    }
    try {
      setPlatformSelectionBusy(platform);
      setPlatformSelectionError(null);
      const headers = await authHeaders();
      const res = await fetch(`${base}/functions/v1/oauth-status`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ client_id: clientId, action: nextAction, platform, request_id: crypto.randomUUID() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed to update platform selection (${res.status})`);
      if (Array.isArray(data.selected_platforms)) {
        const nextPlatforms = normalizeSelectedPlatforms(data.selected_platforms);
        setSelectedPlatforms(nextPlatforms);
        setPlatformMap(current => {
          const nextSelected = new Set(nextPlatforms);
          const next = { ...current };
          for (const slug of SOCIAL_PLATFORM_SLUGS) {
            next[slug] = { ...(next[slug] || {}), platform: slug, selected: nextSelected.has(slug) };
          }
          return next;
        });
      }
      setPopupSuccess(`${selected ? 'Removed' : 'Added'} ${platform} ${selected ? 'from' : 'to'} PoW platform selection.`);
      setTimeout(() => setPopupSuccess(null), 3000);
      refresh();
    } catch (err) {
      setPlatformSelectionError(err.message || 'Failed to update platform selection');
      setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    } finally {
      setPlatformSelectionBusy(null);
    }
  }, [authHeaders, base, clientId, refresh, selectedPlatforms.length]);

  const connectSimple = useCallback(async (connectorType) => {
    setTokenBusy(b => ({ ...b, [connectorType]: true }));
    setTokenErrors(e => ({ ...e, [connectorType]: null }));
    try {
      const headers = await authHeaders();
      const res = await fetch(`${base}/functions/v1/connect-connector`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ client_id: clientId, connector_type: connectorType }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to connect');
      refresh();
    } catch (err) {
      setTokenErrors(e => ({ ...e, [connectorType]: err.message }));
    } finally {
      setTokenBusy(b => ({ ...b, [connectorType]: false }));
    }
  }, [clientId, base, authHeaders, refresh]);

  const connectApiKey = useCallback(async (connectorType) => {
    const token = (tokenInputs[connectorType] || '').trim();
    if (!token) {
      setTokenErrors(e => ({ ...e, [connectorType]: 'Enter your API token' }));
      return;
    }
    setTokenBusy(b => ({ ...b, [connectorType]: true }));
    setTokenErrors(e => ({ ...e, [connectorType]: null }));
    try {
      const headers = await authHeaders();
      const res = await fetch(`${base}/functions/v1/connect-connector`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ client_id: clientId, connector_type: connectorType, api_token: token }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to connect');
      setTokenInputs(i => ({ ...i, [connectorType]: '' }));
      refresh();
    } catch (err) {
      setTokenErrors(e => ({ ...e, [connectorType]: err.message }));
    } finally {
      setTokenBusy(b => ({ ...b, [connectorType]: false }));
    }
  }, [clientId, base, authHeaders, tokenInputs, refresh]);

  const disconnectConnector = useCallback(async (connectorType) => {
    try {
      setDisconnectingKey(connectorType);
      setPopupError(null);
      setPopupSuccess(null);
      const headers = await authHeaders();
      const res = await fetch(`${base}/functions/v1/connect-connector`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ client_id: clientId, connector_type: connectorType, action: 'disconnect', request_id: crypto.randomUUID() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed to disconnect (${res.status})`);
      setPopupSuccess(`${connectorType} disconnected successfully.`);
      setTimeout(() => setPopupSuccess(null), 3000);
      refresh();
    } catch (err) {
      setPopupError(err.message || 'Failed to disconnect');
      setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    } finally {
      setDisconnectingKey(null);
    }
  }, [clientId, base, authHeaders, refresh]);

  const saveUploadPostKey = useCallback(async (clear = false) => {
    const key = clear ? '' : uploadPostInput.trim();
    const uploadPostUser = clear ? '' : uploadPostUserInput.trim();
    if (!clear && !key) { setUploadPostError('Enter your UploadPost API key'); return; }
    if (!clear && !uploadPostUser) { setUploadPostError('Enter your UploadPost user/account'); return; }
    setUploadPostBusy(true);
    setUploadPostError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${base}/functions/v1/oauth-status`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ client_id: clientId, action: 'set_upload_post_key', api_key: key, upload_post_user: uploadPostUser, request_id: crypto.randomUUID() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed to save (${res.status})`);
      setUploadPostInput('');
      setUploadPostUserInput('');
      setShowUploadPostForm(false);
      refresh();
    } catch (err) {
      setUploadPostError(err.message || 'Failed to save key');
    } finally {
      setUploadPostBusy(false);
    }
  }, [clientId, base, authHeaders, uploadPostInput, uploadPostUserInput, refresh]);

  const saveDestinationChoice = useCallback(async (action, payload = {}) => {
    setSelectionBusy(action);
    setSelectionError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${base}/functions/v1/oauth-status`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ client_id: clientId, action, ...payload, request_id: crypto.randomUUID() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed to save (${res.status})`);
      refresh();
    } catch (err) {
      setSelectionError(err.message || 'Could not save selection');
    } finally {
      setSelectionBusy(null);
    }
  }, [clientId, base, authHeaders, refresh]);

  const handleManualUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setManualUploadBusy(true);
    setManualUploadError(null);
    setManualUploadResult(null);
    try {
      const token = getToken ? await getToken() : null;
      const uploadHeaders = token ? { Authorization: `Bearer ${token}` } : {};
      const fd = new FormData();
      fd.append('file', file);
      fd.append('client_id', clientId);
      const res = await fetch(`${base}/functions/v1/upload-crm-data`, {
        method: 'POST',
        headers: uploadHeaders,
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
      setManualUploadResult(data);
      setCustomerRecordCount(count => count + Number(data.inserted || 0));
      refresh();
    } catch (err) {
      setManualUploadError(err.message || 'Upload failed');
    } finally {
      setManualUploadBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [clientId, base, getToken]);

  const handlePhotoUpload = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setPhotoUploadBusy(true);
    setPhotoUploadError(null);
    setPhotoUploadResult(null);
    try {
      const token = getToken ? await getToken() : null;
      const uploadHeaders = token ? { Authorization: `Bearer ${token}` } : {};
      const fd = new FormData();
      for (const file of files) fd.append('files', file);
      fd.append('client_id', clientId);
      const res = await fetch(`${base}/functions/v1/upload-photo-feed`, {
        method: 'POST',
        headers: uploadHeaders,
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Photo upload failed (${res.status})`);
      setPhotoUploadResult(data);
      refresh();
    } catch (err) {
      setPhotoUploadError(err.message || 'Photo upload failed');
    } finally {
      setPhotoUploadBusy(false);
      if (photoFileInputRef.current) photoFileInputRef.current.value = '';
    }
  }, [clientId, base, getToken, refresh]);

  const embedCode = `<script src="${base}/functions/v1/widget-gallery?format=js" data-client="${clientId}"><\/script>`;
  const copyEmbed = useCallback(() => {
    navigator.clipboard.writeText(embedCode);
    setEmbedCopied(true);
    setTimeout(() => setEmbedCopied(false), 2500);
  }, [embedCode]);

  const selectedSocialRows = SOCIAL_PLATFORMS
    .filter(platform => selectedPlatformSet.has(platform.platform))
    .map(platform => ({ ...platform, status: platformMap[platform.platform] }));
  const missingSelectedPlatforms = selectedSocialRows
    .filter(platform => {
      const status = platform.status;
      if (!status?.connected || status?.is_expired) return true;
      const details = status.details || {};
      return Boolean(
        details.needs_page_selection ||
        details.needs_org_selection ||
        details.needs_confirmation ||
        details.needs_business_account ||
        details.needs_refresh ||
        details.needs_open_id
      );
    })
    .map(platform => platform.label);
  const photoSourceConnected = legacyPhotoSourceCount > 0 || allConnectors.some(connector => (
    connector?.is_active === true && PHOTO_SOURCE_CONNECTOR_TYPES.has(connector.connector_type)
  ));
  const crmConnected = CRM_PLATFORMS.some(crm => connectorMap[crm.connector_type]?.is_active === true);
  const powSetupRequired = serviceSet.has('jobs_to_socials');
  const photoSourceRequired = powSetupRequired;
  const customerDataRequired = serviceSet.has('repeat_referral') || serviceSet.has('customer_intelligence');
  const customerDataConnected = crmConnected || customerRecordCount > 0;
  const gatedMissingSelectedPlatforms = powSetupRequired ? missingSelectedPlatforms : [];
  const photoSourceReady = !photoSourceRequired || photoSourceConnected;
  const customerDataReady = !customerDataRequired || customerDataConnected;
  const connectFlowReady = gatedMissingSelectedPlatforms.length === 0 && photoSourceReady && customerDataReady;
  const connectFlowMissingItems = [
    ...gatedMissingSelectedPlatforms.map(label => `Connect or toggle off ${label}.`),
    !photoSourceReady ? 'Connect at least one photo/job source.' : null,
    !customerDataReady ? 'Connect a customer data source or upload customer records.' : null,
  ].filter(Boolean);
  const connectFlowBlockerTitle = connectFlowReady
    ? 'Continue to dashboard setup'
    : connectFlowMissingItems.join(' ');
  const selectedPlatformCount = selectedSocialRows.length;

  const saveConnectFlow = useCallback(async (status) => {
    setConnectFlowBusy(true);
    setConnectFlowError(null);
    setConnectFlowSaved(null);
    try {
      const { data: current, error: currentError } = await supabase
        .from('client_profiles')
        .select('setup_progress')
        .eq('client_id', clientId)
        .maybeSingle();
      if (currentError) throw currentError;

      const now = new Date().toISOString();
      const setupProgress = current?.setup_progress && typeof current.setup_progress === 'object' ? current.setup_progress : {};
      const cleanSelectedPlatforms = normalizeSelectedPlatforms(selectedPlatforms);
      const connectFlow = {
        status,
        saved_at: now,
        confirmed_at: status === 'confirmed' ? now : setupProgress.connect_flow?.confirmed_at || null,
        selected_platforms: cleanSelectedPlatforms,
        selected_platform_count: selectedPlatformCount,
        pow_setup_required: powSetupRequired,
        missing_selected_platforms: gatedMissingSelectedPlatforms,
        photo_source_required: photoSourceRequired,
        photo_source_connected: photoSourceConnected,
        crm_connected: crmConnected,
        customer_data_required: customerDataRequired,
        customer_data_connected: customerDataConnected,
        customer_record_count: customerRecordCount,
        general_setup_review_requested: status === 'confirmed' && nonPowServiceSlugs.length > 0,
      };

      const { error: updateError } = await supabase
        .from('client_profiles')
        .update({
          setup_progress: { ...setupProgress, connect_flow: connectFlow },
          updated_at: now,
        })
        .eq('client_id', clientId);
      if (updateError) throw updateError;

      if (status === 'confirmed' && nonPowServiceSlugs.length > 0) {
        const headers = await authHeaders();
        const reviewRes = await fetch(`${base}/functions/v1/setup-launch-review`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ client_id: clientId, action: 'run_setup_review' }),
        });
        const reviewPayload = await reviewRes.json().catch(() => ({}));
        if (!reviewRes.ok) {
          throw new Error(reviewPayload.error || `Setup review could not start (${reviewRes.status})`);
        }
      }

      setConnectFlowSaved(status);
      if (status === 'confirmed') {
        window.location.href = dashboardHomeUrl();
      }
    } catch (err) {
      setConnectFlowError(err.message || 'Could not save connection progress.');
    } finally {
      setConnectFlowBusy(false);
    }
  }, [authHeaders, base, clientId, selectedPlatforms, selectedPlatformCount, powSetupRequired, gatedMissingSelectedPlatforms, photoSourceRequired, photoSourceConnected, crmConnected, customerDataRequired, customerDataConnected, customerRecordCount, nonPowServiceSlugs.length]);

  if (!clientId) {
    return <div className={`sc-panel ${className}`}><div className="sc-error">No client ID linked yet. Complete onboarding first.</div></div>;
  }

  const facebookConnected = platformMap['facebook']?.connected === true;
  const currentChoice = (key, fallback = '') => selectionInputs[key] || fallback || '';
  const setChoice = (key, value) => setSelectionInputs(current => ({ ...current, [key]: value }));

  return (
    <div className={`sc-panel ${className}`}>
      {pageAccessInfoOpen && <PageAccessModal onClose={() => setPageAccessInfoOpen(false)} />}
      {popupError && <div ref={errorRef} className="sc-error" style={{ marginBottom: 12 }}>{popupError}</div>}
      {popupSuccess && <div className="sc-success" style={{ marginBottom: 12 }}>{popupSuccess}</div>}
      <div className="sc-status-bar">
        <div className="sc-stat"><span className="sc-dot sc-dot-green" />Connect apps and data sources for <strong>{businessName || 'this client'}</strong></div>
      </div>

      <div className="sc-section-label">Social Platforms</div>
      <p className="sc-subtitle">Connect the socials you actually use. Instagram shares the Facebook auth path, so connect Facebook first or alongside it.</p>
      <div className="sc-platform-selection-note">
        Toggle off any social platform, Google Business Profile, or Website Gallery that you do not want to use or do not have. You can change this later by returning to Connect Platforms in the dashboard.
      </div>
      <div className="sc-auth-reminder">
        <strong>Facebook & LinkedIn page access:</strong> Open <strong>dashboard.scalesmall.ai</strong> or <strong>connect.scalesmall.ai</strong> in an incognito window or Chrome profile where the page admin account is signed in. Then sign in to Scale Small AI with the normal dashboard login, click Connect, and use the Facebook or LinkedIn popup with the account that manages the business/company page.
        <button type="button" className="sc-auth-info-button" onClick={() => setPageAccessInfoOpen(true)}>Click here for more info</button>
      </div>
      {platformSelectionError && <div ref={errorRef} className="sc-row-error" style={{ marginBottom: 12 }}>{platformSelectionError}</div>}
      <div className="sc-list">
        {SOCIAL_PLATFORMS.map(p => {
          const enabled = p.platform === 'website' || serviceSet.size === 0 || serviceSet.has('jobs_to_socials') || serviceSet.has('repeat_referral') || serviceSet.has('entity_system');
                const status = platformMap[p.platform];
                const selectedForPow = selectedPlatformSet.has(p.platform) && status?.selected !== false;
                const connected = status?.connected === true;
                const expired = status?.is_expired === true;
                const details = status?.details || {};
                const isWebsite = p.platform === 'website';
                const focused = focusPlatformSet.has(p.platform);
                const instagramBlocked = p.platform === 'instagram' && !facebookConnected && !connected;

                let note;
          if (!enabled) {
            note = 'Not enabled for this account';
          } else if (!selectedForPow) {
            note = powSetupRequired ? 'Not selected for PoW posting' : 'Not selected right now';
          } else if (instagramBlocked) {
            note = 'Connect Facebook first';
          } else if (p.platform === 'tiktok' && status?.details?.needs_refresh) {
            note = 'Reconnect to capture refresh access';
                } else if (p.platform === 'tiktok' && status?.details?.needs_open_id) {
                  note = 'Setup needs TikTok open ID';
                } else if (p.platform === 'facebook' && details.page_name) {
                  note = `Page: ${details.page_name}`;
                } else if (p.platform === 'instagram' && details.username) {
                  note = `@${details.username}`;
                } else if (p.platform === 'linkedin' && details.posting_route === 'organization') {
                  note = 'Posting as company page';
                } else if (p.platform === 'linkedin' && Array.isArray(details.available_orgs) && details.available_orgs.length > 0) {
                  note = 'Choose one company page below to finish';
                } else if (p.platform === 'linkedin' && details.needs_org_selection) {
                  note = 'Choose or reconnect a company page';
                } else if (p.platform === 'gbp' && !connected) {
                  note = 'Connect Google Business Profile to grant business.manage access. YouTube access does not grant GBP.';
                } else if (isWebsite && !connected) {
                  note = 'Install the Website Gallery embed code on the client site, then refresh after the widget loads once.';
                } else if (connected && details.username) {
                  note = `@${details.username}`;
                } else if (expired) {
                  note = 'Token expired — reconnect';
                } else {
                  note = null;
                }

          return (
            <div key={p.platform} className="sc-row" style={focused ? { borderColor: 'rgba(96,165,250,0.5)' } : undefined}>
              <div className="sc-row-main">
                <BrandIcon icon={p.icon} />
                <div className="sc-info">
                  <div className="sc-name">{p.label}</div>
                  {focused && <div className="sc-note">Required for PoW live testing</div>}
                  {note && <div className="sc-note">{note}</div>}
                </div>
                <div className="sc-actions">
                  <label
                    className={`sc-platform-toggle ${selectedForPow ? 'is-on' : 'is-off'}`}
                    title={powSetupRequired
                      ? selectedForPow ? 'This platform is included in PoW posting' : 'This platform will not be checked or used for PoW posting'
                      : selectedForPow ? 'This platform is saved as selected for future posting use' : 'This platform is not selected right now'}
                  >
                    <input
                      type="checkbox"
                      checked={selectedForPow}
                      onChange={() => togglePlatformUse(p.platform, selectedForPow)}
                      disabled={!enabled || platformSelectionBusy === p.platform}
                    />
                    <span>
                      {platformSelectionBusy === p.platform
                        ? 'Saving...'
                        : selectedForPow
                          ? powSetupRequired ? 'Use for PoW' : 'Selected'
                          : powSetupRequired ? 'Off for PoW' : 'Off'}
                    </span>
                  </label>
                  <RowBadge
                    connected={connected}
                    expired={expired}
                    disabled={!enabled || !selectedForPow}
                    connStatus={p.platform === 'linkedin' && !connected && Array.isArray(details.available_orgs) && details.available_orgs.length > 0 ? 'needs_designator' : undefined}
                  />
                  {enabled && selectedForPow && !instagramBlocked && (
                    isWebsite ? (
                      <button className="sc-btn sc-btn-ghost" onClick={() => setEmbedVisible(v => !v)}>
                        {embedVisible ? 'Hide code' : 'Get embed code'}
                      </button>
                    ) : connected ? (
                      <button className="sc-btn sc-btn-ghost" onClick={() => disconnectPlatform(p.platform)} disabled={!!disconnectingKey || busy}>{disconnectingKey === p.platform ? 'Disconnecting…' : 'Disconnect'}</button>
                    ) : p.platform === 'linkedin' && Array.isArray(details.available_orgs) && details.available_orgs.length > 0 ? (
                      <button className="sc-btn sc-btn-ghost" onClick={() => openPopup(p.platform)} disabled={busy}>
                        Reconnect
                      </button>
                    ) : (
                      <button className="sc-btn sc-btn-primary" onClick={() => openPopup(p.platform)} disabled={busy}>
                        {expired ? 'Reconnect' : 'Connect'}
                      </button>
                    )
                  )}
                </div>
              </div>
              {isWebsite && embedVisible && (
                <div className="sc-embed">
                  <div className="sc-embed-label">Paste this tag before &lt;/body&gt; on your website:</div>
                  <div className="sc-embed-row">
                    <code className="sc-embed-code">{embedCode}</code>
                    <button className="sc-btn sc-btn-ghost sc-btn-xs" onClick={copyEmbed}>{embedCopied ? '✓ Copied' : 'Copy'}</button>
                  </div>
                </div>
              )}
              {p.platform === 'facebook' && Array.isArray(details.available_pages) && details.available_pages.length > 1 && (
                <div className="sc-token-row">
                  <select
                    className="sc-input"
                    value={currentChoice('facebook_page', details.page_id)}
                    onChange={e => setChoice('facebook_page', e.target.value)}
                  >
                    <option value="">Choose Facebook Page...</option>
                    {details.available_pages.map(page => (
                      <option key={page.id} value={page.id}>
                        {page.name || page.id}{page.has_instagram ? ' + Instagram' : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    className="sc-btn sc-btn-primary"
                    disabled={selectionBusy === 'select_facebook_page' || !currentChoice('facebook_page', details.page_id)}
                    onClick={() => saveDestinationChoice('select_facebook_page', { page_id: currentChoice('facebook_page', details.page_id) })}
                  >
                    {selectionBusy === 'select_facebook_page' ? 'Saving...' : 'Use Page'}
                  </button>
                </div>
              )}
              {p.platform === 'instagram' && details.needs_business_account && (
                <div className="sc-note">Reconnect Facebook with an Instagram professional account linked to the Page.</div>
              )}
              {p.platform === 'linkedin' && Array.isArray(details.available_orgs) && details.available_orgs.length > 0 && (
                <div className="sc-token-row">
                  <div className="sc-row-error" style={{ width: '100%', background: 'rgba(34,197,94,.1)', borderColor: 'rgba(34,197,94,.35)', color: '#bbf7d0' }}>
                    LinkedIn found company pages for this login. Choose one company page for this Scale Small AI account.
                  </div>
                  <select
                    className="sc-input"
                    value={currentChoice('linkedin_org', details.org_urn)}
                    onChange={e => setChoice('linkedin_org', e.target.value)}
                  >
                    <option value="">Choose company page...</option>
                    {details.available_orgs.map((org, index) => (
                      <option key={org.urn} value={org.urn}>{linkedInOrgLabel(org, index)}</option>
                    ))}
                  </select>
                  {details.posting_route === 'organization' ? (
                    <span className="sc-badge sc-badge-green">Company page connected</span>
                  ) : (
                    <button
                      className="sc-btn sc-btn-primary"
                      disabled={selectionBusy === 'select_linkedin_route' || !currentChoice('linkedin_org', details.org_urn)}
                      onClick={() => saveDestinationChoice('select_linkedin_route', { route: 'organization', org_urn: currentChoice('linkedin_org', details.org_urn) })}
                    >
                      Use company page
                    </button>
                  )}
                </div>
              )}
              {p.platform === 'linkedin' && details.needs_org_selection && (
                <div className="sc-note">LinkedIn PoW posts go to a company page. Reconnect with company-page permissions, then choose the page here.</div>
              )}
              {p.platform === 'tiktok' && details.bridge_ready && !details.direct_ready && (
                <div className="sc-note">Using UploadPost bridge. Direct TikTok will be ready after app approval and reconnect.</div>
              )}
              {p.platform === 'facebook' && details.bridge_ready && !details.direct_ready && (
                <div className="sc-note">Using UploadPost bridge. Direct Facebook will be ready after app approval and reconnect.</div>
              )}
              {p.platform === 'instagram' && details.bridge_ready && !details.direct_ready && (
                <div className="sc-note">Using UploadPost bridge. Direct Instagram will be ready after app approval and reconnect.</div>
              )}
              {selectionError && ['facebook', 'linkedin'].includes(p.platform) && (
                <span style={{ color: '#fca5a5', fontSize: 12 }}>{selectionError}</span>
              )}
            </div>
          );
        })}
      </div>

      {allowPublisherProxyConfig && (
        <div>
          <div className="sc-section-label" style={{ marginTop: 20 }}>API Posting Proxy</div>
          <p className="sc-subtitle">UploadPost enables temporary proxy posting to Facebook, Instagram, and TikTok.</p>
          <div className="sc-list">
            <div className="sc-row">
              <div className="sc-row-main">
                <BrandIcon icon={iconFor('uploadpost', 'UP')} />
                <div className="sc-info">
                  <div className="sc-name">UploadPost</div>
                  <div className="sc-note">Covers Facebook, Instagram, and TikTok</div>
                </div>
                <div className="sc-actions">
                  <span className={`sc-badge ${hasUploadPostReady ? 'sc-badge-green' : 'sc-badge-red'}`}>{hasUploadPostReady ? 'Active' : 'Not configured'}</span>
                  {hasUploadPostReady && <button className="sc-btn sc-btn-ghost" onClick={() => saveUploadPostKey(true)} disabled={uploadPostBusy}>Remove</button>}
                </div>
              </div>
              {(!hasUploadPostReady || showUploadPostForm) && (
                <div className="sc-token-row">
                  <input
                    className="sc-input"
                    type="password"
                    placeholder="UploadPost API key"
                    value={uploadPostInput}
                    onChange={e => setUploadPostInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveUploadPostKey(false)}
                  />
                  <input
                    className="sc-input"
                    type="text"
                    placeholder="UploadPost user/account"
                    value={uploadPostUserInput}
                    onChange={e => setUploadPostUserInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveUploadPostKey(false)}
                  />
                  <button className="sc-btn sc-btn-primary" onClick={() => saveUploadPostKey(false)} disabled={uploadPostBusy || !uploadPostInput || !uploadPostUserInput}>
                    {uploadPostBusy ? 'Saving…' : hasUploadPostReady ? 'Update' : 'Save'}
                  </button>
                </div>
              )}
              {!hasUploadPostReady && !showUploadPostForm && (
                <div className="sc-note">Missing: {[!hasUploadPostKey && 'API key', !hasUploadPostUser && 'user/account'].filter(Boolean).join(', ')}</div>
              )}
              {hasUploadPostReady && !showUploadPostForm && (
                <button className="sc-btn sc-btn-ghost sc-btn-xs" style={{ alignSelf: 'flex-start' }} onClick={() => setShowUploadPostForm(true)}>Update UploadPost credentials</button>
              )}
              {uploadPostError && <span style={{ color: '#fca5a5', fontSize: 12 }}>{uploadPostError}</span>}
            </div>
          </div>
        </div>
      )}

      <div className="sc-section-label" style={{ marginTop: 20 }}>Photo Feed Sources</div>
      <p className="sc-subtitle">Connect where your team takes job photos.</p>
      <div className="sc-list">
        {DATA_SOURCES.map(s => {
          const conn = connectorMap[s.source_type];
          const isManualPhotoUpload = s.source_type === 'manual_photo_upload';
          const isLiveSource = LIVE_PHOTO_SOURCE_CONNECTOR_TYPES.has(s.source_type);
          const isConfigured = Boolean(conn);
          const isConnected = isLiveSource && conn?.is_active === true;
          const isPending = conn?.status === 'pending_discovery';
          const isComingSoon = !isLiveSource || conn?.availability_status === 'coming_soon' || conn?.status === 'coming_soon';
          const isUnavailable = !isConfigured || isComingSoon;
          const isApiKey = conn?.auth_type === 'api_key';
          const tokenVal = tokenInputs[s.source_type] || '';
          const tErr = tokenErrors[s.source_type];
          const tBusy = tokenBusy[s.source_type];

          let note = null;
          if (isManualPhotoUpload && photoUploadResult?.uploaded > 0) note = `${photoUploadResult.uploaded} photo${photoUploadResult.uploaded === 1 ? '' : 's'} uploaded`;
          else if (isConnected && conn?.photos_imported > 0) note = `${conn.photos_imported.toLocaleString()} photos imported`;
          else if (isPending) note = 'Verifying connection…';
          else if (!isConfigured) note = 'Not available yet';
          else if (isComingSoon) note = 'Coming soon';
          else if (isManualPhotoUpload) note = 'Upload JPG, PNG, or WebP job photos from this dashboard';
          else if (isApiKey && !isConnected) note = 'Paste your API token below to connect';

          return (
            <div key={s.source_type} className="sc-row">
              <div className="sc-row-main">
                <BrandIcon icon={s.icon} />
                <div className="sc-info">
                  <div className="sc-name">{s.label}</div>
                  {note && <div className="sc-note">{note}</div>}
                </div>
                <div className="sc-actions">
                  <RowBadge connected={isConnected} disabled={false} connStatus={!isConfigured ? 'not_configured' : isComingSoon ? 'coming_soon' : conn?.status} />
                  {isManualPhotoUpload ? (
                    <>
                      {isConnected && (
                        <button className="sc-btn sc-btn-ghost" onClick={() => disconnectConnector(s.source_type)} disabled={!!disconnectingKey || busy}>
                          {disconnectingKey === s.source_type ? 'Disconnecting…' : 'Disconnect'}
                        </button>
                      )}
                      <button
                        className="sc-btn sc-btn-primary"
                        onClick={() => photoFileInputRef.current?.click()}
                        disabled={photoUploadBusy}
                      >
                        {photoUploadBusy ? 'Uploading…' : isConnected ? 'Upload More' : 'Upload Photos'}
                      </button>
                    </>
                  ) : isConnected ? (
                    <button className="sc-btn sc-btn-ghost" onClick={() => disconnectConnector(s.source_type)} disabled={!!disconnectingKey || busy}>{disconnectingKey === s.source_type ? 'Disconnecting…' : 'Disconnect'}</button>
                  ) : !isUnavailable && !isPending && !isApiKey && (
                    <button className="sc-btn sc-btn-primary" onClick={() => openPopup(s.source_type)} disabled={busy}>Connect</button>
                  )}
                </div>
              </div>
              {!isConnected && isApiKey && !isUnavailable && (
                <div className="sc-token-row">
                  <input
                    className="sc-input"
                    type="password"
                    placeholder={`${s.label} API token`}
                    value={tokenVal}
                    onChange={e => setTokenInputs(i => ({ ...i, [s.source_type]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && connectApiKey(s.source_type)}
                  />
                  <button className="sc-btn sc-btn-primary" onClick={() => connectApiKey(s.source_type)} disabled={!!tBusy || !tokenVal}>
                    {tBusy ? 'Connecting…' : 'Connect'}
                  </button>
                  {tErr && <span style={{ color: '#fca5a5', fontSize: '12px', width: '100%' }}>{tErr}</span>}
                </div>
              )}
              {isManualPhotoUpload && (
                <>
                  <input
                    ref={photoFileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handlePhotoUpload}
                  />
                  {photoUploadError && (
                    <span style={{ color: '#fca5a5', fontSize: 12, padding: '4px 0 0 4px' }}>{photoUploadError}</span>
                  )}
                  {photoUploadResult?.skipped > 0 && (
                    <span style={{ color: '#fbbf24', fontSize: 12, padding: '4px 0 0 4px' }}>{photoUploadResult.skipped} file{photoUploadResult.skipped === 1 ? '' : 's'} skipped.</span>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="sc-section-label" style={{ marginTop: 20 }}>Customer Data Sources</div>
      <p className="sc-subtitle">Connect your CRM to enrich outreach with real customer data.</p>
      <div className="sc-list">
        {CRM_PLATFORMS.map(crm => {
          const conn = connectorMap[crm.connector_type];
          const isConnected = conn?.is_active === true;
          const isComingSoon = conn?.availability_status === 'coming_soon' || conn?.status === 'coming_soon';
          const isPending = conn?.designator_discovery_status === 'pending' || conn?.status === 'pending_discovery';
          const isFailed = conn?.designator_discovery_status === 'failed';
          const configNote = conn?.config;

          let note = null;
          if (isComingSoon) note = 'Coming soon';
          else if (isPending) note = 'Verifying connection…';
          else if (isFailed) note = 'Setup required — check connection';
          else if (isConnected && configNote?.hub_domain) note = configNote.hub_domain;
          else if (isConnected && configNote?.org_name) note = configNote.org_name;
          else if (isConnected && configNote?.location_id) note = `Location: ${configNote.location_id}`;

          return (
            <div key={crm.connector_type} className="sc-row">
              <div className="sc-row-main">
                <BrandIcon icon={crm.icon} />
                <div className="sc-info">
                  <div className="sc-name">{crm.label}</div>
                  {note && <div className="sc-note">{note}</div>}
                </div>
                <div className="sc-actions">
                  <RowBadge connected={isConnected} disabled={false} connStatus={isComingSoon ? 'coming_soon' : isPending ? 'pending_discovery' : isFailed ? 'needs_designator' : undefined} />
                  {!isComingSoon && (
                    isConnected ? (
                      <button className="sc-btn sc-btn-ghost" onClick={() => disconnectConnector(crm.connector_type)} disabled={!!disconnectingKey || busy}>
                        {disconnectingKey === crm.connector_type ? 'Disconnecting…' : 'Disconnect'}
                      </button>
                    ) : (
                      <button className="sc-btn sc-btn-primary" onClick={() => openPopup(crm.platform)} disabled={busy}>
                        {isFailed ? 'Reconnect' : 'Connect'}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Manual Upload row */}
        <div className="sc-row">
          <div className="sc-row-main">
            <span className="sc-icon sc-icon-badge" aria-hidden="true" style={BRAND_ICON_STYLE}>↑</span>
            <div className="sc-info">
              <div className="sc-name">Manual Upload</div>
              {manualUploadResult ? (
                <div className="sc-note" style={{ color: '#86efac' }}>
                  {manualUploadResult.inserted > 0 && `${manualUploadResult.inserted} added`}
                  {manualUploadResult.inserted > 0 && (manualUploadResult.updated > 0 || manualUploadResult.customer_inserted > 0 || manualUploadResult.customer_updated > 0 || manualUploadResult.skipped > 0) && ' · '}
                  {manualUploadResult.updated > 0 && `${manualUploadResult.updated} updated`}
                  {manualUploadResult.updated > 0 && (manualUploadResult.customer_inserted > 0 || manualUploadResult.customer_updated > 0 || manualUploadResult.skipped > 0) && ' · '}
                  {manualUploadResult.customer_inserted > 0 && `${manualUploadResult.customer_inserted} customers ready`}
                  {manualUploadResult.customer_inserted > 0 && (manualUploadResult.customer_updated > 0 || manualUploadResult.skipped > 0) && ' · '}
                  {manualUploadResult.customer_updated > 0 && `${manualUploadResult.customer_updated} customers updated`}
                  {manualUploadResult.customer_updated > 0 && manualUploadResult.skipped > 0 && ' · '}
                  {manualUploadResult.skipped > 0 && `${manualUploadResult.skipped} unchanged`}
                </div>
              ) : (
                <div className="sc-note">CSV, TSV, JSON, XLSX, XLS, VCF — duplicates merged automatically</div>
              )}
            </div>
            <div className="sc-actions">
              {manualUploadBusy
                ? <span className="sc-badge sc-badge-amber">Uploading…</span>
                : manualUploadResult
                  ? <span className="sc-badge sc-badge-green">Done</span>
                  : <span className="sc-badge sc-badge-off">No file</span>
              }
              <button
                className="sc-btn sc-btn-primary"
                disabled={manualUploadBusy}
                onClick={() => fileInputRef.current?.click()}
              >
                {manualUploadBusy ? 'Uploading…' : 'Upload File'}
              </button>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.json,.xlsx,.xls,.vcf,.txt"
            style={{ display: 'none' }}
            onChange={handleManualUpload}
          />
          {manualUploadError && (
            <span style={{ color: '#fca5a5', fontSize: 12, padding: '4px 0 0 4px' }}>{manualUploadError}</span>
          )}
        </div>
      </div>

      <div className="sc-connect-finish">
        <div className="sc-connect-finish-copy">
          <div className="sc-section-label" style={{ marginTop: 0 }}>Finish connection setup</div>
          <p className="sc-subtitle" style={{ marginBottom: 0 }}>
            Save if you need to come back later. Finish when the required sections for your selected services are ready. Optional connections can be added later from this page.
          </p>
          <div className="sc-connect-checks">
            <span className={`sc-badge ${powSetupRequired ? (gatedMissingSelectedPlatforms.length === 0 ? 'sc-badge-green' : 'sc-badge-amber') : 'sc-badge-off'}`}>
              {powSetupRequired
                ? gatedMissingSelectedPlatforms.length === 0
                  ? 'Selected platforms ready'
                  : `${gatedMissingSelectedPlatforms.length} platform${gatedMissingSelectedPlatforms.length === 1 ? '' : 's'} need attention`
                : 'Posting platforms optional'}
            </span>
            <span className={`sc-badge ${photoSourceRequired ? (photoSourceConnected ? 'sc-badge-green' : 'sc-badge-amber') : (photoSourceConnected ? 'sc-badge-green' : 'sc-badge-off')}`}>
              {photoSourceRequired
                ? photoSourceConnected ? 'Photo source connected' : 'Photo source needed'
                : photoSourceConnected ? 'Photo source connected' : 'Photo source optional'}
            </span>
            <span className={`sc-badge ${customerDataRequired ? (customerDataConnected ? 'sc-badge-green' : 'sc-badge-amber') : (customerDataConnected ? 'sc-badge-green' : 'sc-badge-off')}`}>
              {customerDataConnected
                ? customerRecordCount > 0
                  ? `Customer data ready (${customerRecordCount})`
                  : 'Customer source connected'
                : customerDataRequired
                  ? 'Customer data needed'
                  : 'Customer data optional'}
            </span>
          </div>
          {gatedMissingSelectedPlatforms.length > 0 && (
            <div className="sc-note">Needs attention: {gatedMissingSelectedPlatforms.join(', ')}</div>
          )}
          {!connectFlowReady && connectFlowMissingItems.length > 0 && (
            <div className="sc-connect-blockers" role="status" aria-live="polite">
              <strong>Before you finish:</strong>
              <ul>
                {connectFlowMissingItems.map(item => <li key={item}>{item}</li>)}
              </ul>
            </div>
          )}
          {connectFlowSaved === 'saved' && <div className="sc-success">Connection progress saved. You can close this page and return later at connect.scalesmall.ai/connect.</div>}
          {connectFlowError && <div className="sc-row-error">{connectFlowError}</div>}
        </div>
        <div className="sc-connect-finish-actions">
          <button
            type="button"
            className="sc-btn sc-btn-ghost"
            onClick={() => saveConnectFlow('saved')}
            disabled={connectFlowBusy}
          >
            {connectFlowBusy ? 'Saving...' : 'Save and exit'}
          </button>
          <button
            type="button"
            className="sc-btn sc-btn-primary"
            onClick={() => saveConnectFlow('confirmed')}
            disabled={connectFlowBusy || !connectFlowReady}
            title={connectFlowBlockerTitle}
          >
            {connectFlowBusy ? 'Saving...' : 'Finish and continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
