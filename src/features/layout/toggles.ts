import { QuickToggle } from "resource:///org/gnome/shell/ui/quickSettings.js"
import { FeatureBase, type SettingLoader } from "../../libs/feature.js"
import { QuickSettingsToggleTracker } from "../../libs/quickSettingsTracker.js"
import Maid from "../../libs/maid.js"
import { Global } from "../../global.js"
import { QuickToggleOrderItem } from "../../libs/quickToggleOrderItem.js"

export class TogglesOrderFeature extends FeatureBase {
	// #region settings
	enabled: boolean
	order: QuickToggleOrderItem[]
	loadSettings(loader: SettingLoader): void {
		this.enabled = loader.loadBoolean("toggles-layout-enabled")
		this.order = loader.loadValue("toggles-layout-order")
		for (const orderItem of this.order) {
			if (orderItem.titleRegex) {
				orderItem.cachedTitleRegex = new RegExp(orderItem.titleRegex)
			}
		}
	}
	// #endregion settings

	onToggleCreated(maid: Maid, toggle: QuickToggle): void {
		const rule: QuickToggleOrderItem|undefined = this.order.find(item => QuickToggleOrderItem.toggleMatch(item, toggle))
		if (!rule) return
		if (rule.hide) maid.hideJob(toggle)
	}
	onUpdate(): void {
		const children = Global.QuickSettingsGrid.get_children()
		const head: QuickToggle[] = []
		const middle: QuickToggle[] = children.filter(child =>
			child instanceof QuickToggle && child.constructor.name != "BackgroundAppsToggle"
		) as any
		const tail: QuickToggle[] = []
		let overNonOrdered: boolean = false
		for (const item of this.order) {
			if (item.nonOrdered) {
				overNonOrdered = true
				continue
			}
			const middleIndex = middle.findIndex(toggle => QuickToggleOrderItem.toggleMatch(item, toggle))
			if (middleIndex == -1) continue
			const toggle = middle[middleIndex]
			middle.splice(middleIndex, 1);
			(overNonOrdered ? tail : head).push(toggle)
		}
		let last: QuickToggle|null = null
		for (const item of [head, middle, tail].flat()) {
			if (last) Global.QuickSettingsGrid.set_child_above_sibling(item, last)
			last = item
		}
	}

	tracker: QuickSettingsToggleTracker
	onLoad(): void {
		if (!this.enabled) return
		this.tracker = new QuickSettingsToggleTracker()
		this.tracker.onToggleCreated = this.onToggleCreated.bind(this)
		this.tracker.onUpdate = this.onUpdate.bind(this)
		this.tracker.load()
	}
	onUnload(): void {
		const tracker = this.tracker
		if (tracker) {
			this.tracker = null
			tracker.unload()
		}
	}
}
