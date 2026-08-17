// src/extension.ts

import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { FloatingScoreWindow } from './floating_window';
import { TennisMatch } from '../common/types';
import { MenuHandler, GnomeRunner } from './runner';
import { Settings } from '../common/settings';
import { GnomeSettings } from './settings';
import { LiveViewManager, LiveViewUpdater } from '../common/live_view_updater';
import { GnomeApiHandler } from './api';
import { GCheckedMenuItem } from './menuItem';
import { StyleKeys } from '../common/style_keys';
import { GnomeTTFetcher } from './fetcher';
import { GnomeUpdateEnvironment } from './autoupgrade/gnome_env';
import {
  AppInitializationCubit,
  AppInitializationState,
  AppInitializationStatus,
} from '@homebackend/ts-common';
import { baseAssetName, organization, repo } from '../common/update/constants';

const ICON_SIZE = 22;

let _activeFloatingWindows: FloatingScoreWindow[] = [];
let _dataFetchTimeout: number | null = null;
let _matchCycleTimeout: number | null = null;

class LiveScoreButton extends PanelMenu.Button implements MenuHandler {
  private _log: (logs: string[]) => void;
  private _settings: Settings;
  private _extensionPath: string;
  private _uuid: string;
  private _statusLable?: St.Label;
  public runner: GnomeRunner;
  private _menu: PopupMenu.PopupMenu;

  constructor(
    log: (logs: string[]) => void,
    settings: Settings,
    extensionPath: string,
    uuid: string
  ) {
    super(0.0, 'Live Score Tracker', false);
    this._log = log;
    this._settings = settings;
    this._extensionPath = extensionPath;
    this._uuid = uuid;
    this.runner = new GnomeRunner(this, log, this._settings, extensionPath);
    this._menu = this.menu as PopupMenu.PopupMenu;
  }

  async setupBaseMenu(iconPath: string): Promise<void> {
    const gicon = Gio.icon_new_for_string(iconPath);

    this.add_child(
      new St.Icon({
        gicon: gicon,
        style_class: `${StyleKeys.GnomeSystemStatusIcon} ${StyleKeys.GnomePanelButton}`,
        icon_size: ICON_SIZE,
      })
    );
  }

  triggerFetch() {
    this.emit('manual-refresh');
  }

  uuid(): string {
    return this._uuid;
  }

  addEventMenuItem(
    menuItem: PopupMenu.PopupSubMenuMenuItem,
    position: number
  ): void {
    this._menu.addMenuItem(menuItem, position);
  }

  addMenuSeparator(): void {
    this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
  }

  addItemToMenu(item: typeof GCheckedMenuItem): void {
    this._menu.addMenuItem(item);
  }

  addRefreshMenuItem(): St.Label {
    const refreshItem = new PopupMenu.PopupMenuItem('', { reactive: true });
    refreshItem.connect('activate', () => {
      this.emit('manual-refresh');
    });
    const refreshLabel = new St.Label({
      style_class: StyleKeys.MainMenuRefreshLabel,
    });
    refreshLabel.clutter_text.set_markup(
      `Last Refresh: <span weight='bold'>Never</span>`
    );
    refreshItem.actor.add_child(refreshLabel);
    this._menu.addMenuItem(refreshItem);

    return refreshLabel;
  }

  addDataFetchStatusContainer(): void {
    const statusItem = new PopupMenu.PopupMenuItem('', { reactive: true });
    statusItem.connect('activate', () => {
      this.emit('manual-refresh');
    });
    const statusLabel = new St.Label({
      style_class: StyleKeys.MainMenuRefreshLabel,
    });
    statusLabel.clutter_text.set_markup('⌛');
    statusItem.actor.add_child(statusLabel);
    this._menu.addMenuItem(statusItem);
    this._statusLable = statusLabel;
  }

  updateFetchStatusText(statusText: string): void {
    if (this._statusLable) {
      this._statusLable.clutter_text.set_markup(statusText);
    }
  }

  addSettingsItem(): void {
    const settingsItem = new PopupMenu.PopupMenuItem('Settings');
    settingsItem.connect('activate', () => this.emit('open-prefs'));
    this._menu.addMenuItem(settingsItem);
  }

  destroy(): void {
    super.destroy();
    this.runner.destroy();
  }
}

