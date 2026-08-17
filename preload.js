// Exposes a tiny, safe bridge so the web app can receive jobs handed over from
// the Job Tracker app. contextIsolation is on and nodeIntegration is off, so
// the page can only use exactly what is exposed here.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jobHandoff', {
  available: true,
  // Returns a pending handoff (and clears it) or null. Used on startup, since
  // the handoff can arrive before the page has finished loading.
  take: () => ipcRenderer.invoke('handoff:take'),
  // Fires when a job is handed over while the app is already running.
  onHandoff: (cb) => {
    const listener = (_event, payload) => cb(payload);
    ipcRenderer.on('handoff:received', listener);
    return () => ipcRenderer.removeListener('handoff:received', listener);
  },
});
