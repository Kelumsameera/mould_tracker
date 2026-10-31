const { app, BrowserWindow, Menu, dialog, session } = require('electron');
const path = require('node:path');
const APP_URL = 'https://tools.192.168.0.116.sslip.io:8444/';
const OFFLINE = 'file://' + path.join(__dirname, 'offline.html').replaceAll('\\', '/');
let window;
let failed = false;
function allowed(url) {
  try { return new URL(url).origin === new URL(APP_URL).origin; } catch { return false; }
}
function load() {
  failed = false;
  window.loadURL(APP_URL).catch(() => {
    failed = true;
    window.loadFile(path.join(__dirname, 'offline.html'));
  });
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    window = new BrowserWindow({
      width: 1280, height: 850, minWidth: 380, minHeight: 560, title: 'Mould Tracker',
      icon: path.join(__dirname, 'icon.png'), backgroundColor: '#1B2B35', autoHideMenuBar: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true }
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.setUserAgent(window.webContents.getUserAgent() + ' ToolTrackerNative/' + app.getVersion());
    window.webContents.on('will-navigate', (event, url) => {
      if (url === 'https://tool-tracker-retry.invalid/' && failed) { event.preventDefault(); load(); return; }
      if (!allowed(url) && url !== OFFLINE) event.preventDefault();
    });
    window.webContents.on('will-redirect', (event, url) => { if (!allowed(url)) event.preventDefault(); });
    window.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.key === 'F11') { window.setFullScreen(!window.isFullScreen()); event.preventDefault(); }
      if (input.type === 'keyDown' && (input.key === 'F5' || ((input.control || input.meta) && input.key.toLowerCase() === 'r'))) { event.preventDefault(); load(); }
    });
    // Keep normal TLS certificate verification. Install the factory CA using the setup guide.
    app.on('certificate-error', (event, _contents, url, _error, _certificate, callback) => {
      event.preventDefault(); callback(false);
      if (allowed(url)) dialog.showErrorBox('Factory certificate required', 'Install the Tool Tracker LAN Root CA using http://192.168.0.116:8081/install.html, then restart Mould Tracker.');
    });
    load();
    if (app.isPackaged) require(path.join(__dirname, 'updater.cjs')).start(window);
  });
  app.on('window-all-closed', () => app.quit());
}
