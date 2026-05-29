// src/prefs.ts (Example)
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import GdkPixbuf from 'gi://GdkPixbuf';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { Countries } from '../common/countries';
import { prefs, PrefSchema, Schema, schema, SettingApplicability } from 'src/common/schema';

const CountryItem = GObject.registerClass({
    GTypeName: 'CountryItem',
    Properties: {
        'name': GObject.ParamSpec.string('name', 'name', 'Country Name', GObject.ParamFlags.READWRITE, null),
        'ioc': GObject.ParamSpec.string('ioc', 'ioc', 'IOC Code', GObject.ParamFlags.READWRITE, null),
        'flag': GObject.ParamSpec.object('flag', 'flag', 'Flag Pixbuf', GObject.ParamFlags.READWRITE, GdkPixbuf.Pixbuf),
        'selected': GObject.ParamSpec.boolean('selected', 'selected', 'Selection State', GObject.ParamFlags.READWRITE, false),
    },
}, class CountryItem extends GObject.Object { });

export default class LiveScorePreferences extends ExtensionPreferences {
    private _getKey(key: keyof Schema): string {
        return key.replaceAll("_", "-");
    }

    private _addCheckBoxSettingRow(key: keyof Schema, settings: Gio.Settings): Adw.PreferencesRow[] {
        const schemaItem = schema[key];
        const row = new Adw.ActionRow({
            title: schemaItem.summary,
            subtitle: schemaItem.description,
        });

        const checkButton = new Gtk.CheckButton({
            halign: Gtk.Align.CENTER, // Prevent horizontal expansion
            valign: Gtk.Align.CENTER, // Prevent vertical expansion
        });
        row.add_suffix(checkButton);

        settings.bind(this._getKey(key), checkButton, 'active', Gio.SettingsBindFlags.DEFAULT);

        if (schemaItem.dependent) {
            let rows: Adw.PreferencesRow[] = [row];
            schemaItem.dependent.map(d => this.getSetting(d, settings)).reduce((accumulator, current) => {
                accumulator.push(...current);
                return accumulator;
            }, rows);

            return rows;
        }

        return [row];
    }

    private _addIntBasedEntry(key: keyof Schema, settings: Gio.Settings): Adw.PreferencesRow[] {
        const schemaItem = schema[key];
        const entryRow = new Adw.EntryRow({
            title: schemaItem.summary,
            text: schemaItem.description,
        });
        entryRow.set_tooltip_text(schemaItem.description);

        const errorIcon = new Gtk.Image({
            icon_name: 'dialog-error-symbolic',
            visible: false,
        });
        entryRow.add_suffix(errorIcon);

        entryRow.connect('changed', () => {
            const text = entryRow.get_text();
            const value = parseInt(text, 10);

            if (!isNaN(value) && (!schemaItem.minimum || value >= schemaItem.minimum) && (!schemaItem.maximum || value <= schemaItem.maximum)) {
                settings.set_int(this._getKey(key), value);
                entryRow.remove_css_class('error-input');
                errorIcon.set_visible(false);
            } else {
                entryRow.add_css_class('error-input');
                errorIcon.set_visible(true);
            }
        });

        return [entryRow];
    }

