import { UpdateEnvironment } from 'src/common/update/update_environment';

export class GnomeNoopEnv implements UpdateEnvironment {
  isUpdateCheckSupported() {
    return false;
  }

  async getCurrentInfo() {
    return { version: '0.0.0', buildNumber: '0' };
  }

  getTargetAssetName() {
    return '';
  }

  openDownloadUrl() {}
}
