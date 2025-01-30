import St from "gi://St"
import Gvc from "gi://Gvc"
import GObject from "gi://GObject"
import Gio from "gi://Gio"
import GLib from "gi://GLib"
import { QuickSlider } from "resource:///org/gnome/shell/ui/quickSettings.js"
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js"
import * as Volume from "resource:///org/gnome/shell/ui/status/volume.js"
import { FeatureBase, type SettingLoader } from "../../libs/feature.js"
import { Global } from "../../global.js"
import { fixStScrollViewScrollbarOverflow } from "../../libs/utility.js"

const ALLOW_AMPLIFIED_VOLUME_KEY = 'allow-volume-above-100-percent'

class StreamSlider extends QuickSlider {
	_init(control) {
		super._init()

		this._connections = []  // ADDED BY QWREEY
		this._control = control

		this._inDrag = false
		this._notifyVolumeChangeId = 0

		this._soundSettings = new Gio.Settings({
			schema_id: 'org.gnome.desktop.sound',
		})

		// MODED BY QWREEY
		this._connections.push([
			this._soundSettings,
			this._soundSettings.connect(`changed::${ALLOW_AMPLIFIED_VOLUME_KEY}`,
				() => this._amplifySettingsChanged())
		])
		this._amplifySettingsChanged()

		this._sliderChangedId = this.slider.connect('notify::value',
			() => this._sliderChanged())
		this._connections.push([ // ADDED BY QWREEY
			this.slider, this._sliderChangedId
		])
		this._connections.push([ // MODED BY QWREEY
			this.slider,
			this.slider.connect('drag-begin', () => (this._inDrag = true))
		])
		this._connections.push([ // MODED BY QWREEY
			this.slider,
			this.slider.connect('drag-end', () => {
				this._inDrag = false
				this._notifyVolumeChange()
			})
		])

		this._deviceItems = new Map()

		this._deviceSection = new PopupMenu.PopupMenuSection()
		this.menu.addMenuItem(this._deviceSection)

		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem())
		this.menu.addSettingsAction(_('Sound Settings'), 'gnome-sound-panel.desktop')

		this._stream = null
		this._volumeCancellable = null
		this._icons = []

