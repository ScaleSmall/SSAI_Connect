import React, { useCallback, useEffect, useRef } from 'react';

const MODAL_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusSafely(target, operation) {
  if (typeof target?.focus !== 'function') return;
  try {
    target.focus({ preventScroll: true });
  } catch (error) {
    console.warn('[PageAccessModal] Focus operation failed', {
      operation,
      name: error?.name || 'Error',
    });
  }
}

function focusableElements(dialog) {
  if (typeof dialog?.querySelectorAll !== 'function') return [];
  return Array.from(dialog.querySelectorAll(MODAL_FOCUSABLE_SELECTOR)).filter(element => (
    element?.hidden !== true && element?.getAttribute?.('aria-hidden') !== 'true'
  ));
}

export function ConnectedPlatformActions({
  connected,
  platform,
  details = {},
  busy = false,
  disconnectingKey = null,
  onOpenPopup,
  onDisconnect,
}) {
  if (!connected) return null;
  const needsTikTokOAuthUpgrade = platform === 'tiktok'
    && details.bridge_ready === true
    && details.direct_ready !== true;
  const actionsDisabled = Boolean(disconnectingKey) || busy;

  return (
    <>
      {needsTikTokOAuthUpgrade && (
        <button
          type="button"
          className="sc-btn sc-btn-primary"
          onClick={() => onOpenPopup(platform)}
          disabled={actionsDisabled}
          aria-label="Upgrade TikTok OAuth access"
        >
          Upgrade OAuth
        </button>
      )}
      <button
        type="button"
        className="sc-btn sc-btn-ghost"
        onClick={() => onDisconnect(platform)}
        disabled={actionsDisabled}
      >
        {disconnectingKey === platform ? 'Disconnecting…' : 'Disconnect'}
      </button>
    </>
  );
}

export function connectorAuthorizationMode(connector) {
  const authType = String(connector?.auth_type || '').trim().toLowerCase();
  if (authType === 'oauth') return 'oauth';
  if (authType === 'api_key') return 'api_key';
  return 'unsupported';
}

export function PageAccessModal({ onClose, returnFocusRef }) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCloseRef.current();
      return;
    }
    if (event.key !== 'Tab') return;

    const dialog = dialogRef.current;
    const focusable = focusableElements(dialog);
    if (focusable.length === 0) {
      event.preventDefault();
      focusSafely(dialog, 'trap-empty');
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeElement = typeof document !== 'undefined' ? document.activeElement : null;
    const focusIsOutside = !dialog?.contains?.(activeElement);
    if (event.shiftKey && (activeElement === first || focusIsOutside)) {
      event.preventDefault();
      focusSafely(last, 'trap-backward');
    } else if (!event.shiftKey && (activeElement === last || focusIsOutside)) {
      event.preventDefault();
      focusSafely(first, 'trap-forward');
    }
  }, []);

  useEffect(() => {
    const documentAvailable = typeof document !== 'undefined';
    const returnFocusTarget = returnFocusRef?.current
      || (documentAvailable ? document.activeElement : null);
    const bodyStyle = documentAvailable ? document.body?.style : null;
    const previousBodyOverflow = bodyStyle?.getPropertyValue?.('overflow') || '';
    const previousBodyOverflowPriority = bodyStyle?.getPropertyPriority?.('overflow') || '';

    bodyStyle?.setProperty?.('overflow', 'hidden');
    focusSafely(closeButtonRef.current || dialogRef.current, 'entry');
    if (documentAvailable) document.addEventListener('keydown', handleKeyDown);

    return () => {
      if (documentAvailable) document.removeEventListener('keydown', handleKeyDown);
      if (bodyStyle?.setProperty && previousBodyOverflow) {
        bodyStyle.setProperty('overflow', previousBodyOverflow, previousBodyOverflowPriority);
      } else {
        bodyStyle?.removeProperty?.('overflow');
      }
      if (returnFocusTarget?.isConnected !== false) {
        focusSafely(returnFocusTarget, 'restore');
      }
    };
  }, [handleKeyDown, returnFocusRef]);

  return (
    <div className="sc-modal-backdrop" role="presentation">
      <div
        ref={dialogRef}
        className="sc-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sc-page-access-title"
        aria-describedby="sc-page-access-description"
        tabIndex={-1}
      >
        <div className="sc-modal-head">
          <h3 id="sc-page-access-title">Facebook and LinkedIn page access</h3>
          <button
            ref={closeButtonRef}
            type="button"
            className="sc-modal-close"
            onClick={onClose}
            aria-label="Close page access help"
          >
            Close
          </button>
        </div>
        <p id="sc-page-access-description">
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
