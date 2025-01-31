/*
 * This code is partially licensed under the gnome-volume-mixer license.
 * For more details, please check the license page in the about tab of the extension settings.
*/

import St from "gi://St"
import Gvc from "gi://Gvc"
import GObject from "gi://GObject"
import Gio from "gi://Gio"
import GLib from "gi://GLib"
import { QuickSlider } from "resource:///org/gnome/shell/ui/quickSettings.js"
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js"
import * as Volume from "resource:///org/gnome/shell/ui/status/volume.js"
import { FeatureBase, type SettingLoader } from "../../libs/feature.js"
import Maid from "../../libs/maid.js"
// import { Global } from "../../global.js"
// import { fixStScrollViewScrollbarOverflow } from "../../libs/utility.js"

const ALLOW_AMPLIFIED_VOLUME_KEY = 'allow-volume-above-100-percent'

// #region StreamSlider
// 디바이스 변경 구현하기
// 루프는 오직 컨테이너가 보이는 상태에서만 작동해야함
class StreamSlider extends QuickSlider {
	_maid: Maid
	_control: Gvc.MixerControl
	_inDrag: boolean
	_notifyVolumeChangeId: number
	_deviceSection: PopupMenu.PopupMenuSection
	_sliderChangedId: number

	constructor(
		control: Gvc.MixerControl,
		stream: Gvc.MixerStream,
		options: VolumeMixerWidget.Options
	) {
		// @ts-expect-error
		super(control, stream, options)
	}

	// @ts-expect-error
	_init(control: Gvc.MixerControl, stream: Gvc.MixerStream|undefined) {
		super._init()
		this._control = control
		this._notifyVolumeChangeId = 0
		this._maid = new Maid()
		this._maid.connectJob(this, "destroy", this._destroy.bind(this))
		
		// Update allow amplify
		this._soundSettings = new Gio.Settings({
			schema_id: 'org.gnome.desktop.sound',
		})
		this._maid.connectJob(
			this._soundSettings,
			`changed::${ALLOW_AMPLIFIED_VOLUME_KEY}`,
			this._updateAllowAmplified.bind(this)
		)
		this._updateAllowAmplified()
		
		// Value change connection
		this._inDrag = false
		this._sliderChangedId = this._maid.connectJob(this.slider, "notify::value", this._sliderChanged.bind(this))
		this._maid.connectJob(this.slider, "drag-begin", () => { this._inDrag = true })
		this._maid.connectJob(this.slider, "drag-end", () => { this._inDrag = false })

		// this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem())
		// this.menu.addSettingsAction(_('Sound Settings'), 'gnome-sound-panel.desktop')

		// Update stream
		if (stream) {
			this.stream = stream
		} else {
			this._stream = null
		}
		this._sync()
	}

	// Stream connection
	_stream: Gvc.MixerStream
	get stream(): Gvc.MixerStream {
		return this._stream
	}
	set stream(stream: Gvc.MixerStream) {
		if (this._stream == stream) return

		// @ts-expect-error
		this._stream?.disconnectObject(this)
		this._stream = stream

		if (stream) {
			// Create connection
			// @ts-expect-error
			stream.connectObject(
				'notify::is-muted', this._updateSlider.bind(this),
				'notify::volume', this._updateSlider.bind(this),
				this
			)
			this._updateSlider()
		} else {
			this.emit('stream-updated')
		}

		this._sync()
	}

	// Sync visibility
	_sync() {
		this.visible = this._stream != null
		this.menuEnabled = false // this._deviceItems.size > 1
	}

	// Volume feedback sfx
	_volumeCancellable?: Gio.Cancellable|null
	_feedbackVolumeChange() {
		// Cancel last sound
		if (this._volumeCancellable) this._volumeCancellable.cancel()
		this._volumeCancellable = null

		// Feedback not necessary while playing
		if (this._stream.state === Gvc.MixerStreamState.RUNNING) return

		// Play sound feedback
		this._volumeCancellable = new Gio.Cancellable()
		global
			.display
			.get_sound_player()
			.play_from_theme(
				'audio-volume-change',
				_('Volume changed'),
				this._volumeCancellable
			)
	}

	// Update slider value (without emitting notify::value connection)
	_updateSlider() {
		this.slider.block_signal_handler(this._sliderChangedId)
		this.slider.value =
			this._stream.is_muted
			? 0
			: (this._stream.volume / this._control.get_vol_max_norm())
		this.slider.unblock_signal_handler(this._sliderChangedId)
		this.emit('stream-updated')
	}

	// Slider value notify
	_sliderChanged() {
		if (!this._stream) return

		const volume: number = this.slider.value * this._control.get_vol_max_norm()
		const prevMuted: boolean = this._stream.is_muted
		const prevVolume: number = this._stream.volume
		const volumeChanged: boolean = this._stream.volume !== prevVolume
		if (volume < 1) {
			this._stream.volume = 0
			if (!prevMuted) this._stream.change_is_muted(true)
		} else {
			this._stream.volume = volume
			if (prevMuted) this._stream.change_is_muted(false)
		}
		this._stream.push_volume()

		if (volumeChanged && !this._notifyVolumeChangeId && !this._inDrag) {
			this._notifyVolumeChangeId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 30, () => {
				this._feedbackVolumeChange()
				this._notifyVolumeChangeId = 0
				return GLib.SOURCE_REMOVE
			})
			GLib.Source.set_name_by_id(
				this._notifyVolumeChangeId,
				'[quick-settings-tweaks] StreamSlider._sliderChanged: this._notifyVolumeChangeId'
			)
		}
	}

	// Update allow amplified from org.gnome.desktop.sound
	_soundSettings: Gio.Settings
	_allowAmplified: boolean
	_updateAllowAmplified() {
		this._allowAmplified = this._soundSettings.get_boolean(ALLOW_AMPLIFIED_VOLUME_KEY)
		this.slider.maximumValue = this._allowAmplified ? this.getMaxLevel() : 1
		if (this._stream) this._updateSlider()
	}

	getLevel(): number|null {
		if (!this._stream) return null
		return this._stream.volume / this._control.get_vol_max_norm()
	}
	getMaxLevel(): number {
		const maxVolume =
			this._allowAmplified
			? this._control.get_vol_max_amplified()
			: this._control.get_vol_max_norm()
		return maxVolume / this._control.get_vol_max_norm()
	}

	_destroy() {
		this._maid.destroy()
		this._maid = null
		if (this._notifyVolumeChangeId) {
			GLib.Source.remove(this._notifyVolumeChangeId)
			this._notifyVolumeChangeId = null
		}
		this._soundSettings = null
		if (this._volumeCancellable) {
			this._volumeCancellable.cancel()
			this._volumeCancellable = null
		}
	}
}
GObject.registerClass({
	Signals: {
		'stream-updated': {},
	},
}, StreamSlider)
// #endregion StreamSlider

