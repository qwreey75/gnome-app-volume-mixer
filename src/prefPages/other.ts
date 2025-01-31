import Adw from "gi://Adw"
import GObject from "gi://GObject"
import Gio from "gi://Gio"
import { gettext as _ } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js"
import Config from "../config.js"
import type QstExtensionPreferences from "../prefs.js"
import {
	Group,
	SwitchRow,
	DropdownRow,
	fixPageScrollIssue,
} from "../libs/prefComponents.js"

export const OtherPage = GObject.registerClass({
	GTypeName: Config.baseGTypeName+"OtherPage",
}, class OtherPage extends Adw.PreferencesPage {
	constructor(settings: Gio.Settings, _prefs: QstExtensionPreferences, window: Adw.PreferencesWindow) {
		super({
			name: "Other",
			title: _("Other"),
			iconName: "preferences-system-symbolic",
		})
		fixPageScrollIssue(this)

		// DateMenu
		Group({
			parent: this,
			title: _("Date Menu"),
			description: _("Adjust Date Menu layout"),
		},[
			SwitchRow({
				settings,
				title: _("Hide Notifications"),
				subtitle: _("Hide notifications on date menu.\n*this option removes media control on date menu too*"),
				bind: "datemenu-remove-notifications",
			}),
			SwitchRow({
				settings,
				title: _("Hide Media Control"),
				subtitle: _("Hide media control on date menu."),
				bind: "datemenu-remove-media-control",
			}),
		])

		Group({
			parent: this,
			title: _("Debug"),
			description: _("Extension debugging options"),
		}, [
			SwitchRow({
				settings,
				title: _("Expose environment"),
				subtitle: _("Expose extension environment to globalThis.qst"),
				bind: "debug-expose"
			}),
			SwitchRow({
				settings,
				title: _("Show layout border"),
				subtitle: _("Show layout borders on Quick Settings"),
				bind: "debug-show-layout-border"
			}),
			DropdownRow({
				settings,
				title: _("Log level"),
				bind: "debug-log-level",
				items: [
					{ name: "none", value: -1 },
					{ name: "error", value: 0 },
					{ name: "info", value: 1 },
					{ name: "debug", value: 2 },
				],
			}),
		])
	}
})
