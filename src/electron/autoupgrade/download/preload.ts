import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronApiDownload', {
  onStatus: (cb: (d: any) => void) =>
    ipcRenderer.on('current-status', (_e, data) => cb(data)),
  onCancel: (cb: () => void) => ipcRenderer.on('cancel', cb),
  cancel: () => ipcRenderer.send('cancel'),
});