		this._sync()
		this._connections.push([ // ADDED BY QWREEY
			this,
			this.connect('destroy', this._destroy.bind(this))
		])
	}

	get stream() {
		return this._stream
	}

	set stream(stream) {
		this._stream?.disconnectObject(this)

		this._stream = stream

		if (this._stream) {
			this._connectStream(this._stream)
			this._updateVolume()
		} else {
			this.emit('stream-updated')
		}

		this._sync()
	}

	_connectStream(stream) {
		stream.connectObject(
			'notify::is-muted', this._updateVolume.bind(this),
			'notify::volume', this._updateVolume.bind(this), this)
	}

	_lookupDevice(_id) {
		throw new GObject.NotImplementedError(
			`_lookupDevice in ${this.constructor.name}`)
	}

	_activateDevice(_device) {
		throw new GObject.NotImplementedError(
			`_activateDevice in ${this.constructor.name}`)
	}

	_addDevice(id) {
		if (this._deviceItems.has(id))
			return

		const device = this._lookupDevice(id)
		if (!device)
			return

		const { description, origin } = device
		const name = origin
			? `${description} – ${origin}`
			: description
		const item = new PopupMenu.PopupImageMenuItem(name, device.get_gicon())
		this._connections.push([
			item,
			item.connect('activate', () => this._activateDevice(device))
		])

		this._deviceSection.addMenuItem(item)
		this._deviceItems.set(id, item)

		this._sync()
	}

	_removeDevice(id) {
		this._deviceItems.get(id)?.destroy()
		if (this._deviceItems.delete(id))
			this._sync()
	}

	_setActiveDevice(activeId) {
		for (const [id, item] of this._deviceItems) {
			item.setOrnament(id === activeId
				? PopupMenu.Ornament.CHECK
				: PopupMenu.Ornament.NONE)
		}
	}

	_shouldBeVisible() {
		return this._stream != null
	}

	_sync() {
		this.visible = this._shouldBeVisible()
		this.menuEnabled = this._deviceItems.size > 1
	}

	_sliderChanged() {
		if (!this._stream)
			return

		let value = this.slider.value
		let volume = value * this._control.get_vol_max_norm()
		let prevMuted = this._stream.is_muted
		let prevVolume = this._stream.volume
		if (volume < 1) {
			this._stream.volume = 0
			if (!prevMuted)
				this._stream.change_is_muted(true)
		} else {
			this._stream.volume = volume
			if (prevMuted)
				this._stream.change_is_muted(false)
		}
		this._stream.push_volume()

		let volumeChanged = this._stream.volume !== prevVolume
		if (volumeChanged && !this._notifyVolumeChangeId && !this._inDrag) {
			this._notifyVolumeChangeId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 30, () => {
				this._notifyVolumeChange()
				this._notifyVolumeChangeId = 0
				return GLib.SOURCE_REMOVE
			})
			GLib.Source.set_name_by_id(this._notifyVolumeChangeId,
				'[gnome-shell] this._notifyVolumeChangeId')
		}
	}

	_notifyVolumeChange() {
		if (this._volumeCancellable)
			this._volumeCancellable.cancel()
		this._volumeCancellable = null

		if (this._stream.state === Gvc.MixerStreamState.RUNNING)
			return // feedback not necessary while playing

		this._volumeCancellable = new Gio.Cancellable()
		let player = global.display.get_sound_player()
		player.play_from_theme('audio-volume-change',
			_('Volume changed'), this._volumeCancellable)
	}

	_changeSlider(value) {
		this.slider.block_signal_handler(this._sliderChangedId)
		this.slider.value = value
		this.slider.unblock_signal_handler(this._sliderChangedId)
	}

	_updateVolume() {
		let muted = this._stream.is_muted
		this._changeSlider(muted
			? 0 : this._stream.volume / this._control.get_vol_max_norm())
		this.emit('stream-updated')
	}

	_amplifySettingsChanged() {
		this._allowAmplified = this._soundSettings.get_boolean(ALLOW_AMPLIFIED_VOLUME_KEY)

		this.slider.maximum_value = this._allowAmplified
			? this.getMaxLevel() : 1

		if (this._stream)
			this._updateVolume()
	}

	getIcon() {
		if (!this._stream)
			return null

		let volume = this._stream.volume
		let n
		if (this._stream.is_muted || volume <= 0) {
			n = 0
		} else {
			n = Math.ceil(3 * volume / this._control.get_vol_max_norm())
			n = Math.clamp(n, 1, this._icons.length - 1)
		}
		return this._icons[n]
	}

	getLevel() {
		if (!this._stream)
			return null

		return this._stream.volume / this._control.get_vol_max_norm()
	}

	getMaxLevel() {
		let maxVolume = this._control.get_vol_max_norm()
		if (this._allowAmplified)
			maxVolume = this._control.get_vol_max_amplified()

		return maxVolume / this._control.get_vol_max_norm()
	}

	// ADDED BY QWREEY
	_destroy() {
		GLib.Source.remove(this._notifyVolumeChangeId)
		for (const item of this._connections) {
			item[0].disconnect(item[1])
		}
		this._connections = null
	}
}
GObject.registerClass({
	Signals: {
		'stream-updated': {},
	},
}, StreamSlider)

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
}
export const VolumeMixer = class VolumeMixer extends PopupMenu.PopupMenuSection {
	constructor(settings) {
		super()
		this._applicationStreams = {}
		this._applicationMenus = {}

		this._control = Volume.getMixerControl()
		this._streamAddedEventId = this._control.connect("stream-added", this._streamAdded.bind(this))
		this._streamRemovedEventId = this._control.connect("stream-removed", this._streamRemoved.bind(this))

		this._filteredApps = settings["volume-mixer-filtered-apps"]
		this._filterMode = settings["volume-mixer-filter-mode"]
		this._showStreamDesc = settings["volume-mixer-show-description"]
		this._showStreamIcon = settings["volume-mixer-show-icon"]
		this._useRegex = settings["volume-mixer-use-regex"]
		this._checkDescription = settings["volume-mixer-check-description"]

		this._updateStreams()
	}

	_checkMatch(str, matchStr) {
		if (!str) return
		if (matchStr instanceof RegExp) return str.match(matchStr)
		return str === matchStr
	}

	_streamAdded(control, id) {

		if (id in this._applicationStreams) {
			return
		}

		const stream = control.lookup_stream_id(id)

		if (stream.is_event_stream || !(stream instanceof Gvc.MixerSinkInput)) {
			return
		}

		let name = stream.get_name()
		let description = stream.get_description()

		let hasFiltered = false
		for (const matchStr of this._filteredApps) {
			let matchExp = this._useRegex ? new RegExp(matchStr) : matchStr
			if (
				// Check name
				this._checkMatch(name, matchExp)
				// Check description
				|| this._checkDescription && this._checkMatch(description, matchExp)
			) { hasFiltered = true; break }
		}
		if (this._filterMode === "block" && hasFiltered) return
		if (this._filterMode === "allow" && !hasFiltered) return

		const slider = new StreamSlider(Volume.getMixerControl())
		slider.stream = stream
		slider.style_class = slider.style_class + " QSTWEAKS-volume-mixer-slider"
		this._applicationStreams[id] = slider
		if (this._showStreamIcon) {
			slider._icon.icon_name = stream.get_icon_name()
		}

		if (name || description) {
			slider._vbox = new St.BoxLayout()
			slider._vbox.vertical = true

			let sliderBox = slider.first_child
			let lastObj = sliderBox.last_child // expend button. not needed
			let sliderObj = sliderBox.get_children()[1]
			sliderBox.remove_child(sliderObj)
			sliderBox.remove_child(lastObj)
			sliderBox.add_child(slider._vbox)

			slider._label = new St.Label({ x_expand: true })
			slider._label.style_class = "QSTWEAKS-volume-mixer-label"
			slider._label.text = name && this._showStreamDesc ? `${name} - ${description}` : (name || description)
			slider._vbox.add_child(slider._label)
			slider._vbox.add_child(sliderObj)
		}

		this.actor.add_child(slider)
		slider.visible = true
	}

	_streamRemoved(_control, id) {
		if (id in this._applicationStreams) {
			this._applicationStreams[id].destroy()
			delete this._applicationMenus[id]
		}
	}

	_updateStreams() {
		for (const id in this._applicationStreams) {
			this._applicationStreams[id].destroy()
			delete this._applicationMenus[id]
		}

		for (const stream of this._control.get_streams()) {
			this._streamAdded(this._control, stream.get_id())
		}
	}

	destroy() {
		// Destroy all of sliders
		for (const id in this._applicationStreams) {
			this._applicationStreams[id].destroy()
			delete this._applicationMenus[id]
		}

		this._control.disconnect(this._streamAddedEventId)
		this._control.disconnect(this._streamRemovedEventId)
		super.destroy()
	}
}
