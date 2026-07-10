import { Cubit } from './cubit';
import { AppUpdateState, AppUpdateStatus } from './types';
import { UpdateEnvironment } from './update_environment';

export abstract class AppUpdateCubit extends Cubit<AppUpdateStatus> {
  constructor(
    protected upgradeFileName: string,
    protected env: UpdateEnvironment
  ) {
    super(new AppUpdateStatus(AppUpdateState.userInput));
  }

  skipUpdate() {
    this.emitState(new AppUpdateStatus(AppUpdateState.skipped));
  }

  abstract tryUpdate(downloadUrl: string): Promise<void>;
}
