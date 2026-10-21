const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
async function launch() {
  const appEvents = {}, pageEvents = {};
  let window, permission;
  const app = { requestSingleInstanceLock: () => true, whenReady: async () => {}, on: (name, handler) => { appEvents[name] = handler; }, quit() {} };
  class BrowserWindow {
    constructor(options) {
      window = this; this.options = options;
      this.webContents = {
        on: (name, handler) => { pageEvents[name] = handler; },
        setWindowOpenHandler: (handler) => { this.popup = handler; },
        getUserAgent: () => 'test', setUserAgent() {}
      };
    }
    loadURL() { return Promise.resolve(); }
  }
  const electron = { app, BrowserWindow, Menu: { setApplicationMenu() {} }, dialog: { showErrorBox() {} }, session: { defaultSession: { setPermissionRequestHandler: (handler) => { permission = handler; } } } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../main.cjs'), 'utf8'), {
    __dirname: path.join(__dirname, '..'), require: (name) => name === 'electron' ? electron : require(name), URL
  });
  await Promise.resolve();
  return { window, appEvents, pageEvents, permission };
}
test('remote web content has no Node access or popup windows', async () => {
  const { window } = await launch();
  assert.equal(window.options.webPreferences.nodeIntegration, false);
  assert.equal(window.options.webPreferences.contextIsolation, true);
  assert.equal(window.options.webPreferences.sandbox, true);
  assert.equal(window.options.webPreferences.webSecurity, true);
  assert.equal(window.popup({ url: 'https://attacker.example' }).action, 'deny');
});
test('only the exact factory HTTPS origin can navigate or redirect', async () => {
  const { pageEvents } = await launch();
  for (const name of ['will-navigate', 'will-redirect']) {
    for (const url of ['http://tools.192.168.0.116.sslip.io:8444/', 'https://tools.192.168.0.116.sslip.io:8444.attacker.example/', 'https://tools.192.168.0.116.sslip.io/', 'file:///C:/Windows/win.ini', 'javascript:alert(1)']) {
      let blocked = false;
      pageEvents[name]({ preventDefault() { blocked = true; } }, url);
      assert.equal(blocked, true, url);
    }
    let blocked = false;
    pageEvents[name]({ preventDefault() { blocked = true; } }, 'https://tools.192.168.0.116.sslip.io:8444/api/auth/me');
    assert.equal(blocked, false);
  }
});
test('invalid factory certificates are rejected rather than bypassed', async () => {
  const { appEvents } = await launch(); let accepted;
  appEvents['certificate-error']({ preventDefault() {} }, {}, 'https://tools.192.168.0.116.sslip.io:8444/', 'invalid', {}, (value) => { accepted = value; });
  assert.equal(accepted, false);
});
test('remote pages cannot silently grant native permissions', async () => {
  const { permission } = await launch(); let granted;
  permission({}, 'media', (value) => { granted = value; });
  assert.equal(granted, false);
});
