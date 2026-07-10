import { AppUpdateCubit } from 'src/common/update/app_update_cubit';
import {
  AppUpdateState,
  AppUpdateStatus,
  OtaEvent,
  OtaStatus,
} from 'src/common/update/types';
import * as fs from 'fs';
import * as os from 'os';
import path from 'path';
import { spawn } from 'child_process';

export class ElectronAppUpdateCubit extends AppUpdateCubit {
  async tryUpdate(downloadUrl: string): Promise<void> {
    if (process.platform === 'linux') {
      await this.tryLinuxUpdate(downloadUrl);
    } else {
      this.skipUpdate();
    }
  }

  async tryLinuxUpdate(url: string) {
    const tmpPath = path.join(os.tmpdir(), this.upgradeFileName);
    try {
      const ok = await this._download(url, tmpPath);
      if (!ok) return;
      const escalator = this.env.findEscalator
        ? await this.env.findEscalator()
        : null;
      if (!escalator) {
        this.emitState(
          new AppUpdateStatus(
            AppUpdateState.error,
            undefined,
            'No pkexec/sudo/doas'
          )
        );
        return;
      }

      const family = this.env.getLinuxFamily?.() || 'unknown';
      let cmd = escalator,
        args: string[] = [];
      if (family === 'arch')
        args = ['/usr/bin/pacman', '-U', '--noconfirm', tmpPath];
      else if (family === 'debian') args = ['/usr/bin/dpkg', '-i', tmpPath];
      else {
        this.emitState(
          new AppUpdateStatus(
            AppUpdateState.error,
            undefined,
            'Unsupported distro'
          )
        );
        return;
      }

      this.emitState(
        new AppUpdateStatus(
          AppUpdateState.inProgress,
          new OtaEvent(OtaStatus.INSTALLING, 'Installing (admin required)...')
        )
      );
      const proc = spawn(cmd, args, { stdio: 'pipe' });
      proc.stdout.on('data', (d) => console.log(d.toString()));
      const code: number = await new Promise((r) => proc.on('close', r as any));
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      if (code !== 0) {
        this.emitState(
          new AppUpdateStatus(
            AppUpdateState.error,
            undefined,
            `Installer exit ${code}`
          )
        );
        return;
      }

      this.emitState(
        new AppUpdateStatus(
          AppUpdateState.inProgress,
          new OtaEvent(OtaStatus.INSTALLING, 'Restarting...')
        )
      );
      await new Promise((r) => setTimeout(r, 500));
      spawn(process.execPath, [], { detached: true, stdio: 'ignore' }).unref();
      process.exit(0);
    } catch (e: any) {
      try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      } catch {}
      this.emitState(
        new AppUpdateStatus(AppUpdateState.error, undefined, String(e))
      );
    }
  }

  private async _download(url: string, tmp: string) {
    if (this.env.downloadFile)
      return this.env.downloadFile(url, tmp, (pct) => {
        this.emitState(
          new AppUpdateStatus(
            AppUpdateState.inProgress,
            new OtaEvent(OtaStatus.DOWNLOADING, pct)
          )
        );
      });

    const res = await fetch(url);
    if (!res.ok) {
      this.emitState(
        new AppUpdateStatus(
          AppUpdateState.error,
          undefined,
          `Download ${res.status}`
        )
      );
      return false;
    }
    const total = Number(res.headers.get('content-length') || 0);
    let rec = 0;
    const ws = fs.createWriteStream(tmp);
    const reader = (res.body as any).getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      rec += value.length;
      ws.write(value);
      const pct = total
        ? `${Math.floor((rec / total) * 100)}%`
        : `${(rec / 1024 / 1024).toFixed(1)} MB`;
      this.emitState(
        new AppUpdateStatus(
          AppUpdateState.inProgress,
          new OtaEvent(OtaStatus.DOWNLOADING, pct)
        )
      );
    }
    ws.close();
    return true;
  }
}