// #region VolumeMixerWidget
namespace VolumeMixerWidget {
	export interface Options {
	}
}
class VolumeMixerWidget extends PopupMenu.PopupMenuSection {
	_control: Gvc.MixerControl
	_maid: Maid
	_options: VolumeMixerWidget.Options
	_sliders: Map<number, StreamSlider>

	constructor(options: VolumeMixerWidget.Options) {
		super()
		this._options = options
		this._maid = new Maid()
		this._sliders = new Map()

		// this._applicationMenus = new Map()//{}

		this._control = Volume.getMixerControl()
		this._maid.connectJob(this._control, "stream-added", this._streamAdded.bind(this))
		this._maid.connectJob(this._control, "stream-removed", this._streamRemoved.bind(this))
		for (const stream of this._control.get_streams()) {
			this._streamAdded(this._control, stream.get_id())
		}

		// Group with application id << we need this
		// description regex
		// name regex
		// application regex
		// show as popup menu

		// this._filteredApps = settings["volume-mixer-filtered-apps"]
		// this._filterMode = settings["volume-mixer-filter-mode"]
		// this._showStreamDesc = settings["volume-mixer-show-description"]
		// this._showStreamIcon = settings["volume-mixer-show-icon"]
		// this._useRegex = settings["volume-mixer-use-regex"]
		// this._checkDescription = settings["volume-mixer-check-description"]

	}

	_streamAdded(control:Gvc.MixerControl, id: number) {
		if (this._sliders.has(id)) {
			return
		}
		const stream = control.lookup_stream_id(id)

		if (stream.is_event_stream || !(stream instanceof Gvc.MixerSinkInput)) {
			return
		}
		
		const applicationId =  stream.get_application_id()
		const name = stream.get_name()
		const description = stream.get_description()

		// filter here
		// let hasFiltered = false
		// for (const matchStr of this._filteredApps) {
		// 	let matchExp = this._useRegex ? new RegExp(matchStr) : matchStr
		// 	if (
		// 		// Check name
		// 		this._checkMatch(name, matchExp)
		// 		// Check description
		// 		|| this._checkDescription && this._checkMatch(description, matchExp)
		// 	) { hasFiltered = true; break }
		// }
		// if (this._filterMode === "block" && hasFiltered) return
		// if (this._filterMode === "allow" && !hasFiltered) return

		const slider = new StreamSlider(
			this._control,
			stream,
			this._options
		)

		// slider.style_class = slider.style_class + " QSTWEAKS-volume-mixer-slider"
		// this._applicationStreams[id] = slider
		// if (this._showStreamIcon) {
			// slider._icon.icon_name = stream.get_icon_name()
		// }

		// if (name || description) {
		// 	slider._vbox = new St.BoxLayout()
		// 	slider._vbox.vertical = true

		// 	let sliderBox = slider.first_child
		// 	let lastObj = sliderBox.last_child // expend button. not needed
		// 	let sliderObj = sliderBox.get_children()[1]
		// 	sliderBox.remove_child(sliderObj)
		// 	sliderBox.remove_child(lastObj)
		// 	sliderBox.add_child(slider._vbox)

		// 	slider._label = new St.Label({ x_expand: true })
		// 	slider._label.style_class = "QSTWEAKS-volume-mixer-label"
		// 	slider._label.text = name && this._showStreamDesc ? `${name} - ${description}` : (name || description)
		// 	slider._vbox.add_child(slider._label)
		// 	slider._vbox.add_child(sliderObj)
		// }

		this.actor.add_child(slider)
		slider.visible = true
	}

	_streamRemoved(_control: Gvc.MixerControl, id: number) {
		const slider = this._sliders.get(id)
		if (!slider) return
		slider.destroy()
		this._sliders.delete(id)
	}

	destroy() {
		this._maid.destroy()
		this._maid = null
		for (const slider of this._sliders.values()) {
			slider.destroy()
		}
		this._sliders = null
		super.destroy()
	}
}
// #endregion VolumeMixerWidget

export class VolumeMixerWidgetFeature extends FeatureBase {
	// #region settings
	enabled: boolean
	scroll: boolean
	maxHeight: number
	override loadSettings(loader: SettingLoader): void {
		this.enabled = loader.loadBoolean("volume-mixer-enabled")
		this.scroll = loader.loadBoolean("volume-mixer-show-scrollbar")
		this.maxHeight = loader.loadInt("volume-mixer-max-height")
	}
	// #endregion settings

	onLoad(): void {
	}
	onUnload(): void {
	}
}
