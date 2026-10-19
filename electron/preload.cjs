/** Bezbedan most između aplikacije i Electron-a (samo funkcije za ažuriranje i verziju). */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  getVersion: () => ipcRenderer.invoke('app:version'),
  getUpdateStatus: () => ipcRenderer.invoke('update:get-status'),
  onUpdateStatus: (cb) => {
    const handler = (_event, status) => cb(status);
    ipcRenderer.on('update:status', handler);
    return () => ipcRenderer.removeListener('update:status', handler);
  },
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
});
