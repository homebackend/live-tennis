import { Cubit } from './cubit';
import { AppInitializationState, AppInitializationStatus } from './types';
import { UpdateEnvironment } from './update_environment';
import * as semver from 'semver';

export class AppInitializationCubit extends Cubit<AppInitializationStatus> {
  private baseGitHubUrl: string;
  private userContentUrl: string;
  private headers = { Accept: 'application/vnd.github.v3+json' };
  private baseAssetName: string;
  private env: UpdateEnvironment;
  private log: (logs: string[]) => void;

  constructor(
    organization: string,
    repo: string,
    baseAssetName: string,
    env: UpdateEnvironment,
    log: (logs: string[]) => void
  ) {
    super(new AppInitializationStatus(AppInitializationState.initialization));
    this.baseGitHubUrl = `https://api.github.com/repos/${organization}/${repo}`;
    this.userContentUrl = `https://raw.githubusercontent.com/${organization}/${repo}`;
    this.baseAssetName = baseAssetName;
    this.env = env;
    this.log = log;
  }

  async initialize() {
    this.emitState(
      new AppInitializationStatus(AppInitializationState.initialization)
    );
    if (!this.env.isUpdateCheckSupported()) {
      this.log(['Update check not supported on this platform']);
      this.emitInitialized();
      return;
    }
    await this.checkUpdateRequired();
  }

  private emitInitialized() {
    this.emitState(
      new AppInitializationStatus(AppInitializationState.initialized)
    );
  }

  async checkUpdateRequired() {
    try {
      const current = await this.env.getCurrentInfo();
      const releases = await this._fetchReleases();
      if (!Array.isArray(releases)) {
        this.emitState(
          new AppInitializationStatus(
            AppInitializationState.updateCheckFailed,
            undefined,
            undefined,
            undefined,
            undefined,
            releases.message
          )
        );
        return;
      }

      if (!releases.length) {
        this.log(['No releases are available']);
        this.emitInitialized();
        return;
      }

      const latest = releases[0];
      const rawTag = latest.tag_name as string;
      const latestVersion =
        semver.coerce(rawTag)?.version || rawTag.replace(/^v/, '');
      const currentVersion =
        semver.coerce(current.version)?.version || current.version;

      let isUpdateAvailable = false;

      if (this.env.getLinuxFamily) {
        isUpdateAvailable = semver.lt(currentVersion, latestVersion);
      } else if (this.env.fetchRemoteBuildNumber) {
        if (semver.gt(latestVersion, currentVersion)) {
          const remoteCode = await this.env.fetchRemoteBuildNumber(
            rawTag,
            this.userContentUrl
          );
          isUpdateAvailable = parseInt(current.buildNumber, 10) < remoteCode;
        }
      }

      if (!isUpdateAvailable) {
        this.log([
          'No new update is available',
          currentVersion,
          '==',
          latestVersion,
        ]);
        this.emitInitialized();
        return;
      }

      const [changelog, downloadUrl] = await Promise.all([
        this._generateChangelog(`v${current.version}`, rawTag),
        this._resolveDownloadUrl(latest, this.baseGitHubUrl),
      ]);

      this.emitState(
        new AppInitializationStatus(
          AppInitializationState.showUpdateDetails,
          `${this.baseGitHubUrl}/releases`,
          downloadUrl,
          rawTag,
          changelog
        )
      );
    } catch (e: any) {
      this.emitState(
        new AppInitializationStatus(
          AppInitializationState.updateCheckFailed,
          undefined,
          undefined,
          undefined,
          undefined,
          String(e)
        )
      );
    }
  }

  private async _fetchReleases(): Promise<any[] | { message?: string }> {
    const r = await fetch(`${this.baseGitHubUrl}/releases?per_page=10`, {
      headers: this.headers as any,
    });
    if (!r.ok) throw new Error(`GitHub ${r.status}`);
    return r.json();
  }

  private async _resolveDownloadUrl(release: any, fallback: string) {
    const assetsUrl = release.assets_url;
    if (!assetsUrl) return fallback;
    try {
      const r = await fetch(assetsUrl, { headers: this.headers as any });
      if (!r.ok) return fallback;
      const assets = await r.json();
      const target = this.env.getTargetAssetName(
        this.baseAssetName,
        release.tag_name.replace(/^v/, '')
      );
      const hit = assets.find((a: any) => a.name === target);
      return hit?.browser_download_url || fallback;
    } catch {
      return fallback;
    }
  }

  private async _generateChangelog(baseTag: string, headTag: string) {
    try {
      const r = await fetch(
        `${this.baseGitHubUrl}/compare/${baseTag}...${headTag}`,
        { headers: this.headers as any }
      );
      if (!r.ok) return '### Updates Available\n* Changelog unretrievable';
      const data = await r.json();
      const commits = data.commits || [];
      let md = `### Changes since ${baseTag}:\n\n`;
      if (!commits.length) md += '* No commits';
      else
        for (const c of [...commits].reverse()) {
          const title = (c.commit?.message || '').split('\n')[0].trim();
          const author = c.commit?.author?.name || 'Anonymous';
          if (title) md += `* ${title} (by ${author})\n`;
        }
      return md.trim();
    } catch {
      return '### Updates Available\n* Failed generating changelog';
    }
  }
}
