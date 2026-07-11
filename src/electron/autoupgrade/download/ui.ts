import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'path';
import { ElectronAppUpdateCubit } from '../app_update_cubit';
import {
  AppUpdateState,
  AppUpdateStatus,
  OtaStatus,
} from 'src/common/update/types';

export function createDownloadWindow() {
  var win = new BrowserWindow({
    width: 440,
    height: 220,
    resizable: false,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'autoupgrade', 'download', 'preload.js'),
      contextIsolation: true,
    },
  });

  win.webContents.openDevTools({ mode: 'detach' });

  win.loadFile(path.join(__dirname, 'autoupgrade', 'download', 'index.html'));
  win.once('ready-to-show', () => win?.show());
  
  return win;
}

export async function startUpdateWithUI(
  downloadUrl: string,
  updateCubit: ElectronAppUpdateCubit,
  mainWindow: () => void
) {
  const win = createDownloadWindow();

  const onState = async (s: AppUpdateStatus) => {
    if (win.isDestroyed()) return;

    switch (s.state) {
      case AppUpdateState.userInput:
        win.show();
        break;
      case AppUpdateState.inProgress:
        if (s.event?.status === OtaStatus.INSTALLATION_DONE) {
          setTimeout(() => {
            app.relaunch();
            app.exit(0);
          }, 800);
        } else {
          win.webContents.send(
            'curent-status',
            `${s.event?.status}: ${s.event?.value}`
          );
        }
        break;
      case AppUpdateState.skipped:
        win.close();
        mainWindow();
        break;
      case AppUpdateState.error:
        win.close();
        await dialog.showMessageBox({
          type: 'error',
          title: 'Installation failed',
          message: s.error!,
          buttons: ['OK'],
        });
        mainWindow();
        break;
    }
  };

  updateCubit.on('state', onState);

  ipcMain.once('cancel', () => {
    updateCubit.close();
    if (!win.isDestroyed()) win.close();
  });

  win.show();
  await updateCubit.tryUpdate(downloadUrl);
}
