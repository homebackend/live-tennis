import { BrowserWindow } from 'electron';
import path from 'path';

export function createSplash(): BrowserWindow {
  var splash = new BrowserWindow({
    width: 380,
    height: 260,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    center: true,
    resizable: false,
    show: false,
  });
  splash.loadFile(path.join(__dirname, 'splash', 'index.html'));
  splash.once('ready-to-show', () => splash.show());
  return splash;
}
