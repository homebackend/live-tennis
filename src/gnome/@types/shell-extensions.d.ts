declare module 'resource:///org/gnome/shell/extensions/extension.js' {
    export abstract class Extension {
        readonly uuid: string;
        readonly path: string;
        readonly metadata: any;
        getSettings(schemaId?: string): any;
        openPreferences(): void;
        enable(): void | Promise<void>;
        disable(): void | Promise<void>;
        constructor(metadata: any);
    }
}

declare module 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js' {
    export abstract class ExtensionPreferences {
        readonly uuid: string;
        readonly path: string;
        readonly metadata: any;
        getSettings(schemaId?: string): any;
        fillPreferencesWindow(window: any): any;
    }
}
