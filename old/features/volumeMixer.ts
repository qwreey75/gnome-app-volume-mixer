import { featureReloader } from "../libs/utility.js"
import { VolumeMixer } from "../libs/volumeMixerHandler.js"
import { Global } from "../global.js"

export class VolumeMixerFeature {
	load() {
		let settings = Global.Settings

		// setup reloader
		featureReloader.enableWithSettingKeys(this, [
			"volume-mixer-enabled",
			"volume-mixer-position",
			"volume-mixer-filtered-apps",
			"volume-mixer-show-description",
			"volume-mixer-show-icon",
			"volume-mixer-filter-mode",
			"volume-mixer-use-regex",
			"volume-mixer-check-description"
		])

		// check is feature enabled
		if (!Global.Settings.get_boolean("volume-mixer-enabled")) return

		// Make volume mixer
		this.volumeMixer = new VolumeMixer({
			'volume-mixer-filtered-apps': settings.get_strv("volume-mixer-filtered-apps"),
			'volume-mixer-filter-mode': settings.get_string("volume-mixer-filter-mode"),
			'volume-mixer-show-description': settings.get_boolean("volume-mixer-show-description"),
			'volume-mixer-show-icon': settings.get_boolean("volume-mixer-show-icon"),
			'volume-mixer-check-description': settings.get_boolean("volume-mixer-check-description"),
			'volume-mixer-use-regex': settings.get_boolean("volume-mixer-use-regex")
		})

		// Insert volume mixer into Quick Settings
		Global.QuickSettingsMenu.addItem(this.volumeMixer.actor, 2)
		if (Global.Settings.get_string("volume-mixer-position") === "top") {
			Global.GetStreamSlider(({ InputStreamSlider }) => {
				Global.QuickSettingsMenu._grid.set_child_above_sibling(
					this.volumeMixer.actor,
					InputStreamSlider
				)
			})
		}
	}

	unload() {
		// disable feature reloader
		featureReloader.disable(this)
		if (this.volumeMixer) this.volumeMixer.destroy()
		this.volumeMixer = null
	}
}
