import St from "gi://St"
import { Global } from "../global.js"
import { FeatureBase, type SettingLoader } from "../libs/feature.js"
import { QuickMenuToggle } from "resource:///org/gnome/shell/ui/quickSettings.js"

export class LayoutCustomize extends FeatureBase {
	_scroll: St.ScrollView
	_sections: St.BoxLayout

	// #region settings
	override loadSettings(loader: SettingLoader): void {
	}
	// #endregion settings

	onChild(actor: QuickMenuToggle) {
		actor.get_parent().remove_child(actor)
		this._sections.add_child(actor)
	}
	checkChildren() {
		for (const item of Global.QuickSettingsGrid.get_children()) {
			if (item instanceof QuickMenuToggle) this.onChild(item)
		}
	}

	update() {
		
	}

	override onLoad(): void {
		Global.QuickSettingsBox.vertical = false
		// Global.QuickSettingsBox.add_child(
		// 	new St.Button({height: 100, width: 100, style: "background-color:red;"})
		// )

		this.maid.connectJob(
			Global.QuickSettingsBox, "notify::mapped", ()=>{
				if (Global.QuickSettingsBox.mapped) this.update()
			}
		)
	}
	override onUnload(): void {
		Global.QuickSettingsBox.vertical = true
	}
}
