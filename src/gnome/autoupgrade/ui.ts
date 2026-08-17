import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import {
  AppInitializationStatus,
  AppUpdateState,
  AppUpdateStatus,
  OtaStatus,
} from '@homebackend/ts-common';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

export function createLoadPage() {
  const loadPage = new Adw.PreferencesPage();
  const group = new Adw.PreferencesGroup();
  const box = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 12,
    halign: Gtk.Align.CENTER,
    valign: Gtk.Align.CENTER,
    vexpand: true,
  });
  const spinner = new Gtk.Spinner({
    spinning: true,
    halign: Gtk.Align.CENTER,
    valign: Gtk.Align.CENTER,
    width_request: 48,
    height_request: 48,
  });
  const label = new Gtk.Label({
    label: 'Checking for updates...',
    css_classes: ['dim-label'],
  });
  box.append(spinner);
  box.append(label);
  group.add(box);
  loadPage.add(group);

  return loadPage;
}

export function createAskUserPage(
  status: AppInitializationStatus,
  onProceed?: () => void,
  onDismiss?: () => void
) {
  const page = new Adw.PreferencesPage({
    title: 'Update',
    icon_name: 'software-update-available-symbolic',
  });

  const headerGroup = new Adw.PreferencesGroup({
    title: 'New Update Available',
  });
  page.add(headerGroup);

  const versionRow = new Adw.ActionRow({
    title: 'Latest Version',
    subtitle: status.latestVersion ?? 'Unknown',
  });
  headerGroup.add(versionRow);

  if (status.downloadUrl) {
    const linkRow = new Adw.ActionRow({
      title: 'Package Link',
      subtitle: status.downloadUrl,
      subtitle_selectable: true,
    });
    const copyBtn = new Gtk.Button({
      icon_name: 'edit-copy-symbolic',
      valign: Gtk.Align.CENTER,
      css_classes: ['flat'],
    });
    copyBtn.connect('clicked', () => {
      Gdk.Display.get_default()?.get_clipboard().set(status.downloadUrl);
    });
    linkRow.add_suffix(copyBtn);
    linkRow.add_suffix(new Gtk.Image({ icon_name: 'go-next-symbolic' }));
    headerGroup.add(linkRow);
  }

  const logGroup = new Adw.PreferencesGroup({
    title: 'Changelog / Commits',
  });
  page.add(logGroup);

  const scrolled = new Gtk.ScrolledWindow({
    min_content_height: 200,
    max_content_height: 300,
    hscrollbar_policy: Gtk.PolicyType.NEVER,
  });
  scrolled.add_css_class('card');

  const textView = new Gtk.TextView({
    editable: false,
    wrap_mode: Gtk.WrapMode.WORD_CHAR,
    left_margin: 12,
    right_margin: 12,
    top_margin: 12,
    bottom_margin: 12,
    monospace: true,
  });
  textView.buffer.text =
    status.changeLog || 'No direct commit information provided.';
  scrolled.set_child(textView);

  const logRow = new Adw.PreferencesRow();
  logRow.set_child(scrolled);
  logGroup.add(logRow);

  const actionGroup = new Adw.PreferencesGroup();
  page.add(actionGroup);

  const btnBox = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 12,
    halign: Gtk.Align.END,
    margin_top: 8,
  });

  const dismissBtn = new Gtk.Button({ label: 'Dismiss' });
  dismissBtn.connect('clicked', () => onDismiss?.());

  const proceedBtn = new Gtk.Button({
    label: onProceed ? 'Install Update' : 'OK',
    css_classes: ['suggested-action'],
  });
  proceedBtn.connect('clicked', () => onProceed?.());

  btnBox.append(dismissBtn);
  btnBox.append(proceedBtn);
  actionGroup.add(btnBox);

  return page;
}

