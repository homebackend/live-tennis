import {
  AppUpdateCubit,
  AppUpdateState,
  AppUpdateStatus,
  OtaEvent,
  OtaStatus,
  UpdateEnvironment,
} from '@homebackend/ts-common';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

async function execCmd(
  argv: string[],
  log: (logs: string[]) => void
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  log(['Executing', ...argv]);

  const proc = Gio.Subprocess.new(
    argv,
    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
  );

  const [ok, stdout, stderr] = await new Promise<[boolean, string, string]>(
    (resolve, reject) => {
      proc.communicate_utf8_async(null, null, (p, res) => {
        try {
          resolve(p!.communicate_utf8_finish(res) as [boolean, string, string]);
        } catch (e) {
          reject(e);
        }
      });
    }
  );

  return { ok: ok, stdout, stderr };
}

export class GnomeExtensionUpdateCubit extends AppUpdateCubit {
  constructor(
    upgradeFileName: string,
    env: UpdateEnvironment,
    log: (logs: string[]) => void,
    private extensionUuid: string
  ) {
    super(upgradeFileName, env, log);
  }

  async tryUpdate(downloadUrl: string): Promise<void> {
    const tmpZip = GLib.build_filenamev([
      GLib.get_tmp_dir(),
      this.upgradeFileName,
    ]);

    try {
      this.emitState(
        new AppUpdateStatus(
          AppUpdateState.inProgress,
          new OtaEvent(OtaStatus.DOWNLOADING, '0')
        )
      );

      if (this.env.downloadFile) {
        await this.env.downloadFile(downloadUrl, tmpZip, (pct) => {
          this.emitState(
            new AppUpdateStatus(
              AppUpdateState.inProgress,
              new OtaEvent(OtaStatus.DOWNLOADING, pct)
            )
          );
        });
      }

      this.emitState(
        new AppUpdateStatus(
          AppUpdateState.inProgress,
          new OtaEvent(OtaStatus.INSTALLING, tmpZip)
        )
      );
      this.log([`Installing ${tmpZip}`]);

      await execCmd(
        ['gnome-extensions', 'disable', this.extensionUuid],
        this.log
      );

      const install = await execCmd(
        ['gnome-extensions', 'install', '--force', tmpZip],
        this.log
      );
      if (!install.ok) {
        throw new Error(
          install.stderr || install.stdout || 'gnome-extensions install failed'
        );
      }

      await execCmd(
        ['gnome-extensions', 'enable', this.extensionUuid],
        this.log
      );

      this.emitState(
        new AppUpdateStatus(
          AppUpdateState.inProgress,
          new OtaEvent(OtaStatus.INSTALLATION_DONE)
        )
      );

      try {
        this.log(['Deleting', tmpZip]);
        Gio.File.new_for_path(tmpZip).delete(null);
      } catch {}
    } catch (e: any) {
      this.log(['Error during update', String(e)]);
      this.emitState(
        new AppUpdateStatus(
          AppUpdateState.error,
          new OtaEvent(OtaStatus.INSTALLATION_ERROR, String(e)),
          String(e)
        )
      );
    }
  }
}
