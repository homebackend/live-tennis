import fs from 'fs';
import { app, shell } from 'electron';
import {
  CurrentAppInfo,
  UpdateEnvironment,
} from '../../common/update/update_environment';
import { LinuxFamily } from 'src/common/update/platform';

export class ElectronUpdateEnv implements UpdateEnvironment {
  isUpdateCheckSupported() {
    return true;
  }

  async getCurrentInfo(): Promise<CurrentAppInfo> {
    return {
      version: app.getVersion(),
      buildNumber: process.env.BUILD_NUMBER || '0'
    };
  }

  getTargetAssetName(base: string): string {
    if (process.platform === 'win32') return `${base}-windows-x64.zip`;
    if (process.platform === 'linux') {
      const family = this.getLinuxFamily();
      if (family === 'arch') return `${base}-linux-x64.pkg.tar.zst`;
      if (family === 'debian') return `${base}-linux-x64.deb`;
      return `${base}-linux-x64.tar.gz`;
    }
    return '';
  }

  getLinuxFamily(): LinuxFamily {
    try {
      const f = fs.readFileSync('/etc/os-release', 'utf8').toLowerCase();
      if (f.includes('arch')) return 'arch';
      if (f.includes('debian') || f.includes('ubuntu')) return 'debian';
    } catch {}
    return 'unknown';
  }

  openDownloadUrl(url: string) {
    shell.openExternal(url);
  }
}
