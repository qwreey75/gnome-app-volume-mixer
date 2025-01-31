import Adw from "gi://Adw"
import GObject from "gi://GObject"
import Gio from "gi://Gio"
import { gettext as _ } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js"
import Config from "../config.js"
import type QstExtensionPreferences from "../prefs.js"
import {
	SwitchRow,
	AdjustmentRow,
	DropdownRow,
	Group,
	DialogRow,
	fixPageScrollIssue,
} from "../libs/prefComponents.js"

// #region AdvancedAnimationStyleGroup
function AdvancedAnimationStyleGroup(settings: Gio.Settings): Adw.PreferencesGroup {
	return Group({
		title: _("Advanced animation style"),
	},[
		AdjustmentRow({
			settings,
			title: _("Open Duration"),
			subtitle: _("Open animation duration in microseconds"),
			sensitiveBind: "menu-animation-enabled",
			bind: "menu-animation-open-duration",
			max: 4000,
		}),
		AdjustmentRow({
			settings,
			title: _("Close Duration"),
			subtitle: _("Close animation duration in microseconds"),
			sensitiveBind: "menu-animation-enabled",
			bind: "menu-animation-close-duration",
			max: 4000,
		}),
		AdjustmentRow({
			settings,
			title: _("Grid Content Opacity"),
			subtitle: _("Adjust grid content opacity.\nSet this to 255 to opaque, and 0 to transparent"),
			sensitiveBind: "menu-animation-enabled",
			bind: "menu-animation-grid-content-opacity",
			max: 255,
		}),
		AdjustmentRow({
			settings,
			title: _("Background Blur Radius"),
			subtitle: _("Adjust background blur radius.\nSet this to 0 to disable blur effect"),
			sensitiveBind: "menu-animation-enabled",
			bind: "menu-animation-background-blur-radius",
			max: 32,
		}),
		AdjustmentRow({
			settings,
			title: _("Background Opacity"),
			subtitle: _("Adjust background opacity.\nSet this to 255 to opaque, and 0 to transparent"),
			sensitiveBind: "menu-animation-enabled",
			bind: "menu-animation-background-opacity",
			max: 255,
		}),
		AdjustmentRow({
			settings,
			title: _("Background X Scale"),
			subtitle: _("Adjust background x scale, 1000 means 1.0 scale"),
			sensitiveBind: "menu-animation-enabled",
			bind: "menu-animation-background-scale-x",
			max: 4000,
		}),
		AdjustmentRow({
			settings,
			title: _("Background Y Scale"),
			subtitle: _("Adjust background y scale, 1000 means 1.0 scale"),
			sensitiveBind: "menu-animation-enabled",
			bind: "menu-animation-background-scale-y",
			max: 4000,
		}),
	])
}
// #endregion AdvancedAnimationStyleGroup

export const MenuPage = GObject.registerClass({
	GTypeName: Config.baseGTypeName+"MenuPage",
}, class MenuPage extends Adw.PreferencesPage {
	constructor(settings: Gio.Settings, _prefs: QstExtensionPreferences, window: Adw.PreferencesWindow) {
		super({
			name: "Menu",
			title: _("Menu"),
			iconName: "user-available-symbolic",
		})
		fixPageScrollIssue(this)

		// Overlay
		Group({
			parent: this,
			title: _("Overlay Mode"),
			description: _("Display toggle, power, and sound menus as overlay"),
			headerSuffix: SwitchRow({
				settings,
				bind: "overlay-menu-enabled",
			}),
			experimental: true,
		},[
			AdjustmentRow({
				settings,
				title: _("Overlay Width"),
				subtitle: _("Adjust overlay menu width\nSet this to 0 to disable adjusting"),
				sensitiveBind: "overlay-menu-enabled",
				bind: "overlay-menu-width",
				max: 2048,
			}),
			AdjustmentRow({
				settings,
				title: _("Overlay Animation Duration"),
				subtitle: _("Custom menu open animation duration in microseconds\nSet this to 0 to disable custom animation"),
				sensitiveBind: "overlay-menu-enabled",
				bind: "overlay-menu-animate-duration",
				max: 4000,
			}),
			DropdownRow({
				settings,
				title: _("Overlay Animation Style"),
				subtitle: _("Custom menu open animation style"),
				items: [
					{ "name": _("Flyout"), "value": "flyout" },
					{ "name": _("Dialog"), "value": "dialog" },
				],
				bind: "overlay-menu-animate-style",
				sensitiveBind: "overlay-menu-enabled"
			})
		])

		// Animation
		Group({
			parent: this,
			title: _("Animation"),
			description: _("Add menu animation on toggle menu opening and closing\nTo get the best feel, turn on overlay mode"),
			headerSuffix: SwitchRow({
				settings,
				bind: "menu-animation-enabled",
			}),
			experimental: true,
		},[
			DialogRow({
				window,
				settings,
				title: _("Advanced animation style"),
				subtitle: _("Adjust speed, blur, scale, and opacity"),
				dialogTitle: _("Animation"),
				sensitiveBind: "menu-animation-enabled",
				childrenRequest: ()=>[AdvancedAnimationStyleGroup(settings)],
			}),
		])
	}
})
