import Clutter from "gi://Clutter"
import { Global } from "../../global.js"
import { FeatureBase, type SettingLoader } from "../../libs/feature.js"
import {
	type PowerToggle,
} from "resource:///org/gnome/shell/ui/status/system.js"
import { type QuickSettingsItem } from "resource:///org/gnome/shell/ui/quickSettings.js"
import { type SystemItem } from "resource:///org/gnome/shell/ui/status/system.js"
import { logger } from "../../libs/logger.js"

export class SystemItemsOrderFeature extends FeatureBase {
	// #region settings
	hideScreenshot: boolean
	hideSettings: boolean
	hideLock: boolean
	hideShutdown: boolean
	hideBattery: boolean
	hideLayout: boolean
	enabled: boolean
	order: string[]
	loadSettings(loader: SettingLoader): void {
		this.hideScreenshot = loader.loadBoolean("system-items-layout-hide-screenshot")
		this.hideSettings = loader.loadBoolean("system-items-layout-hide-settings")
		this.hideLock = loader.loadBoolean("system-items-layout-hide-lock")
		this.hideShutdown = loader.loadBoolean("system-items-layout-hide-shutdown")
		this.hideBattery = loader.loadBoolean("system-items-layout-hide-battery")
		this.hideLayout = loader.loadBoolean("system-items-layout-hide")
		this.enabled = loader.loadBoolean("system-items-layout-enabled")
		this.order = loader.loadStrv("system-items-layout-order")
	}
	// #endregion settings

	async getItmes(): Promise<{
		screenshot: QuickSettingsItem,
		settings: QuickSettingsItem,
		lock: QuickSettingsItem,
		shutdown: QuickSettingsItem,
		battery: PowerToggle,
		box: SystemItem,
		laptopSpacer: Clutter.Actor,
		desktopSpacer: Clutter.Actor,
	}> {
		const systemItem = await Global.QuickSettingsSystemItem
		const children = systemItem.child.get_children()
		let screenshotItem: QuickSettingsItem
		let settingsItem: QuickSettingsItem
		let lockItem: QuickSettingsItem
		let shutdownItem: QuickSettingsItem
		for (const child of children) {
			if (child.constructor.name == "ScreenshotItem") {
				screenshotItem = child as QuickSettingsItem
				continue
			}
			if (child.constructor.name == "SettingsItem") {
				settingsItem = child as QuickSettingsItem
				continue
			}
			if (child.constructor.name == "LockItem") {
				lockItem = child as QuickSettingsItem
				continue
			}
			if (child.constructor.name == "ShutdownItem") {
				shutdownItem = child as QuickSettingsItem
			}
		}
		return {
			screenshot: screenshotItem,
			settings: settingsItem,
			lock: lockItem,
			shutdown: shutdownItem,
			battery: systemItem.powerToggle,
			laptopSpacer: (systemItem as any)._laptopSpacer,
			desktopSpacer: (systemItem as any)._desktopSpacer,
			box: systemItem
		}
	}

	onLoad() {
		if (!this.enabled) return
		this.getItmes().then(items => {
			if (this.hideLayout) {
				this.maid.hideJob(items.box, ()=>true)
				return
			}
			if (this.hideBattery) {
				this.maid.hideJob(items.battery, ()=>{
					(items.battery as any)._sync()
				})
			}
			if (this.hideScreenshot) {
				this.maid.hideJob(items.screenshot, ()=>true)
			}
			if (this.hideLock) {
				this.maid.hideJob(items.lock, ()=>true)
			}
			if (this.hideShutdown) {
				this.maid.hideJob(items.shutdown, ()=>true)
			}
			if (this.hideSettings) {
				this.maid.hideJob(items.settings, ()=>true)
			}
			let last: any
			for (const [index, item] of this.order.entries()) {
				const current = items[item]
				if (index) items.box.child.set_child_above_sibling(current, last)
				last = current
			}
		}).catch(logger.error)
	}
	onUnload(): void {}
}
