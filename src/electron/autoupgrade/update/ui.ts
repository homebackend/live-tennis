import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { UpdateRendererKeys } from './render_keys';
import path from 'path';
import { ElectronUpdateEnv } from '../electron_env';
import { AppInitializationCubit } from 'src/common/update/app_initialization_cubit';
import { ElectronAppUpdateCubit } from '../app_update_cubit';
import { AppInitializationState } from 'src/common/update/types';
import { startUpdateWithUI } from '../download/ui';

type UpdateData = {
  currentVersion: string;
  latestVersion: string;
  changeLog: string;
  downloadUrl: string;
};

async function showUpdateWindow(data: UpdateData): Promise<'update' | 'skip'> {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 480,
      height: 560,
      resizable: false,
      show: true,
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'autoupgrade', 'update', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    //win.webContents.openDevTools({ mode: 'detach' });

    win.loadFile(path.join(__dirname, 'autoupgrade', 'update', 'index.html'));

    win.once('ready-to-show', () => {
      win.webContents.send(UpdateRendererKeys.updateData, data);
      win.show();
    });

    const cleanup = () => {
      ipcMain.removeAllListeners(UpdateRendererKeys.startUpdate);
      ipcMain.removeAllListeners(UpdateRendererKeys.skipUpdate);
      if (!win.isDestroyed()) win.close();
    };

    ipcMain.once(UpdateRendererKeys.startUpdate, (_e, url: string) => {
      cleanup();
      resolve('update');
    });

    ipcMain.once(UpdateRendererKeys.skipUpdate, () => {
      cleanup();
      resolve('skip');
    });

    ipcMain.once(UpdateRendererKeys.quit, () => {
      cleanup();
      app.exit(0);
    });

    win.on('closed', () => {
      ipcMain.removeAllListeners(UpdateRendererKeys.startUpdate);
      ipcMain.removeAllListeners(UpdateRendererKeys.skipUpdate);
      resolve('skip');
    });
  });
}

export async function checkForUpdateAndStart(
  splash: BrowserWindow,
  log: (logs: string[]) => void,
  mainWindow: () => void
): Promise<void> {
  log(['Checking if update is available']);
  const env = new ElectronUpdateEnv();
  const initCubit = new AppInitializationCubit(
    'homebackend',
    'live-tennis',
    'live-tennis',
    env,
    log
  );
  const updateCubit = new ElectronAppUpdateCubit('live-tennis', env, log);

  function splashCleanup() {
    if (splash && !splash.isDestroyed()) splash.close();
  }

  initCubit.on('state', async (status: any) => {
    if (status.state === AppInitializationState.showUpdateDetails) {
      const current = await env.getCurrentInfo();

      if (splash && !splash.isDestroyed()) splash.hide();
      log(['Update available', current.version, '->', status.latestVersion]);
      const action = await showUpdateWindow({
        currentVersion: current.version,
        latestVersion: status.latestVersion,
        changeLog: status.changeLog,
        downloadUrl: status.downloadUrl,
      });

      splashCleanup();

      if (action === 'update') {
        log(['Trying update']);
        await startUpdateWithUI(status.downloadUrl, updateCubit, mainWindow);
        await updateCubit.tryUpdate(status.downloadUrl);
      } else {
        log(['Update skipped']);
        mainWindow();
      }
    }

    if (status.state === AppInitializationState.updateCheckFailed) {
      log(['Error during update check', JSON.stringify(status)]);
      await dialog.showMessageBox({
        type: 'error',
        title: 'Update Check Failed',
        message: status.error,
        buttons: ['OK'],
      });
      splashCleanup();
      mainWindow();
    }

    if (status.state === AppInitializationState.initialized) {
      log(['Starting main application window']);
      splashCleanup();
      mainWindow();
    }
  });

  await initCubit.initialize();
}
