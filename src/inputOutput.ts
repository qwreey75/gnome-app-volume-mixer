import { Global } from "./global.js"
import St from "gi://St"
import * as Volume from "resource:///org/gnome/shell/ui/status/volume.js"
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js"
import { FeatureBase, type SettingLoader } from "./libs/feature.js"
import { logger } from "./libs/logger.js"
export class SoundTweakFeature extends FeatureBase {
	// #region settings
	outputShowSelected: boolean
	inputShowSelected: boolean
	inputAlwaysShow: boolean
	outputHide: {name: string}[]
	inputHide: {name: string}[]
	loadSettings(loader: SettingLoader): void {
		this.outputShowSelected = loader.loadBoolean("sound-output-show-selected")
		this.inputShowSelected = loader.loadBoolean("sound-input-show-selected")
		this.inputAlwaysShow = loader.loadBoolean("sound-input-always-show")
		this.outputHide = loader.loadValue("sound-output-hide")
		this.inputHide = loader.loadValue("sound-input-hide")
	}
	// #endregion settings

	onLoad() {
		if (this.outputShowSelected) {
			const label = this.maid.destroyJob(new St.Label({
				style_class: "QSTWEAKS-volume-mixer-label"
			}))
			// @ts-expect-error
			Global.QuickSettingsMenu.addItem(label, 2)
			Global.GetStreamSlider().then(({ OutputStreamSlider }) => {
				Global.QuickSettingsGrid.set_child_below_sibling(label, OutputStreamSlider)
			}).catch(logger.error)
		}
	}
	onUnload(): void {}
}

	unload() {
		// disable feature reloader
		featureReloader.disable(this)

		if (this._inputListener) {
			this._detachInputLabel()
			Volume.getMixerControl().disconnect(this._inputListener)
			this._inputListener = null
		}
		if (this._inputVisibilityListener) {
			let inputVisibilityListener = this._inputVisibilityListener
			this._inputVisibilityListener = null
			Global.GetStreamSlider(({ InputStreamSlider }) => {
				InputStreamSlider.disconnect(inputVisibilityListener)
				InputStreamSlider.visible = InputStreamSlider._shouldBeVisible()
			})
		}
		if (this._outputListener) {
			this._detachOutputLabel()
			Volume.getMixerControl().disconnect(this._outputListener)
			this._outputListener = null
		}
	}

	// =========================================== Ouput ===========================================
	_setupOutputChangedListener() {
		this._attachOutputLabel()
		this._outputListener = Volume.getMixerControl().connect('active-output-update', (c, id) => this._onOutputDeviceChanged(id))
	}

	_onOutputDeviceChanged(deviceId) {
		const device = Volume.getMixerControl().lookup_output_id(deviceId)
		this.outputLabel.text = this._getDeviceName(device)
	}

	_attachOutputLabel() {
		this.outputLabel = new St.Label()
		this.outputLabel.style_class = "QSTWEAKS-volume-mixer-label"
		Global.QuickSettingsMenu.addItem(this.outputLabel, 2)
		this.outputLabel.visible = Global.Settings.get_boolean("output-show-selected")
		Global.GetStreamSlider(({ OutputStreamSlider }) => {
			Global.QuickSettingsGrid.set_child_below_sibling(this.outputLabel, OutputStreamSlider)
			this.outputLabel.text = this._findActiveDevice(OutputStreamSlider)
		})
	}

	_detachOutputLabel() {
		if (this.outputLabel && this.outputLabel.get_parent()) {
			this.outputLabel.get_parent().remove_child(this.outputLabel)
			this.outputLabel = null
		}
	}

	// =========================================== Input ===========================================
	_setupInputChangedListener() {
		this._attachInputLabel()
		this._inputListener = Volume.getMixerControl().connect('active-input-update', (c, id) => this._onInputDeviceChanged(id))
	}

	_attachInputLabel() {
		this.inputLabel = new St.Label()
		this.inputLabel.style_class = "QSTWEAKS-volume-mixer-label"
		Global.QuickSettingsMenu.addItem(this.inputLabel, 2)
		Global.GetStreamSlider(({ InputStreamSlider }) => {
			Global.QuickSettingsGrid.set_child_below_sibling(this.inputLabel, InputStreamSlider)
			this.inputLabel.text = this._findActiveDevice(InputStreamSlider)
		})
		this._setInputLabelVisibility()
	}

	_onInputDeviceChanged(deviceId) {
		const device = Volume.getMixerControl().lookup_input_id(deviceId)
		this.inputLabel.text = this._getDeviceName(device)
	}

	_detachInputLabel() {
		if (this.inputLabel && this.inputLabel.get_parent()) {
			this.inputLabel.get_parent().remove_child(this.inputLabel)
			this.inputLabel = null
		}
	}

	// =========================================== Input Visbility ===========================================
	_setupInputVisibilityObserver() {
		Global.GetStreamSlider(({ InputStreamSlider }) => {
			this._inputVisibilityListener = InputStreamSlider.connect("notify::visible", () => this._onInputStreamSliderSynced())
			this._onInputStreamSliderSynced()
		})
	}

	_onInputStreamSliderSynced() {
		this._setInputStreamSliderVisibility()
		if (this._inputListener) {
			this._setInputLabelVisibility()
		}
	}

	_setInputStreamSliderVisibility() {
		Global.GetStreamSlider(({ InputStreamSlider }) => {
			InputStreamSlider.visible = InputStreamSlider._shouldBeVisible() || Global.Settings.get_boolean("input-always-show")
		})
	}


	_setInputLabelVisibility() {
		Global.GetStreamSlider(({ InputStreamSlider }) => {
			this.inputLabel.visible = InputStreamSlider.visible && Global.Settings.get_boolean("input-show-selected")
		})
	}


	// =========================================== Utils ===========================================
	_findActiveDevice(sliderObject) {
		// find the current selected input and grab the input text from that
		let menuChildren = sliderObject.menu.box.get_children()[1].get_children()
		for (let index = 0; index < menuChildren.length; index++) {
			let item = menuChildren[index]
			if (item._ornament == PopupMenu.Ornament.CHECK) {
				return item.label.text
			}
		}
		return null
	}

	_getDeviceName(device) {
		if (!device)
			return

		const { description, origin } = device
		const name = origin
			? `${description} – ${origin}`
			: description

		return name
	}
}
