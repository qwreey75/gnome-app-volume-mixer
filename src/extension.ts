/**
 * Viewer Note:
 * stylesheet and javascript files are compiled from scss and typescript. 
 * To modify this extension, please check original source-codes from repository
 * https://github.com/qwreey/quick-settings-tweaks
*/
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js"
import { logger } from "./libs/logger.js"
import { Global } from "./global.js"
import Config from "./config.js"
import { type FeatureBase } from "./libs/feature.js"
import { DndQuickToggleFeature } from "./features/toggle/dndQuickToggle.js"
import { UnsafeQuickToggleFeature } from "./features/toggle/unsafeQuickToggle.js"
import { MediaWidgetFeature } from "./features/widget/media.js"
import { WeatherWidgetFeature } from "./features/widget/weather.js"
import { NotificationsWidgetFeature } from "./features/widget/notifications.js"
import { TogglesOrderFeature } from "./features/layout/toggles.js"
import { SystemItemsOrderFeature } from "./features/layout/systemItems.js"
import { DateMenuFeature } from "./features/dateMenu.js"
import { OverlayMenu } from "./features/overlayMenu.js"
import { LayoutCustomize } from "./features/layoutCustomize.js"
import { MenuAnimation } from "./features/menuAnimation.js"
import { DebugFeature } from "./features/debug.js"

export default class QstExtension extends Extension {
	private features: FeatureBase[]
	private debug: DebugFeature

	disable() {
		logger(`Extension ${this.metadata.name} deactivation started`)
		let start = +Date.now()

		// Unload features
		for (const feature of this.features) {
			logger(`Unload feature '${feature.constructor.name}'`)
			feature.unload()
		}
		this.features = null

		// Unload debug feature
		this.debug.unload()
		this.debug = null

		// Unload global context
		Global.unload()

		logger("Diabled. " + (+new Date() - start) + "ms taken")
	}

	enable() {
		// Load global context
		Global.load(this)

		// Load debug feature
		this.debug = new DebugFeature()
		this.debug.load()
		logger(`Extension activation started, version: ${Config.version}`)

		// Load features
		logger.debug("Initializing features ...")
		let start = +Date.now()
		for (const feature of this.features = [
			new DndQuickToggleFeature(),
			new UnsafeQuickToggleFeature(),
			// new VolumeMixerFeature(),
			// new ButtonRemoverFeature(),
			// new InputOutputFeature(),
			new LayoutCustomize(),
			new NotificationsWidgetFeature(),
			new MediaWidgetFeature(),
			new DateMenuFeature(),
			new WeatherWidgetFeature(),
			new OverlayMenu(),
			new MenuAnimation(),
			new SystemItemsOrderFeature(),
			new TogglesOrderFeature(),
		]) {
			logger.debug(()=>`Loading feature '${feature.constructor.name}'`)
			feature.load()
		}
		logger(`Extension Loaded, ${+Date.now() - start}ms taken`)
	}
}
