import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup?version=3.0';

import {
  CurrentAppInfo,
  getLinuxDistributionFamily,
  UpdateEnvironment,
} from '@homebackend/ts-common';

declare const __VERSION__: string;

export class GnomeUpdateEnvironment implements UpdateEnvironment {
  constructor(private meta: any) {}

  isUpdateCheckSupported(): boolean {
    return true;
  }

  async getCurrentInfo(): Promise<CurrentAppInfo> {
    const v = String(this.meta.version ?? '0');
    return { version: __VERSION__, buildNumber: v };
  }

  getTargetAssetName(baseAssetName: string, version: string): string {
    return `${baseAssetName}-gnome-extension.zip`;
  }

  getLinuxFamily() {
    return getLinuxDistributionFamily();
  }

  async downloadFile(
    url: string,
    tmpPath: string,
    onProgress: (pct: string) => void
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const session = new Soup.Session();
      const message = Soup.Message.new('GET', url);

      session.send_async(message, GLib.PRIORITY_DEFAULT, null, (sess, res) => {
        try {
          const input = sess!.send_finish(res) as Gio.InputStream;
          const total = parseInt(
            message.response_headers.get_one('content-length') || '0',
            10
          );
          let downloaded = 0;

          const destFile = Gio.File.new_for_path(tmpPath);
          const output = destFile.replace(
            null,
            false,
            Gio.FileCreateFlags.REPLACE_DESTINATION,
            null
          ) as Gio.OutputStream;

          const chunkSize = 64 * 1024;

          const readNext = () => {
            input.read_bytes_async(
              chunkSize,
              GLib.PRIORITY_DEFAULT,
              null,
              (inp, r) => {
                try {
                  const bytes = inp!.read_bytes_finish(r) as GLib.Bytes;
                  if (bytes.get_size() === 0) {
                    output.close(null);
                    input.close(null);
                    onProgress('100');
                    resolve(true);
                    return;
                  }

                  output.write_bytes(bytes, null);
                  downloaded += bytes.get_size();

                  if (total > 0) {
                    onProgress(String(Math.floor((downloaded / total) * 100)));
                  } else {
                    onProgress(String(downloaded));
                  }

                  readNext();
                } catch (e) {
                  try {
                    output.close(null);
                    input.close(null);
                  } catch {}
                  reject(e);
                }
              }
            );
          };

          readNext();
        } catch (e) {
          reject(e);
        }
      });
    });
  }
}