const GObjectLiveScoreButton = GObject.registerClass(
  {
    Signals: { 'open-prefs': {}, 'manual-refresh': {} },
  },
  LiveScoreButton
) as unknown as new (
  log: (logs: string[]) => void,
  settings: Settings,
  extensionPath: string,
  uuid: string
) => LiveScoreButton;

export default class LiveScoreExtension
  extends Extension
  implements LiveViewManager
{
  private _panelButton?: LiveScoreButton;
  private _panelButtonHandlerIds: number[] = [];
  private _settings?: GnomeSettings;
  private _updater?: LiveViewUpdater<GnomeTTFetcher>;

  private _updateEnv?: GnomeUpdateEnvironment;
  private _initializationCubit?: AppInitializationCubit;
  private _autoupdateTimer?: number;
  private _source: MessageTray.Source | null = null;
  private _notification: MessageTray.Notification | null = null;
  private _notificationDestroyId: number = 0;

  constructor(metadata: any) {
    super(metadata);
  }

  setFetchTimer(interval: number, fetcher: () => void): void {
    if (_dataFetchTimeout) {
      GLib.source_remove(_dataFetchTimeout);
    }
    _dataFetchTimeout = GLib.timeout_add_seconds(
      GLib.PRIORITY_DEFAULT,
      interval,
      () => {
        fetcher();
        return GLib.SOURCE_CONTINUE;
      }
    );
  }

  unsetFetchTimer(): void {
    if (_dataFetchTimeout) {
      GLib.source_remove(_dataFetchTimeout);
      _dataFetchTimeout = null;
    }
  }

  destroyLiveView() {
    _activeFloatingWindows.forEach((w) => w.destroy());
    _activeFloatingWindows = [];
  }

  hideLiveViews(): void {
    _activeFloatingWindows.forEach((w) => w.hide());
  }

  getLiveViewCount(): number {
    return _activeFloatingWindows.length;
  }

  private async _addLiveViewWindows(numWindows: number): Promise<void> {
    while (_activeFloatingWindows.length < numWindows) {
      _activeFloatingWindows.push(
        new FloatingScoreWindow(
          _activeFloatingWindows.length,
          this.path,
          this.uuid,
          this._log.bind(this),
          this._settings!
        )
      );
    }

    return new Promise((resolve) => setTimeout(resolve, 1000));
  }

  async setLiveViewCount(numWindows: number): Promise<void> {
    if (_activeFloatingWindows.length < numWindows) {
      await this._addLiveViewWindows(numWindows);
    } else {
      while (_activeFloatingWindows.length > numWindows) {
        _activeFloatingWindows.pop()?.destroy();
      }
    }
  }

  updateLiveViewContent(window: number, match: TennisMatch): void {
    _activeFloatingWindows[window].updateContent(match);
  }

  setLiveViewContentsEmpty(window: number): void {
    for (let i = window; i < _activeFloatingWindows.length; i++) {
      _activeFloatingWindows[i].updateContent(undefined);
    }
  }

  setCycleTimeout(interval: number, cycler: () => Promise<boolean>): void {
    this.destroyCycleTimeout();

    _matchCycleTimeout = GLib.timeout_add_seconds(
      GLib.PRIORITY_DEFAULT,
      interval,
      () => {
        cycler()
          .then((shouldStop) => {
            if (shouldStop) {
              this.destroyCycleTimeout();
            }
          })
          .catch((e) => this._log(['cycle error', String(e)]));
        return GLib.SOURCE_CONTINUE;
      }
    );
  }

  destroyCycleTimeout(): void {
    if (_matchCycleTimeout) {
      GLib.source_remove(_matchCycleTimeout);
      _matchCycleTimeout = null;
    }
  }

  removeCycleTimeout(): boolean {
    return GLib.SOURCE_REMOVE;
  }

  continueCycleTimeout(): boolean {
    return GLib.SOURCE_CONTINUE;
  }

  private _log(logs: string[]) {
    if (this._settings?.getBoolean('enable-debug-logging')) {
      console.log('[Live Tennis]', logs.join(', '));
    }
  }

  private _recreateUI() {
    this.destroyLiveView();
    this._updater!.updateUI();
  }

  private _autoupdateInit() {
    this._updateEnv = new GnomeUpdateEnvironment(this.metadata);
    this._initializationCubit = new AppInitializationCubit(
      organization,
      repo,
      baseAssetName,
      this._updateEnv,
      (m) => console.log(...m)
    );
    this._initializationCubit.on('state', async (s) => {
      if (s.state === AppInitializationState.showUpdateDetails) {
        const skipped = await this._settings!.getStrv(
          'skipped-update-versions'
        );
        if (!s.latestVersion || skipped.includes(s.latestVersion)) return;
        this._showNotification(s);
      }
    });

    this._checkNow();
    this._autoupdateTimer = GLib.timeout_add_seconds(
      GLib.PRIORITY_DEFAULT,
      6 * 3600,
      () => {
        this._checkNow();
        return GLib.SOURCE_CONTINUE;
      }
    );
  }

  private _checkNow() {
    this._initializationCubit!.checkUpdateRequired();
  }

  private _showNotification(s: AppInitializationStatus) {
    this._source = new MessageTray.Source({ title: 'My Extension' });
    Main.messageTray.add(this._source);

    this._notification = new MessageTray.Notification({
      source: this._source,
      title: `Update ${s.latestVersion} available`,
      body: 'Changelog in preferences',
      isTransient: false,
    });

    this._notification.addAction('View Update', () => {
      this._settings!.setBoolean('force-update-check', true);
      this.openPreferences();
      this._source?.destroy(
        MessageTray.NotificationDestroyedReason.SOURCE_CLOSED
      );
    });

    this._notification.addAction('Dismiss', () => {
      this._settings!.setBoolean('force-update-check', false);
      this._settings!.setStrv('skipped-update-versions', [
        s.latestVersion ?? '',
      ]);
      this._source?.destroy(MessageTray.NotificationDestroyedReason.DISMISSED);
    });

    this._notificationDestroyId = this._notification.connect('destroy', () => {
      this._settings!.setBoolean('force-update-check', false);
      this._notification = null;
      this._notificationDestroyId = 0;
    });

    this._source.addNotification(this._notification);
  }

  enable() {
    const settings = this.getSettings();
    this._settings = new GnomeSettings(settings);
    this._panelButton = new GObjectLiveScoreButton(
      this._log.bind(this),
      this._settings,
      this.path,
      this.uuid
    );
    const apiHandler = new GnomeApiHandler(this._log.bind(this));
    this._updater = new LiveViewUpdater(
      this._panelButton.runner,
      this,
      apiHandler,
      this._settings!,
      this._log.bind(this),
      GnomeTTFetcher
    );

    this._autoupdateInit();

    const opId = this._panelButton.connect('open-prefs', () =>
      this.openPreferences()
    );
    const mrId = this._panelButton.connect('manual-refresh', () =>
      this._updater!.fetchMatchData()
    );
    this._panelButtonHandlerIds.push(opId);
    this._panelButtonHandlerIds.push(mrId);

    [
      'enabled',
      'num-windows',
      'selected-matches',
      'auto-view-new-matches',
      'match-display-duration',
      'enable-atp',
      'enable-wta',
      'enable-atp-challenger',
      'enable-tennis-temple',
      'auto-hide-no-live-matches',
    ].forEach((k) =>
      settings.connect(`changed::${k}`, () => this._updater!.updateUI())
    );
    ['live-window-size-x', 'live-window-size-y'].forEach((k) =>
      settings.connect(`changed::${k}`, () => this._recreateUI())
    );

    Main.panel.addToStatusArea(this.uuid, this._panelButton);
  }

  disable() {
    if (this._notification && this._notificationDestroyId) {
      this._notification.disconnect(this._notificationDestroyId);
      this._notificationDestroyId = 0;
    }
    if (this._source) {
      this._source.destroy(
        MessageTray.NotificationDestroyedReason.SOURCE_CLOSED
      );
      this._source = null;
    }
    this._notification = null;

    if (_dataFetchTimeout) GLib.source_remove(_dataFetchTimeout);
    if (this._autoupdateTimer) GLib.source_remove(this._autoupdateTimer);

    this._updater?.disable();
    this.destroyCycleTimeout();
    this.destroyLiveView();

    if (this._panelButton) {
      this._panelButtonHandlerIds.forEach((handlerId) =>
        this._panelButton!.disconnect(handlerId)
      );
    }
    this._panelButton?.destroy();
    this._panelButton = undefined;
    this._settings = undefined;
    this._updater = undefined;
  }
}
