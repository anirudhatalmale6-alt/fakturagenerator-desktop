// Fakturagenerator - Electron main process
// Serves the pre-built web app from a custom, secure, standard scheme ("app://") so that:
//   1. The app gets a STABLE origin across launches -> localStorage (where saved customers
//      and invoice history live) persists reliably between sessions.
//   2. The origin is a "secure context", which the browser APIs the app uses expect.
//   3. Asset paths resolve correctly (they don't reliably under file://).
// The app is 100% self-contained and works fully offline - no server, no internet.

const { app, BrowserWindow, protocol, net, shell, Menu, session } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const APP_SCHEME = 'app';
const APP_HOST = 'local';
const WEB_DIR = path.join(__dirname, 'web');

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

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#f8fafc',
    title: 'Fakturagenerator',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
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

app.whenReady().then(() => {
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
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
