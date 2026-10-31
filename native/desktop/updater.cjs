// Checks the LAN download folder for a newer Windows installer and installs it after the user agrees.
const { app, dialog, net } = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const FEED = 'https://tools.192.168.0.116.sslip.io:8444/downloads/';
const CHECK_EVERY = 6 * 60 * 60 * 1000;
let busy = false;

function newer(remote, local) {
  const a = String(remote).split('.').map(Number), b = String(local).split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return false;
}

async function check(window) {
  if (busy) return;
  busy = true;
  let chosen = false;
  try {
    const response = await net.fetch(FEED + 'windows-latest.json', { cache: 'no-store' });
    if (!response.ok) return;
    const latest = await response.json();
    if (!newer(latest.version, app.getVersion()) || !/^[\w.-]+\.exe$/.test(latest.file) || !/^[0-9a-f]{64}$/i.test(latest.sha256)) return;
    const { response: choice } = await dialog.showMessageBox(window, {
      type: 'info', buttons: ['Update now', 'Later'], defaultId: 0, cancelId: 1, title: 'Mould Tracker update',
      message: `Mould Tracker ${latest.version} is available.`, detail: `You have ${app.getVersion()}. The app will close, update and open again.`
    });
    if (choice !== 0) return;
    chosen = true;
    const download = await net.fetch(FEED + latest.file, { cache: 'no-store' });
    if (!download.ok) throw new Error(`Download failed (${download.status})`);
    const data = Buffer.from(await download.arrayBuffer());
    if (crypto.createHash('sha256').update(data).digest('hex') !== latest.sha256.toLowerCase()) throw new Error('Downloaded installer checksum does not match.');
    const installer = path.join(os.tmpdir(), latest.file);
    fs.writeFileSync(installer, data);
    // NSIS silent install into the existing location, then start the updated app.
    spawn('cmd.exe', ['/c', `""${installer}" /S && start "" "${process.execPath}""`], { detached: true, stdio: 'ignore', windowsVerbatimArguments: true }).unref();
    app.quit();
  } catch (error) {
    // Being offline or on another network is normal; only report failures after the user chose to update.
    if (chosen) dialog.showErrorBox('Mould Tracker update failed', `${error.message}\n\nYou can keep using this version or download the installer from ${FEED}`);
  } finally {
    busy = false;
  }
}

function start(window) {
  setTimeout(() => check(window).catch(() => {}), 10_000);
  setInterval(() => check(window).catch(() => {}), CHECK_EVERY);
}

module.exports = { start, newer };
