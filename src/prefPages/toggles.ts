import Adw from "gi://Adw"
import GObject from "gi://GObject"
import Gio from "gi://Gio"
import { gettext as _ } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js"
import Config from "../config.js"
import type QstExtensionPreferences from "../prefs.js"
import {
	SwitchRow,
	Group,
	DropdownRow,
	fixPageScrollIssue,
} from "../libs/prefComponents.js"

export const TogglesPage = GObject.registerClass({
	GTypeName: Config.baseGTypeName+"TogglesPage",
}, class TogglesPage extends Adw.PreferencesPage {
	constructor(settings: Gio.Settings, _prefs: QstExtensionPreferences, window: Adw.PreferencesWindow) {
		super({
			name: "Toggles",
			title: _("Toggles"),
			iconName: "view-grid-symbolic",
		})
		fixPageScrollIssue(this)

		// DND Quick Toggle
		Group({
			parent: this,
			title: _("DND Quick Toggle"),
			description: _("Turn on to add the DND quick toggle on the Quick Settings panel"),
			headerSuffix: SwitchRow({
				settings,
				bind: "dnd-quick-toggle-enabled",
			}),
		}, [
			DropdownRow({
				settings,
				title: _("DND indicator position"),
				subtitle: _("Set DND indicator position"),
				bind: "dnd-quick-toggle-indicator-position",
				sensitiveBind: "dnd-quick-toggle-enabled",
				items: [
					{ name: _("System Tray"), value: "system-tray" },
					{ name: _("Date Menu Button"), value: "date-menu" },
				],
			})
		])

		// Unsafe Mode Toggle
		Group({
			parent: this,
			title: _("Unsafe Mode Quick Toggle"),
			description: _("Turn on to add the unsafe quick toggle on the Quick Settings panel"),
			headerSuffix: SwitchRow({
				settings,
				bind: "unsafe-quick-toggle-enabled",
			}),
		}, [
			SwitchRow({
				settings,
				title: _("Save last session state"),
				subtitle: _("Turn on to save last session unsafe state"),
				bind: "unsafe-quick-toggle-save-last-state",
				sensitiveBind: "unsafe-quick-toggle-enabled",
			}),
		])
	}
})
