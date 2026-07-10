
import { contextBridge, ipcRenderer } from 'electron';
import { UpdateRendererKeys } from './render_keys';

contextBridge.exposeInMainWorld('electronAPIUpdate', {
  log: (log: string[]): void => ipcRenderer.send(UpdateRendererKeys.log, log),
  basePath: (): Promise<string> =>
    ipcRenderer.invoke(UpdateRendererKeys.basePath),
  resizeToFitContents: (
    windowIndex: number,
    width: number,
    height: number
  ): void =>
    ipcRenderer.send(
      UpdateRendererKeys.resizeToFitContents,
      windowIndex,
      width,
      height
    ),

  onUpdateLiveViewContent: (callback: any) =>
    ipcRenderer.on(LiveViewRendererKeys.updateLiveViewContent, (_, ...args) =>
      callback(...args)
    ),
  onSetLiveViewContentsEmpty: (callback: any) =>
    ipcRenderer.on(
      LiveViewRendererKeys.setLiveViewContentsEmpty,
      (_, ...args) => callback(...args)
    ),
  onSetWindowIndex: (callback: any) =>
    ipcRenderer.on(LiveViewRendererKeys.setWindowIndex, (_, ...args) =>
      callback(...args)
    ),
});
