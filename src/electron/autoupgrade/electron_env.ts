import fs from 'fs';
import { app, shell } from 'electron';
import {
  CurrentAppInfo,
  UpdateEnvironment,
} from '../../common/update/update_environment';
import { LinuxFamily } from 'src/common/update/platform';
import { execFile } from 'node:child_process';

export class ElectronUpdateEnv implements UpdateEnvironment {
  isUpdateCheckSupported() {
    return true;
  }

  async getCurrentInfo(): Promise<CurrentAppInfo> {
    return {
      version: app.getVersion(),
      buildNumber: process.env.BUILD_NUMBER || '0',
    };
  }

  getTargetAssetName(base: string, version: string): string {
    if (process.platform === 'win32') return `${base}-${version}-win-x64.exe`;
    if (process.platform === 'linux') {
      const family = this.getLinuxFamily();
      if (family === 'arch') return `${base}-${version}-linux-x64.pacman`;
      if (family === 'debian') return `${base}-${version}-amd64.deb`;
      return `${base}-${version}-x86_64.AppImage `;
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

  async findEscalator(): Promise<string | null> {
    for (const c of ['pkexec', 'sudo', 'doas']) {
      try {
        execFile('which', [c]);
        return c;
      } catch {}
    }
    return null;
  }

  openDownloadUrl(url: string) {
    shell.openExternal(url);
  }
}