    private _addSpinBoxSettingRow(key: keyof Schema, settings: Gio.Settings): Adw.PreferencesRow[] {
        const schemaItem = schema[key];

        const row = new Adw.ActionRow({
            title: schemaItem.summary,
            subtitle: schemaItem.description,
        });

        const spinner = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: schemaItem.minimum,
                upper: schemaItem.maximum,
                step_increment: schemaItem.increment
            }),
            valign: Gtk.Align.CENTER
        });
        row.add_suffix(spinner);
        row.activatable_widget = spinner;

        settings.bind(this._getKey(key), spinner, 'value', Gio.SettingsBindFlags.DEFAULT);

        return [row];
    }

    private _addMultiCountrySelection(key: keyof Schema, settings: Gio.Settings): Adw.PreferencesRow[] {
        const schemaItem = schema[key];
        const selectedCodes = new Set(settings.get_strv(this._getKey(key)));
        const model = new Gio.ListStore({ item_type: CountryItem.$gtype });

        // Populate the model
        Countries.forEach(country => {
            try {
                const flagPath = this.path + `/flags/${country.ioc.toLowerCase()}.svg`;
                const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(flagPath, 24, 18, true);
                const isSelected = selectedCodes.has(country.ioc);
                model.append(new CountryItem({ ...country, flag: pixbuf, selected: isSelected }));
            } catch (e) {
                console.error(`Failed to load flag for ${country.name}: ${e.message}`);
                const isSelected = selectedCodes.has(country.ioc);
                model.append(new CountryItem({ ...country, flag: null, selected: isSelected }));
            }
        });

        // Setup the list item factory
        const factory = new Gtk.SignalListItemFactory();
        factory.connect('setup', (f, listItem) => {
            const check = new Gtk.CheckButton({
                halign: Gtk.Align.END,
            });
            const box = new Gtk.Box({ spacing: 6, orientation: Gtk.Orientation.HORIZONTAL, homogeneous: false });
            const flagImage = new Gtk.Image();
            const label = new Gtk.Label({ xalign: 0, hexpand: true });
            box.append(check);
            box.append(flagImage);
            box.append(label);
            listItem.set_child(box);
        });
        factory.connect('bind', (f, listItem) => {
            const countryItem = listItem.get_item();
            const box = listItem.get_child();
            const check = box.get_first_child();
            const flagImage = check.get_next_sibling();
            const label = flagImage.get_next_sibling();

            check.set_active(countryItem.selected);
            check.connect('toggled', () => {
                countryItem.selected = check.get_active();
                const selectedCodes = [];
                for (let i = 0; i < model.get_n_items(); i++) {
                    const item = model.get_item(i);
                    if (item.selected) {
                        selectedCodes.push(item.ioc);
                    }
                }
                settings.set_strv(this._getKey(key), selectedCodes);
            });

            if (countryItem.flag) {
                flagImage.set_from_pixbuf(countryItem.flag);
            }
            label.set_text(countryItem.name);
        });

        const listView = new Gtk.ListView({
            model: Gtk.NoSelection.new(model), // Use NoSelection since we handle it manually
            factory: factory,
        });

        // Add the list to a scrollable window
        const scrollView = new Gtk.ScrolledWindow({
            height_request: 300,
            hexpand: true,
            vexpand: true,
        });
        scrollView.set_child(listView);

        const row = new Adw.ActionRow({
            title: schemaItem.summary,
            subtitle: schemaItem.description,
        });
        row.add_suffix(scrollView);

        return [row];
    }

    private _addCommaSeparatedListEntry(key: keyof Schema, settings: Gio.Settings): Adw.PreferencesRow[] {
        const schemaItem = schema[key];

        const currentValues = settings.get_strv(this._getKey(key)).join(', ');

        const entryRow = new Adw.EntryRow({
            title: schemaItem.summary,
            text: currentValues,
        });
        entryRow.set_tooltip_text(schemaItem.description);

        const errorIcon = new Gtk.Image({
            icon_name: 'dialog-error-symbolic',
            visible: false,
        });
        entryRow.add_suffix(errorIcon);

        const regex = /^([a-zA-Z]+(,\s*[a-zA-Z]+)*)?$/;

        entryRow.connect('changed', () => {
            const text = entryRow.get_text();

            if (text === '' || regex.test(text.trim())) {
                const names = text.split(',').map(s => s.trim()).filter(Boolean);
                settings.set_strv(this._getKey(key), names);
                entryRow.remove_css_class('error-input');
                errorIcon.set_visible(false);
            } else {
                entryRow.add_css_class('error-input');
                errorIcon.set_visible(true);
            }
        });

        return [entryRow];
    }

    getSetting(property: keyof Schema, settings: Gio.Settings): Adw.PreferencesRow[] {
        const item = schema[property];

        switch (item.type) {
            case 'boolean':
                return this._addCheckBoxSettingRow(property, settings);
            case 'number':
                if (item.increment) {
                    return this._addSpinBoxSettingRow(property, settings);
                }
                return this._addIntBasedEntry(property, settings);
            case 'array':
                if (!item.items || (item.items.type === 'string' && (!item.items.enum || item.items.enum !== 'country'))) {
                    return this._addCommaSeparatedListEntry(property, settings);
                } else {
                    return this._addMultiCountrySelection(property, settings);
                }
        }
    }

    getGroup(pref: PrefSchema, settings: Gio.Settings): Adw.PreferencesGroup {
        const group = new Adw.PreferencesGroup({
            title: pref.title,
            description: pref.description,
        });

        pref.properties.filter(pname => {
            const property = schema[pname];
            return !property.applicability || property.applicability.includes(SettingApplicability.GnomeShellExtension);
        }).map(p => this.getSetting(p, settings)).reduce((accumulator, current) => {
            current.forEach(c => accumulator.add(c));
            return accumulator;
        }, group)

        return group;
    }

    fillPreferencesWindow(window: Adw.PreferencesWindow) {
        const settings: Gio.Settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        window.add(page);

        prefs.map(p => this.getGroup(p, settings)).reduce((accumulator, current) => {
            accumulator.add(current);
            return accumulator;
        }, page);
    }
}
