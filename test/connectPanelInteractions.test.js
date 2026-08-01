import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { createServer } from 'vite';

let viteServer;
let ConnectedPlatformActions;
let PageAccessModal;
let connectorAuthorizationMode;

before(async () => {
  viteServer = await createServer({
    root: process.cwd(),
    configFile: false,
    logLevel: 'silent',
    server: { middlewareMode: true },
    appType: 'custom',
  });
  ({ ConnectedPlatformActions, PageAccessModal, connectorAuthorizationMode } = await viteServer.ssrLoadModule(
    '/src/components/shared/connectPanelInteractions.jsx',
  ));
});

after(async () => {
  await viteServer?.close();
});

function buttonText(button) {
  return button.children.join('');
}

function createStyleDeclaration(initial = {}) {
  const declarations = new Map(Object.entries(initial).map(([name, declaration]) => [
    name,
    { value: String(declaration.value), priority: String(declaration.priority || '') },
  ]));
  const mutations = [];
  return {
    mutations,
    getPropertyValue(name) {
      return declarations.get(name)?.value || '';
    },
    getPropertyPriority(name) {
      return declarations.get(name)?.priority || '';
    },
    setProperty(name, value, priority = '') {
      const declaration = { value: String(value), priority: String(priority || '') };
      declarations.set(name, declaration);
      mutations.push({ operation: 'set', name, ...declaration });
    },
    removeProperty(name) {
      const previousValue = declarations.get(name)?.value || '';
      declarations.delete(name);
      mutations.push({ operation: 'remove', name });
      return previousValue;
    },
  };
}

test('bridge-ready connected TikTok renders OAuth upgrade and Disconnect actions', () => {
  const opened = [];
  const disconnected = [];
  let renderer;
  act(() => {
    renderer = TestRenderer.create(React.createElement(ConnectedPlatformActions, {
      connected: true,
      platform: 'tiktok',
      details: { bridge_ready: true, direct_ready: false },
      onOpenPopup: platform => opened.push(platform),
      onDisconnect: platform => disconnected.push(platform),
    }));
  });

  let buttons = renderer.root.findAllByType('button');
  assert.deepEqual(buttons.map(buttonText), ['Upgrade OAuth', 'Disconnect']);
  assert.equal(buttons[0].props['aria-label'], 'Upgrade TikTok OAuth access');
  assert.equal(buttons[0].props.disabled, false);
  assert.equal(buttons[1].props.disabled, false);

  act(() => buttons[0].props.onClick());
  act(() => buttons[1].props.onClick());
  assert.deepEqual(opened, ['tiktok']);
  assert.deepEqual(disconnected, ['tiktok']);

  act(() => {
    renderer.update(React.createElement(ConnectedPlatformActions, {
      connected: true,
      platform: 'tiktok',
      details: { bridge_ready: true, direct_ready: true },
      onOpenPopup: platform => opened.push(platform),
      onDisconnect: platform => disconnected.push(platform),
    }));
  });
  buttons = renderer.root.findAllByType('button');
  assert.deepEqual(buttons.map(buttonText), ['Disconnect']);
  act(() => renderer.unmount());
});

test('connector authorization mode recognizes supported methods and fails closed otherwise', () => {
  assert.equal(connectorAuthorizationMode({ connector_type: 'jobber', auth_type: 'oauth' }), 'oauth');
  assert.equal(connectorAuthorizationMode({ connector_type: 'companycam', auth_type: ' API_KEY ' }), 'api_key');
  assert.equal(connectorAuthorizationMode({ auth_type: 'password' }), 'unsupported');
  assert.equal(connectorAuthorizationMode({}), 'unsupported');
  assert.equal(connectorAuthorizationMode(null), 'unsupported');
});

