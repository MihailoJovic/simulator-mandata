/**
 * Desktop omotač (Electron) za simulator.
 * - Učitava izgrađen sajt iz dist/ preko privatnog "app://" protokola (bez servera, bez mreže).
 * - Proverava nove verzije na GitHub Releases (electron-updater) i nudi "Skini" → "Restartuj i instaliraj".
 * Podaci (localStorage) ostaju na računaru korisnika.
 */
const { app, BrowserWindow, Menu, ipcMain, net, protocol, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const DIST = path.join(__dirname, '..', 'dist');
const ORIGIN = 'app://simulator';
const SMOKE = process.argv.find((a) => a.startsWith('--smoke-test='));
// Automatska provera koristi zaseban, privremeni profil — ne dira korisnikove podatke ni otvoreni prozor.
if (SMOKE) app.setPath('userData', fs.mkdtempSync(path.join(app.getPath('temp'), 'simulator-smoke-')));

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

function serveDist(request) {
  const { pathname } = new URL(request.url);
  const rel = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html';
  const file = path.normalize(path.join(DIST, rel));
  if (!file.startsWith(DIST + path.sep)) return new Response('Forbidden', { status: 403 });
  return net.fetch(pathToFileURL(file).toString());
}

const isExternal = (url) => /^https?:\/\//i.test(url);

const webPreferences = {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  preload: path.join(__dirname, 'preload.cjs'),
};

function hardenWindow(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    // Vizuelni prikaz (i druge stranice aplikacije) → novi prozor aplikacije.
    if (url.startsWith(ORIGIN)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 1280,
          height: 880,
          minWidth: 380,
          minHeight: 500,
          autoHideMenuBar: true,
          backgroundColor: '#0b1120',
          title: 'Vizuelni prikaz — Simulator mandata',
          webPreferences,
        },
      };
    }
    if (isExternal(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(ORIGIN)) {
      e.preventDefault();
      if (isExternal(url)) shell.openExternal(url);
    }
  });
}

app.on('browser-window-created', (_e, win) => hardenWindow(win));

function createWindow({ show = true } = {}) {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 380,
    minHeight: 500,
    show,
    title: 'Simulator mandata',
    backgroundColor: '#0b1120',
    autoHideMenuBar: true,
    webPreferences,
  });
  win.loadURL(`${ORIGIN}/index.html`);
  return win;
}

/* ───────────────────────── Ažuriranje ───────────────────────── */

let updateStatus = { state: 'idle' };
let autoUpdater = null;

function sendStatus(s) {
  updateStatus = s;
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('update:status', s);
}

function setupUpdater() {
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch {
    return;
  }
  autoUpdater.autoDownload = false; // korisnik bira "Skini"
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => sendStatus({ state: 'checking' }));
  autoUpdater.on('update-available', (info) => sendStatus({ state: 'available', version: info.version }));
  autoUpdater.on('update-not-available', () => sendStatus({ state: 'not-available' }));
  autoUpdater.on('download-progress', (p) => sendStatus({ state: 'downloading', percent: p.percent }));
  autoUpdater.on('update-downloaded', (info) => sendStatus({ state: 'downloaded', version: info.version }));
  autoUpdater.on('error', (err) => sendStatus({ state: 'error', message: String(err && err.message ? err.message : err).slice(0, 200) }));
}

const canUpdate = () => autoUpdater && app.isPackaged;

ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('update:get-status', () => updateStatus);
ipcMain.handle('update:check', async () => {
  if (!canUpdate()) return sendStatus({ state: 'not-available' });
  await autoUpdater.checkForUpdates().catch(() => {});
});
ipcMain.handle('update:download', async () => {
  if (!canUpdate()) return;
  sendStatus({ state: 'downloading', percent: 0 });
  await autoUpdater.downloadUpdate().catch(() => {});
});
ipcMain.handle('update:install', () => {
  if (canUpdate()) autoUpdater.quitAndInstall(false, true);
});

