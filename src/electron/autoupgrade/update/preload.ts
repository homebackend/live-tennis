import { contextBridge, ipcRenderer } from 'electron';
import { UpdateRendererKeys } from './render_keys';

contextBridge.exposeInMainWorld('electronAPIUpdate', {
  log: (log: string[]): void => ipcRenderer.send(UpdateRendererKeys.log, log),
  basePath: (): Promise<string> =>
    ipcRenderer.invoke(UpdateRendererKeys.basePath),
  onUpdateData: (cb: (d: any) => void) =>
    ipcRenderer.on(UpdateRendererKeys.updateData, (_e, d) => cb(d)),
  onUpdateProgress: (cb: (p: string) => void) =>
    ipcRenderer.on(UpdateRendererKeys.updateProgress, (_e, p) => cb(p)),
  startUpdate: (url: string) =>
    ipcRenderer.send(UpdateRendererKeys.startUpdate, url),
  skipUpdate: () => ipcRenderer.send(UpdateRendererKeys.skipUpdate),
  quit: () => ipcRenderer.send(UpdateRendererKeys.quit),
});
