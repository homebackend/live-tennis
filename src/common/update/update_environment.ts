import { LinuxFamily } from "./platform";

export interface CurrentAppInfo {
  version: string;
  buildNumber: string;
}

export interface UpdateEnvironment {
  isUpdateCheckSupported(): boolean;
  getCurrentInfo(): Promise<CurrentAppInfo>;
  getTargetAssetName(baseAssetName: string, version: string): string;
  getLinuxFamily?(): LinuxFamily;
  fetchRemoteBuildNumber?(tag: string, userContentUrl: string): Promise<number>;
  findEscalator?(): Promise<string | null>;
  downloadFile?(
    url: string,
    tmpPath: string,
    onProgress: (pct: string) => void
  ): Promise<boolean>;
}
