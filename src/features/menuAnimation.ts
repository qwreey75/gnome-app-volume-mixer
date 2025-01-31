import Clutter from "gi://Clutter"
import Shell from "gi://Shell"
import { type QuickSettingsMenu } from "resource:///org/gnome/shell/ui/quickSettings.js"
import { Global } from "../global.js"
import { FeatureBase, type SettingLoader } from "../libs/feature.js"
import Maid from "../libs/maid.js"
import { QuickSettingsMenuTracker } from "../libs/quickSettingsTracker.js"

export class MenuAnimation extends FeatureBase {
	// #region settings
	enabled: boolean
	backgroundBlurRadius: number
	backgroundOpacity: number
	backgroundScaleX: number
	backgroundScaleY: number
	gridContentOpacity: number
	openDuration: number
	closeDuration: number
	override loadSettings(loader: SettingLoader): void {
		this.enabled = loader.loadBoolean("menu-animation-enabled")
		this.backgroundBlurRadius = loader.loadInt("menu-animation-background-blur-radius")
		this.backgroundOpacity = loader.loadInt("menu-animation-background-opacity")
		this.backgroundScaleX = loader.loadInt("menu-animation-background-scale-x") / 1000
		this.backgroundScaleY = loader.loadInt("menu-animation-background-scale-y") / 1000
		this.openDuration = loader.loadInt("menu-animation-open-duration")
		this.closeDuration = loader.loadInt("menu-animation-close-duration")
		this.gridContentOpacity = loader.loadInt("menu-animation-grid-content-opacity")
	}
	// #endregion settings

	onOpen(_maid: Maid, _menu: QuickSettingsMenu, isOpen: boolean) {
		if (this.blur) this.blur.enabled = isOpen
		if (isOpen) {
			Global.QuickSettingsBox.set_pivot_point(0.5, 0.5)
			// @ts-expect-error
			Global.QuickSettingsBox.ease({
				duration: this.openDuration,
				mode: Clutter.AnimationMode.EASE_OUT_QUINT,
				scaleX: this.backgroundScaleX,
				scaleY: this.backgroundScaleY,
				opacity: this.backgroundOpacity,
			})
			// @ts-expect-error
			Global.QuickSettingsGrid.ease({
				duration: this.openDuration,
				mode: Clutter.AnimationMode.EASE_OUT_QUINT,
				opacity: this.gridContentOpacity,
			})
		} else {
			// @ts-expect-error
			Global.QuickSettingsBox.ease({
				duration: this.closeDuration,
				mode: Clutter.AnimationMode.EASE_OUT_QUINT,
				scaleX: 1,
				scaleY: 1,
				opacity: 255,
				onComplete: ()=>{
					Global.QuickSettingsBox.set_pivot_point(0, 0)
				}
			})
			// @ts-expect-error
			Global.QuickSettingsGrid.ease({
				duration: this.openDuration,
				mode: Clutter.AnimationMode.EASE_OUT_QUINT,
				opacity: 255,
			})
		}
	}

	blur: Shell.BlurEffect
	tracker: QuickSettingsMenuTracker
	override onLoad(): void {
		if (!this.enabled) return

		if (this.backgroundBlurRadius) {
			this.blur = new Shell.BlurEffect({
				brightness: 1,
				enabled: false,
				mode: Shell.BlurMode.ACTOR,
				radius: this.backgroundBlurRadius,
			})
			// @ts-expect-error
			Global.QuickSettingsMenu._boxPointer.add_effect_with_name("blur", this.blur)
		}

		this.tracker = new QuickSettingsMenuTracker()
		this.tracker.onOpen = this.onOpen.bind(this)
		this.tracker.load()
	}
	override onUnload(): void {
		const tracker = this.tracker
		if (!tracker) return
		this.tracker = null
		tracker.unload()
		if (this.blur) {
			// @ts-expect-error
			Global.QuickSettingsMenu._boxPointer.remove_effect(this.blur)
			this.blur = null
		}
		Global.QuickSettingsBox.remove_all_transitions()
		Global.QuickSettingsBox.scaleX = 1
		Global.QuickSettingsBox.scaleY = 1
		Global.QuickSettingsBox.opacity = 255
		Global.QuickSettingsBox.set_pivot_point(0, 0)
	}
}
