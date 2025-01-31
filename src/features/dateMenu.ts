import { Global } from "../global.js"
import { FeatureBase, type SettingLoader } from "../libs/feature.js"

export class DateMenuFeature extends FeatureBase {
	// #region settings
	removeMediaControl: boolean
	removeNotifications: boolean
	loadSettings(loader: SettingLoader): void {
		this.removeMediaControl = loader.loadBoolean("datemenu-remove-media-control")
		this.removeNotifications = loader.loadBoolean("datemenu-remove-notifications")
	}
	// #endregion settings

	onLoad() {
		// remove media control from date menu
		if (this.removeMediaControl) {
			Global.MediaSection.hide()
			this.maid.connectJob(
				Global.MediaSection,
				"show",
				() => Global.MediaSection.hide()
			)
		}

		// remove notifications from date menu
		if (this.removeNotifications) {
			Global.NotificationSection.hide()
			this.maid.connectJob(
				Global.NotificationSection,
				"show",
				() => Global.NotificationSection.hide()
			)
		}
	}
	onUnload(): void {
		// @ts-ignore
		if (Global.MediaSection._shouldShow()) Global.MediaSection.show();
		// @ts-ignore
		if (Global.NotificationSection._shouldShow()) Global.NotificationSection.show();
	}
}
