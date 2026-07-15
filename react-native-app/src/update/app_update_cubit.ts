import { AppUpdateCubit } from '@common/update/app_update_cubit';
import RNFetchBlob from 'rn-fetch-blob';
import {
  AppUpdateState,
  AppUpdateStatus,
  OtaEvent,
  OtaStatus,
} from '@common/update/types';
import { Linking, NativeModules, Platform } from 'react-native';
const { ApkInstaller } = NativeModules;

export class RNAppUpdateCubit extends AppUpdateCubit {
  async tryUpdate(downloadUrl: string): Promise<void> {
    if (Platform.OS === 'android') {
      await this.tryOtaUpdate(downloadUrl);
    } else {
      this.skipUpdate();
    }
  }

  async tryOtaUpdate(downloadUrl: string) {
    const fileName = `${this.upgradeFileName}.apk`;
    const cacheDir = ApkInstaller.getExternalCacheDir();

    const apkPath = `${cacheDir}/${fileName}`;

    await RNFetchBlob.fs.mkdir(cacheDir);

    try {
      try {
        if (await RNFetchBlob.fs.exists(apkPath))
          await RNFetchBlob.fs.unlink(apkPath);
      } catch {}

      this.emitState(
        new AppUpdateStatus(
          AppUpdateState.inProgress,
          new OtaEvent(OtaStatus.DOWNLOADING, '0%'),
        ),
      );

      const res = await RNFetchBlob.config({ fileCache: true, path: apkPath })
        .fetch('GET', downloadUrl)
        .progress((received, total) => {
          const r = Number(received),
            t = Number(total);
          const value =
            t > 0
              ? `${Math.floor((r / t) * 100)}%`
              : `${(r / 1024 / 1024).toFixed(1)} MB`;
          this.emitState(
            new AppUpdateStatus(
              AppUpdateState.inProgress,
              new OtaEvent(OtaStatus.DOWNLOADING, value),
            ),
          );
        });

      if (res.info().status !== 200) {
        this.emitState(
          new AppUpdateStatus(
            AppUpdateState.error,
            new OtaEvent(
              OtaStatus.DOWNLOAD_ERROR,
              `Download failed ${res.info().status}`,
            ),
            `Download failed ${res.info().status}`,
          ),
        );
        return;
      }
    } catch (e: any) {
      const msg = String(e?.message || e);
      this.emitState(
        new AppUpdateStatus(
          AppUpdateState.error,
          new OtaEvent(OtaStatus.DOWNLOAD_ERROR, msg),
          msg,
        ),
      );
      try {
        if (await RNFetchBlob.fs.exists(apkPath))
          await RNFetchBlob.fs.unlink(apkPath);
      } catch {}
      return;
    }

    try {
      this.emitState(
        new AppUpdateStatus(
          AppUpdateState.inProgress,
          new OtaEvent(OtaStatus.INSTALLING, 'Installing...'),
        ),
      );

      await ApkInstaller.install(apkPath);

      this.emitState(
        new AppUpdateStatus(
          AppUpdateState.inProgress,
          new OtaEvent(OtaStatus.INSTALLATION_DONE, ''),
        ),
      );
    } catch (e: any) {
      const msg = String(e?.message || e);
      const isPermissionError =
        msg.includes('REQUEST_INSTALL_PACKAGES') ||
        msg.toLowerCase().includes('unknown');

      if (isPermissionError) {
        Linking.openSettings();
        this.emitState(
          new AppUpdateStatus(
            AppUpdateState.error,
            new OtaEvent(
              OtaStatus.INSTALLATION_ERROR,
              'Please enable "Install unknown apps" and try again',
            ),
            'Please enable "Install unknown apps" and try again',
          ),
        );
      } else {
        this.emitState(
          new AppUpdateStatus(
            AppUpdateState.error,
            new OtaEvent(OtaStatus.INSTALLATION_ERROR, msg),
            msg,
          ),
        );
      }
      return;
    } finally {
      try {
        if (await RNFetchBlob.fs.exists(apkPath))
          await RNFetchBlob.fs.unlink(apkPath);
      } catch {}
    }
  }
}