/* ───────────────────────── Automatska provera paketa ───────────────────────── */

/** --smoke-test=<putanja do izlaznog JSON fajla> */
async function smokeTest(outFile) {
  const win = createWindow({ show: false });
  const report = { ok: false };
  try {
    await new Promise((res, rej) => {
      win.webContents.once('did-finish-load', res);
      win.webContents.once('did-fail-load', (_e, code, desc) => rej(new Error(`${code} ${desc}`)));
    });
    Object.assign(
      report,
      await win.webContents.executeJavaScript(`(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const until = async (fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await wait(100); } return false; };
        const text = () => document.body.innerText;
        const btn = (s) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(s));
        const ezMode = await until(() => document.body.textContent.includes('1. Unesite rezultate'));
        const hemicycle = document.querySelectorAll('svg circle').length >= 250;
        const desktopApi = typeof window.desktop === 'object' && (await window.desktop.getVersion()).length > 0;
        btn('Advanced Mode').click();
        const advanced = await until(() => text().includes('250 / 250'));
        const tab = [...document.querySelectorAll('[role=tab]')].find((b) => b.textContent.includes('Monte Carlo'));
        tab.click();
        await wait(200);
        btn('Generiši scenarije').click();
        const mc = await until(() => text().includes('Odbačeno'));
        localStorage.setItem('smoke', '1');
        const storage = localStorage.getItem('smoke') === '1';
        localStorage.removeItem('smoke');
        btn('Ez Mode').click();
        btn('Vizuelni prikaz').click();
        return { ezMode, hemicycle, desktopApi, advanced, monteCarloWorker: mc, storage };
      })()`),
    );
    // Vizuelni prikaz treba da se otvori kao drugi prozor.
    const t0 = Date.now();
    let visual = null;
    while (Date.now() - t0 < 15000 && !visual) {
      visual = BrowserWindow.getAllWindows().find((w) => w !== win) || null;
      await new Promise((r) => setTimeout(r, 200));
    }
    if (visual) {
      const t1 = Date.now();
      while (Date.now() - t1 < 15000) {
        const ok = await visual.webContents.executeJavaScript(`document.body.innerText.includes('Izborna noć') && document.querySelectorAll('svg circle').length >= 250`).catch(() => false);
        if (ok) {
          report.visualWindow = true;
          // Opciono: snimci ekrana za vizuelnu proveru (SMOKE_SHOTS=<folder>).
          if (process.env.SMOKE_SHOTS) {
            await new Promise((r) => setTimeout(r, 800));
            fs.writeFileSync(path.join(process.env.SMOKE_SHOTS, 'main-ez.png'), (await win.webContents.capturePage()).toPNG());
            fs.writeFileSync(path.join(process.env.SMOKE_SHOTS, 'visual.png'), (await visual.webContents.capturePage()).toPNG());
          }
          break;
        }
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    report.visualWindow = !!report.visualWindow;
    report.ok = ['ezMode', 'hemicycle', 'desktopApi', 'advanced', 'monteCarloWorker', 'storage', 'visualWindow'].every((k) => report[k] === true);
  } catch (e) {
    report.error = String(e);
  }
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  app.exit(report.ok ? 0 : 1);
}

/* ───────────────────────── Start ───────────────────────── */

if (!SMOKE && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const w = BrowserWindow.getAllWindows()[0];
    if (w) {
      if (w.isMinimized()) w.restore();
      w.focus();
    }
  });

  app.whenReady().then(() => {
    protocol.handle('app', serveDist);
    Menu.setApplicationMenu(null);
    if (SMOKE) return smokeTest(SMOKE.slice('--smoke-test='.length));
    setupUpdater();
    createWindow();
    if (canUpdate()) {
      setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 4000);
      setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 2 * 60 * 60 * 1000);
    }
    app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
  });

  app.on('window-all-closed', () => app.quit());
}
