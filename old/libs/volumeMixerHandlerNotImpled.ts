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
import Maid from "./libs/maid.js"

const ALLOW_AMPLIFIED_VOLUME_KEY = 'allow-volume-above-100-percent'

// 디바이스 변경 구현하기
// 루프는 오직 컨테이너가 보이는 상태에서만 작동해야함
class StreamSlider extends QuickSlider {
	_init(control: Gvc.MixerControl, stream: Gvc.MixerStream) {
		// ...
		this._maid.connectJob(this.slider, "drag-begin", () => { this._inDrag = true })
		this._maid.connectJob(this.slider, "drag-end", () => { this._inDrag = false })

		// this._deviceItems = new Map()

		// this._deviceSection = new PopupMenu.PopupMenuSection()
		// this.menu.addMenuItem(this._deviceSection)

		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem())
		this.menu.addSettingsAction(_('Sound Settings'), 'gnome-sound-panel.desktop')
		// ...
	}

	// ...
	_connectStream(stream: Gvc.MixerStream) {
	}
	// ...

	// _lookupDevice(_id) {
	// 	throw new GObject.NotImplementedError(
	// 		`_lookupDevice in ${this.constructor.name}`)
	// }

	// _activateDevice(_device) {
	// 	throw new GObject.NotImplementedError(
	// 		`_activateDevice in ${this.constructor.name}`)
	// }

	// _addDevice(id) {
	// 	if (this._deviceItems.has(id))
	// 		return

	// 	const device = this._lookupDevice(id)
	// 	if (!device)
	// 		return

	// 	const { description, origin } = device
	// 	const name = origin
	// 		? `${description} – ${origin}`
	// 		: description
	// 	const item = new PopupMenu.PopupImageMenuItem(name, device.get_gicon())
	// 	this._connections.push([
	// 		item,
	// 		item.connect('activate', () => this._activateDevice(device))
	// 	])

	// 	this._deviceSection.addMenuItem(item)
	// 	this._deviceItems.set(id, item)

	// 	this._sync()
	// }

	// _removeDevice(id) {
	// 	this._deviceItems.get(id)?.destroy()
	// 	if (this._deviceItems.delete(id))
	// 		this._sync()
	// }

	// _setActiveDevice(activeId) {
	// 	for (const [id, item] of this._deviceItems) {
	// 		item.setOrnament(id === activeId
	// 			? PopupMenu.Ornament.CHECK
	// 			: PopupMenu.Ornament.NONE)
	// 	}
	// }

	// ...
	_shouldBeVisible() {
		return this._stream != null
	}

	// not used
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
}
