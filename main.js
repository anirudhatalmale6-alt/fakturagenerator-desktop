// Invoice gen - Electron main process
// Serves the pre-built web app from a custom, secure, standard scheme ("app://") so that:
//   1. The app gets a STABLE origin across launches -> localStorage (where saved customers
//      and invoice history live) persists reliably between sessions.
//   2. The origin is a "secure context", which the browser APIs the app uses expect.
//   3. Asset paths resolve correctly (they don't reliably under file://).
// The app is 100% self-contained and works fully offline - no server, no internet.

const { app, BrowserWindow, protocol, net, shell, Menu, session, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const APP_SCHEME = 'app';
const APP_HOST = 'local';
const WEB_DIR = path.join(__dirname, 'web');

// Electron derives the userData folder from the product name, and localStorage
// (saved customers, my details, saved invoices) lives inside it. The app was
// released as "Fakturagenerator" and later renamed to "Invoice gen", so pin the
// folder to the original name - otherwise the rename would silently point the
// app at an empty profile and everything saved in 1.0.0 would look deleted.
app.setPath('userData', path.join(app.getPath('appData'), 'Fakturagenerator'));

// Minimal content-type map for the static assets we serve.
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

// Register the custom scheme as privileged BEFORE the app is ready.
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);

function resolveWebPath(requestUrl) {
  const url = new URL(requestUrl);
  let pathname = decodeURIComponent(url.pathname);
  if (!pathname || pathname === '/') pathname = '/index.html';

  // Normalise and prevent path traversal outside WEB_DIR.
  const filePath = path.normalize(path.join(WEB_DIR, pathname));
  if (!filePath.startsWith(WEB_DIR)) return null;
  return filePath;
}

// --- Receiving jobs from the Job Tracker app -------------------------------
// Job Tracker writes the job to a shared file and then opens invoicegen://,
// which macOS routes to this app (launching it if needed). The URL is only the
// trigger; the data is read from the file, so nothing has to survive URL
// escaping or length limits.
const HANDOFF_SCHEME = 'invoicegen';
const BRIDGE_DIR = path.join(app.getPath('appData'), 'JobTrackerInvoiceBridge');
const BRIDGE_FILE = path.join(BRIDGE_DIR, 'handoff.json');

// Set when a handoff arrives before the window/page is ready to receive it.
let pendingHandoff = null;

// A handoff is only meant to be collected moments after the click that made it.
// Anything older is stale (Invoice gen never opened, the send failed, the Mac
// was restarted) and must not surprise the user by appearing on a later launch.
const HANDOFF_MAX_AGE_MS = 15 * 60 * 1000;

function readHandoffFile() {
  try {
    if (!fs.existsSync(BRIDGE_FILE)) return null;
    const payload = JSON.parse(fs.readFileSync(BRIDGE_FILE, 'utf8'));
    // Consume it either way, so the same jobs are never added twice.
    fs.unlinkSync(BRIDGE_FILE);

    if (!payload || !Array.isArray(payload.jobs) || payload.jobs.length === 0) return null;
    const age = Date.now() - Number(payload.sentAt || 0);
    if (!Number.isFinite(age) || age > HANDOFF_MAX_AGE_MS) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

// Called when the app is opened via invoicegen://. Delivers straight to the
// page if it is ready, otherwise holds it until the page asks for it.
function handleHandoff(win) {
  const payload = readHandoffFile();
  if (!payload) return;

  if (win && !win.isDestroyed() && win.webContents && !win.webContents.isLoading()) {
    win.webContents.send('handoff:received', payload);
  } else {
    pendingHandoff = payload;
  }

  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
}

ipcMain.handle('handoff:take', () => {
  // The page is ready now; hand over anything that arrived while it was not,
  // including a handoff that launched the app in the first place.
  const payload = pendingHandoff || readHandoffFile();
  pendingHandoff = null;
  return payload;
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#f8fafc',
    title: 'Invoice gen',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Open real external links (if any) in the system browser, not inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  win.loadURL(`${APP_SCHEME}://${APP_HOST}/`);
  return win;
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    { role: 'windowMenu' }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// The "Ladda ner PDF" button produces a blob download. In a desktop app the user
// should choose where the invoice lands, so always show a Save dialog defaulting
// to the Downloads folder, then reveal the finished file in Finder.
function setupDownloads() {
  session.defaultSession.on('will-download', (event, item) => {
    item.setSaveDialogOptions({
      title: 'Spara faktura / Save invoice',
      defaultPath: path.join(app.getPath('downloads'), item.getFilename()),
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });

    item.once('done', (e, state) => {
      if (state === 'completed') {
        shell.showItemInFolder(item.getSavePath());
      }
    });
  });
}

// Keep a reference so handoffs can be routed to the live window.
let mainWindow = null;

// A second launch (which is what opening invoicegen:// does when the app is
// already running) must hand its job to the existing window rather than start
// a second copy of the app pointing at the same data.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    handleHandoff(mainWindow);
  });

  // macOS delivers the URL through this event, both when the app is already
  // running and shortly after it is launched by the URL.
  app.on('open-url', (event, url) => {
    event.preventDefault();
    if (!url.startsWith(`${HANDOFF_SCHEME}://`)) return;
    if (app.isReady()) {
      handleHandoff(mainWindow);
    } else {
      // Too early for a window; the page will collect it via handoff:take.
      pendingHandoff = readHandoffFile();
    }
  });
}

app.whenReady().then(() => {
  // Claim invoicegen:// so Job Tracker can open this app. The packaged build
  // also declares the scheme in Info.plist, which is what macOS actually reads;
  // this call covers running unpackaged during development.
  try {
    app.setAsDefaultProtocolClient(HANDOFF_SCHEME);
  } catch (e) {
    /* not fatal - the Info.plist registration is the one that matters */
  }

  // Serve the bundled web app over the custom scheme.
  protocol.handle(APP_SCHEME, async (request) => {
    const filePath = resolveWebPath(request.url);
    if (!filePath) {
      return new Response('Not found', { status: 404 });
    }
    try {
      const res = await net.fetch(pathToFileURL(filePath).toString());
      const ext = path.extname(filePath).toLowerCase();
      const headers = new Headers(res.headers);
      if (MIME[ext]) headers.set('Content-Type', MIME[ext]);
      return new Response(res.body, { status: res.status, headers });
    } catch (e) {
      // SPA fallback: unknown non-file routes -> index.html
      if (!path.extname(filePath)) {
        const index = await net.fetch(pathToFileURL(path.join(WEB_DIR, 'index.html')).toString());
        return new Response(index.body, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
      return new Response('Not found', { status: 404 });
    }
  });

  setupDownloads();
  buildMenu();
  mainWindow = createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
