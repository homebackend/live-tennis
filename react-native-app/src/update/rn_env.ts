import DeviceInfo from 'react-native-device-info';
import { Linking } from 'react-native';
import {
  UpdateEnvironment,
  CurrentAppInfo,
} from '@common/update/update_environment';

export class RNUpdateEnv implements UpdateEnvironment {
  isUpdateCheckSupported() {
    return true;
  }

  async getCurrentInfo(): Promise<CurrentAppInfo> {
    return {
      version: DeviceInfo.getVersion(),
      buildNumber: DeviceInfo.getBuildNumber(),
    };
  }

  getTargetAssetName(base: string, version: string): string {
    return `${base}-${version}-android-release.apk`;
  }

  async fetchRemoteBuildNumber(
    tag: string,
    userContentUrl: string,
  ): Promise<number> {
    const url = `${userContentUrl}/${tag}/react-native-app/android/app/build.gradle`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch build.gradle ${res.status}`);
    const text = await res.text();

    const codeMatch = text.match(/versionCode\s+(\d+)/);

    if (!codeMatch) throw new Error('versionCode not found in build.gradle');

    return parseInt(codeMatch[1], 10);
  }

  openDownloadUrl(url: string) {
    Linking.openURL(url);
  }
}