export function createErrorPage(
  message?: string,
  onRetry?: () => void,
  onDismiss?: () => void
) {
  const page = new Adw.PreferencesPage({
    title: 'Error',
    icon_name: 'dialog-error-symbolic',
  });

  const status = new Adw.StatusPage({
    icon_name: 'dialog-error-symbolic',
    title: 'Update Failed',
    description: message ?? 'Could not check for updates.',
    vexpand: true,
  });
  status.add_css_class('compact');

  const btnBox = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 12,
    halign: Gtk.Align.CENTER,
    margin_top: 24,
  });

  const continueBtn = new Gtk.Button({ label: 'Continue' });
  continueBtn.connect('clicked', () => onDismiss?.());

  btnBox.append(continueBtn);

  if (onRetry) {
    const retryBtn = new Gtk.Button({
      label: 'Retry',
      css_classes: ['destructive-action'],
    });
    retryBtn.connect('clicked', () => onRetry());
    btnBox.append(retryBtn);
  }

  status.set_child(btnBox);

  const group = new Adw.PreferencesGroup();
  const row = new Adw.PreferencesRow();
  row.set_child(status);
  group.add(row);

  page.add(group);
  return page;
}

export function createUpdatePage(
  updateCubit: any,
  onBack: () => void,
  onError: (e: string) => void
) {
  const page = new Adw.PreferencesPage({
    title: 'Updating',
    icon_name: 'software-update-available-symbolic',
  });

  const group = new Adw.PreferencesGroup();
  page.add(group);

  const box = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 16,
    halign: Gtk.Align.CENTER,
    valign: Gtk.Align.CENTER,
    vexpand: true,
    margin_top: 48,
  });

  const spinner = new Gtk.Spinner({
    spinning: true,
    width_request: 48,
    height_request: 48,
  });

  const label = new Gtk.Label({
    label: `Update in progress: ${updateCubit.state?.event?.status ?? ''} ${updateCubit.state?.event?.value ?? ''}`,
    css_classes: ['title-3'],
  });

  const progress = new Gtk.ProgressBar({
    show_text: true,
    width_request: 300,
  });

  box.append(spinner);
  box.append(label);
  box.append(progress);
  group.add(box);

  const sub = updateCubit.on('state', (s: AppUpdateStatus) => {
    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
      if (s.state === AppUpdateState.skipped) {
        onBack();
        return GLib.SOURCE_REMOVE;
      }
      if (s.state === AppUpdateState.error) {
        onError(s.error!);
        return GLib.SOURCE_REMOVE;
      }
      if (s.event?.status === OtaStatus.INSTALLATION_DONE) {
        onBack();
        return GLib.SOURCE_REMOVE;
      }

      label.set_label(
        `Update in progress: ${s.event?.status ?? ''} ${s.event?.value ?? ''}`
      );
      if (typeof s.event?.value === 'number') {
        progress.set_fraction(s.event.value / 100);
        progress.set_text(`${Math.round(s.event.value)}%`);
      } else {
        progress.pulse();
      }
      return GLib.SOURCE_REMOVE;
    });
  });

  page.connect('unrealize', () => {
    try {
      sub?.remove?.();
    } catch {}
    try {
      updateCubit.close();
    } catch {}
  });

  return page;
}

export function createPostInstallPage(later: () => void) {
  const page = new Adw.PreferencesPage({
    title: 'Update Installed',
    icon_name: 'software-update-urgent-symbolic',
  });

  const status = new Adw.StatusPage({
    title: 'Update Installed',
    description:
      'The extension was updated. You need to log out or reboot to activate the new version.',
    icon_name: 'system-reboot-symbolic',
    vexpand: true,
  });

  const box = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 12,
    halign: Gtk.Align.CENTER,
    css_classes: ['linked'],
  });

  const laterBtn = new Gtk.Button({
    label: 'Later',
  });

  const logoutBtn = new Gtk.Button({
    label: 'Log Out',
    css_classes: ['suggested-action'],
  });

  const rebootBtn = new Gtk.Button({
    label: 'Reboot',
    css_classes: ['destructive-action'],
  });

  logoutBtn.connect('clicked', () => {
    Gio.Subprocess.new(
      ['gnome-session-quit', '--logout'],
      Gio.SubprocessFlags.NONE
    );
  });

  rebootBtn.connect('clicked', () => {
    try {
      Gio.Subprocess.new(
        ['gnome-session-quit', '--reboot'],
        Gio.SubprocessFlags.NONE
      );
    } catch {
      Gio.Subprocess.new(['systemctl', 'reboot'], Gio.SubprocessFlags.NONE);
    }
  });

  laterBtn.connect('clicked', later);

  box.append(laterBtn);
  box.append(logoutBtn);
  box.append(rebootBtn);

  status.set_child(box);

  const group = new Adw.PreferencesGroup();
  group.add(status);
  page.add(group);

  return page;
}
