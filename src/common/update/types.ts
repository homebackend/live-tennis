export enum AppInitializationState {
  initialization,
  updateApp,
  showUpdateDetails,
  initialized,
  updateCheckFailed,
}

export class AppInitializationStatus {
  constructor(
    public readonly state: AppInitializationState,
    public readonly baseUrl?: string,
    public readonly downloadUrl?: string,
    public readonly latestVersion?: string,
    public readonly changeLog?: string,
    public readonly error?: string
  ) {}
}

export enum AppUpdateState {
  userInput,
  inProgress,
  skipped,
  error,
}

export enum OtaStatus {
  DOWNLOADING = "DOWNLOADING",
  INSTALLING = "INSTALLING",
  INSTALLATION_DONE = "INSTALLATION_DONE",
  DOWNLOAD_ERROR = "DOWNLOAD_ERROR",
  INSTALLATION_ERROR = "INSTALLATION_ERROR",
  PERMISSION_NOT_GRANTED_ERROR = "PERMISSION_NOT_GRANTED_ERROR",
  ALREADY_RUNNING_ERROR = "ALREADY_RUNNING_ERROR",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  CHECKSUM_ERROR = "CHECKSUM_ERROR",
  CANCELED = "CANCELED",
}

export class OtaEvent {
  constructor(
    public readonly status: OtaStatus,
    public readonly value: string = ""
  ) {}
}

export class AppUpdateStatus {
  constructor(
    public readonly state: AppUpdateState,
    public readonly event?: OtaEvent,
    public readonly error?: string
  ) {}
}