test('page access dialog enters and traps focus, closes on Escape, and restores the trigger', () => {
  const previousDocument = globalThis.document;
  let closeFocusCalls = 0;
  let triggerFocusCalls = 0;
  let dialogFocusCalls = 0;
  let closeCalls = 0;
  let keydownHandler = null;
  let removedKeydownHandler = null;
  const bodyStyle = createStyleDeclaration({
    overflow: { value: 'clip', priority: 'important' },
    color: { value: 'rgb(1, 2, 3)' },
  });
  const triggerNode = {
    isConnected: true,
    focus() {
      triggerFocusCalls += 1;
      globalThis.document.activeElement = this;
    },
  };
  const closeNode = {
    hidden: false,
    getAttribute() { return null; },
    focus() {
      closeFocusCalls += 1;
      globalThis.document.activeElement = this;
    },
  };
  const dialogNode = {
    querySelectorAll() { return [closeNode]; },
    contains(target) { return target === closeNode; },
    focus() {
      dialogFocusCalls += 1;
      globalThis.document.activeElement = this;
    },
  };
  globalThis.document = {
    activeElement: triggerNode,
    body: { style: bodyStyle },
    addEventListener(type, handler) {
      if (type === 'keydown') keydownHandler = handler;
    },
    removeEventListener(type, handler) {
      if (type === 'keydown') removedKeydownHandler = handler;
    },
  };

  let renderer;
  try {
    act(() => {
      renderer = TestRenderer.create(React.createElement(PageAccessModal, {
        onClose: () => { closeCalls += 1; },
        returnFocusRef: { current: triggerNode },
      }), {
        createNodeMock(element) {
          if (element.props.role === 'dialog') return dialogNode;
          if (element.props['aria-label'] === 'Close page access help') return closeNode;
          return {};
        },
      });
    });

    const dialog = renderer.root.findByProps({ role: 'dialog' });
    assert.equal(dialog.props['aria-modal'], 'true');
    assert.equal(dialog.props['aria-labelledby'], 'sc-page-access-title');
    assert.equal(dialog.props['aria-describedby'], 'sc-page-access-description');
    assert.equal(dialog.props.tabIndex, -1);
    assert.equal(closeFocusCalls, 1, 'focus enters on the close button');
    assert.equal(dialogFocusCalls, 0);
    assert.equal(typeof keydownHandler, 'function');
    assert.equal(bodyStyle.getPropertyValue('overflow'), 'hidden', 'open modal locks background scrolling');
    assert.equal(bodyStyle.getPropertyPriority('overflow'), '');
    assert.equal(bodyStyle.getPropertyValue('color'), 'rgb(1, 2, 3)', 'unrelated body styles remain untouched');

    let tabPrevented = false;
    act(() => keydownHandler({
      key: 'Tab',
      shiftKey: false,
      preventDefault() { tabPrevented = true; },
    }));
    assert.equal(tabPrevented, true, 'Tab wraps inside a one-control modal');
    assert.equal(closeFocusCalls, 2);

    let escapePrevented = false;
    let escapeStopped = false;
    act(() => keydownHandler({
      key: 'Escape',
      preventDefault() { escapePrevented = true; },
      stopPropagation() { escapeStopped = true; },
    }));
    assert.equal(closeCalls, 1);
    assert.equal(escapePrevented, true);
    assert.equal(escapeStopped, true);

    act(() => renderer.unmount());
    renderer = null;
    assert.equal(triggerFocusCalls, 1, 'focus returns to the help trigger');
    assert.equal(removedKeydownHandler, keydownHandler, 'modal removes its document keyboard listener');
    assert.equal(bodyStyle.getPropertyValue('overflow'), 'clip', 'cleanup restores the prior overflow value');
    assert.equal(bodyStyle.getPropertyPriority('overflow'), 'important', 'cleanup restores the prior priority');
    assert.deepEqual(bodyStyle.mutations, [
      { operation: 'set', name: 'overflow', value: 'hidden', priority: '' },
      { operation: 'set', name: 'overflow', value: 'clip', priority: 'important' },
    ]);
    assert.deepEqual([...new Set(bodyStyle.mutations.map(mutation => mutation.name))], ['overflow']);
  } finally {
    if (renderer) act(() => renderer.unmount());
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('page access dialog removes its temporary scroll lock when no inline overflow existed', () => {
  const previousDocument = globalThis.document;
  const bodyStyle = createStyleDeclaration({ color: { value: 'navy' } });
  const closeNode = {
    hidden: false,
    getAttribute() { return null; },
    focus() { globalThis.document.activeElement = this; },
  };
  const dialogNode = {
    querySelectorAll() { return [closeNode]; },
    contains(target) { return target === closeNode; },
    focus() { globalThis.document.activeElement = this; },
  };
  globalThis.document = {
    activeElement: null,
    body: { style: bodyStyle },
    addEventListener() {},
    removeEventListener() {},
  };

  let renderer;
  try {
    act(() => {
      renderer = TestRenderer.create(React.createElement(PageAccessModal, {
        onClose() {},
      }), {
        createNodeMock(element) {
          if (element.props.role === 'dialog') return dialogNode;
          if (element.props['aria-label'] === 'Close page access help') return closeNode;
          return {};
        },
      });
    });
    assert.equal(bodyStyle.getPropertyValue('overflow'), 'hidden');

    act(() => renderer.unmount());
    renderer = null;
    assert.equal(bodyStyle.getPropertyValue('overflow'), '');
    assert.equal(bodyStyle.getPropertyPriority('overflow'), '');
    assert.equal(bodyStyle.getPropertyValue('color'), 'navy');
    assert.deepEqual(bodyStyle.mutations, [
      { operation: 'set', name: 'overflow', value: 'hidden', priority: '' },
      { operation: 'remove', name: 'overflow' },
    ]);
  } finally {
    if (renderer) act(() => renderer.unmount());
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});
