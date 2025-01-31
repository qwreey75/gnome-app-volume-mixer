import St from "gi://St"
import Clutter from "gi://Clutter"
import GObject from "gi://GObject"
import GLib from "gi://GLib"
import Gio from "gi://Gio"
import * as Mpris from "resource:///org/gnome/shell/ui/mpris.js"
import { Slider } from "resource:///org/gnome/shell/ui/slider.js"
// @ts-expect-error
import { PageIndicators } from "resource:///org/gnome/shell/ui/pageIndicators.js"
import { Global } from "../../global.js"
import { FeatureBase, type SettingLoader } from "../../libs/feature.js"
import { logger } from "../../libs/logger.js"

// #region ProgressControl
class ProgressControl extends St.BoxLayout {
	_positionLabel: St.Label
	_lengthLabel: St.Label
	_slider: Slider
	_player: Player
	_positionTracker: number|null
	_dragging: boolean
	_shown: boolean

	constructor(player: Player) {
		super(player as any)
	}
	_init(player: Player): void {
		this._player = player
		this._positionTracker = null
		this._dragging = false
		this._shown = false

		super._init({
			vertical: false,
			x_expand: true,
			style_class: "QSTWEAKS-progress-control",
		})

		this._createLabels()
		this._createSlider()

		this.add_child(this._positionLabel)
		this.add_child(this._slider)
		this.add_child(this._lengthLabel)

		this.connect("notify::mapped", this._updateTracker.bind(this))
		this.connect("destroy", this._dropTracker.bind(this))
		this._player.connectObject("changed", () => this._updateStatus(), this)
	}

	_createLabels() {
		this._positionLabel = new St.Label({
			y_expand: true,
			y_align: Clutter.ActorAlign.CENTER,
			style_class: "QSTWEAKS-position-label",
		})
		this._lengthLabel = new St.Label({
			y_expand: true,
			y_align: Clutter.ActorAlign.CENTER,
			style_class: "QSTWEAKS-length-label",
		})
	}
	_createSlider() {
		this._slider = new Slider(0)

		// Process Dragging
		this._slider.connect("drag-begin", () => {
			this._dragging = true
			return Clutter.EVENT_PROPAGATE
		});
		this._slider.connect("drag-end", () => {
			this._player.position = (Math.floor(this._slider.value) * 1000000)
			this._dragging = false
			return Clutter.EVENT_PROPAGATE
		})
		this._slider.connect("scroll-event", () => {
			return Clutter.EVENT_STOP
		})
		this._slider.connect("notify::value", () => {
			if (this._dragging) this._updatePosition(Math.floor(this._slider.value) * 1000000)
		})
	}

	// Show / Hide by playing status
	_updateStatus(noAnimate?: boolean) {
		if (!this.mapped) return
		this._shown = this._player.status === "Playing"
		if (this._shown) this._trackPosition()
		const previousHeight = this.height
		this.height = -1
		const height = this._shown ? this.get_preferred_height(-1)[0] : 0
		this.height = previousHeight
		const opacity = this._shown ? 255 : 0
		if (noAnimate) {
			this.remove_all_transitions()
			this.height = height
			this.opacity = opacity
			return
		}
		if (this._shown) {
			// @ts-expect-error
			this.ease({
				height,
				duration: 150,
				onComplete: ()=>{
					// @ts-expect-error
					this.ease({
						opacity,
						duration: 150,
					})
				}
			})
		} else {
			// @ts-expect-error
			this.ease({
				opacity,
				duration: 200,
				onComplete: ()=>{
					// @ts-expect-error
					this.ease({
						height,
						duration: 150,
					})
				}
			})
		}
	}

	// Update slider and label
	_updatePosition(current: number) {
		const currentSeconds = Math.floor(current / 1000000)
		const lengthSeconds = Math.floor(this._player.length / 1000000)
		this._positionLabel.text = this._formatSeconds(currentSeconds)
		this._lengthLabel.text = this._formatSeconds(lengthSeconds)
		this._slider.overdriveStart = this._slider.maximumValue = lengthSeconds
		this._slider.value = currentSeconds
	}

	// Use polling to update position when only shown
	_trackPosition() {
		this._slider.reactive = this._player.canSeek
		if (this._shown && !this._dragging) {
			this._player.position
				.then(this._updatePosition.bind(this))
				.catch(logger.error)
		}
		return GLib.SOURCE_CONTINUE;
	}
	_dropTracker() {
		if (this._positionTracker === null) return
		GLib.source_remove(this._positionTracker)
		this._positionTracker = null
	}
	_createTracker() {
		this._positionTracker = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, this._trackPosition.bind(this))
		GLib.source_set_name_by_id(
			this._positionTracker,
			"[quick-settings-tweaks] ProgressControl._createTracker: this._positionTracker"
		)
	}
	_updateTracker() {
		if (this.mapped) this._createTracker()
		else this._dropTracker()
		this._updateStatus(true)
	}

	// Seconds => HH:MM:SS or MM:SS
	_formatSeconds(seconds: number) {
		const minutes = Math.floor(seconds / 60) % 60
		const hours = Math.floor(seconds / 3600) % 60
		seconds %= 60

		const secondsPadded = seconds.toString().padStart(2, "0")
		const minutesPadded = minutes.toString().padStart(2, "0")

		if (hours > 0) return `${hours}:${minutesPadded}:${secondsPadded}`
		return `${minutes}:${secondsPadded}`
	}
}
GObject.registerClass(ProgressControl)
// #endregion ProgressControl

// #region Player
class Player extends Mpris.MprisPlayer {
	_length: number | null
	_propertiesProxy: Gio.DBusProxy
	_seekProxy: Gio.DBusProxy
	_isPropertiesProxyReady: boolean
	_canSeek: boolean
	_trackid: string

	constructor(busName: string) {
		super(busName)

		// Create properties proxy for Position & CanSeek
		const propertiesIface = Global.GetDbusInterface("media/dbus.xml","org.freedesktop.DBus.Properties")
		Gio.DBusProxy.new(
			Gio.DBus.session,
			Gio.DBusProxyFlags.NONE,
			propertiesIface,
			busName,
			"/org/mpris/MediaPlayer2",
			propertiesIface.name,
			null,
		)
		// @ts-expect-error
		.then((proxy: Gio.DbusProxy) => this._propertiesProxy = proxy)
		.catch(logger.error)

		// Create proxy for seeking
		const seekIface = Global.GetDbusInterface("media/dbus.xml","org.mpris.MediaPlayer2.Player")
		Gio.DBusProxy.new(
			Gio.DBus.session,
			Gio.DBusProxyFlags.NONE,
			seekIface,
			busName,
			"/org/mpris/MediaPlayer2",
			seekIface.name,
			null,
		)
		// @ts-expect-error
		.then((proxy: Gio.DbusProxy) => this._seekProxy = proxy)
		.catch(logger.error)
	}

	get position(): Promise<number|null> {
		return this._propertiesProxy.GetAsync(
			"org.mpris.MediaPlayer2.Player",
			"Position"
		).then((result: any) => {
			return result[0].get_int64()
		}).catch(()=> null)
	}
	set position(value: number) {
		this._seekProxy.SetPositionAsync(
			this.trackId,
			Math.min(this.length, Math.max(1, value))
		).catch(logger.error)
	}
	get trackId(): string {
		return this._trackid
	}
	get canSeek(): boolean {
		return this._canSeek
	}
	get length(): number|null {
		return this._length
	}
	_updateState() {
		this._trackid = null
		this._length = null
		try {
			const metadata = (this as any)._playerProxy.Metadata
			this._trackid = metadata?.["mpris:trackid"]?.get_string()[0]
			this._length = metadata?.["mpris:length"]?.get_int64() ?? null
		} catch {}

		this._propertiesProxy.GetAsync(
			"org.mpris.MediaPlayer2.Player",
			"CanSeek"
		).catch(()=>{
			this._canSeek = false
		}).then((result: any) => {
			this._canSeek = result[0].get_boolean()
		}).catch(()=>{
			this._canSeek = false
		}).finally(()=>{
			super._updateState()
		})
	}

	_close() {
		this._propertiesProxy = null
		this._seekProxy = null
		super._close()
	}
}
// #endregion Player

// #region MediaItem
class MediaItem extends Mpris.MediaMessage {
	_player: Player

	constructor({ player, showProgress }: { player: Player, showProgress: boolean }) {
		super(player)
		if (showProgress) this.child.add_child(new ProgressControl(player))
	}
}
GObject.registerClass(MediaItem)
// #endregion MediaItem

// #region MediaList
namespace MediaList {
	export type Options = Partial<{
		showProgress: boolean
	} & St.BoxLayout.ConstructorProps>
}
class MediaList extends Mpris.MediaSection {
	_options: MediaList.Options
	_messages: MediaItem[]
	_current: MediaItem
	_currentMaxPage: number
	_currentPage: number

	get page(): number {
		return this._currentPage
	}
	get maxPage(): number {
		return this._currentMaxPage
	}

	constructor(options: MediaList.Options) {
		// @ts-ignore
		super(options)
	}
	_init(options?: MediaList.Options): void {
		super._init()
		this._current = null
		this._options = options ?? {}
		this._currentMaxPage = 0
		this._currentPage = 0
	}

	// Override for custom message and player
	// See: https://github.com/GNOME/gnome-shell/blob/c58b826788f99bc783c36fa44e0e669dee638f0e/js/ui/mpris.js#L264
	_addPlayer(busName: string) {
		if (this._players.get(busName))
			return

		let player = new Player(busName)
		let message = null
		player.connect("closed",() => {
			this._players.delete(busName)
			return false
		})
		player.connect("show", () => {
			message = new MediaItem({
				player,
				showProgress: this._options.showProgress,
			}) // modified
			this.addMessage(message, true)
			return false
		})
		player.connect("hide", () => {
			this.removeMessage(message, true)
			message = null
			return false
		})

		this._players.set(busName, player)
	}

	// Show first playing message
	_showFirstPlaying() {
		const messages = this._messages
		this._setPage(
			messages.find(message => message?._player.status === "Playing")
			?? messages[0]
		)
	}

	// Handle page action
	_setPage(to: MediaItem) {
		const current = this._current
		const messages = this._messages
		this._current = to
		if (!to || to == current) return
		for (const message of messages) {
			message.remove_all_transitions()
			if (message == current) continue
			message.hide()
		}
		const toIndex = messages.findIndex(message => message == to)
		this._currentPage = toIndex
		this.emit("page-updated", toIndex)
		if (!current) {
			to.show()
			return
		}
		const currentIndex = messages.findIndex(message => message == current)

		// @ts-expect-error
		current.ease({
			opacity: 0,
			translationX: toIndex > currentIndex ? -120 : 120,
			duration: 120,
			onComplete: ()=>{
				current.hide()
				to.opacity = 0
				to.translationX = toIndex > currentIndex ? 120 : -120
				to.show()
				// @ts-expect-error
				to.ease({
					duration: 120,
					translationX: 0,
					opacity: 255,
					onStopped: ()=>{
						if (!this._messages.includes(to)) return
						to.opacity = 255
						to.translationX = 0
					}
				})
			},
			onStopped: ()=>{
				if (!this._messages.includes(current)) return
				current.opacity = 255
				current.translationX = 0
			}
		})
	}
	_seekPage(offset: number) {
		const messages = this._messages
		if (this._current === null) return
		let currentIndex = messages.findIndex(message => message == this._current)
		if (currentIndex == -1) currentIndex = 0
		const length = messages.length
		this._setPage(messages[((currentIndex + offset + length) % length)])
	}

	// New message / Remove message
	_sync() {
		// @ts-expect-error
		super._sync()
		const messages = this._messages

		// Emit max page update
		if (this._currentMaxPage != messages.length) {
			this.emit("max-page-updated",
				this._currentMaxPage = messages.length
			)
		}

		// Current message destroyed
		if (this._current && (this.empty || !messages.includes(this._current))) {
			this._current = null
		}

		// Hide new message
		for (const message of messages) {
			if (message == this._current) continue
			message.hide()
		}

		// Show first playing message if nothing shown
		if (!this._current) {
			this._showFirstPlaying()
		}
	}
}
GObject.registerClass({
	Signals: {
		"page-updated": {param_types: [GObject.TYPE_INT]},
		"max-page-updated": {param_types: [GObject.TYPE_INT]},
	}
}, MediaList)
// #endregion MediaList

// #region Header
namespace Header {   
	export type Options = Partial<{
	} & St.BoxLayout.ConstructorProps>
}
class Header extends St.BoxLayout {
	_headerLabel: St.Label
	_pageIndicator: St.BoxLayout

	constructor(options: Header.Options) {
		super(options)
	}
	_init(options: Header.Options) {
		super._init({
			style_class: "QSTWEAKS-header"
		} as Partial<St.BoxLayout.ConstructorProps>)

		// Label
		this._headerLabel = new St.Label({
			text: _("Media"),
			style_class: "QSTWEAKS-header-label",
			y_align: Clutter.ActorAlign.CENTER,
			x_align: Clutter.ActorAlign.START,
			x_expand: true
		})
		this.add_child(this._headerLabel)

		this._pageIndicator = new PageIndicators(Clutter.Orientation.HORIZONTAL)
		this._pageIndicator.x_align = Clutter.ActorAlign.END
		this._pageIndicator.connect("page-activated", this.emit.bind(this, "page-activated"))
		this._pageIndicator.y_align = Clutter.ActorAlign.CENTER
		this.add_child(this._pageIndicator)
	}

	set maxPage(maxPage: number) {
		(this._pageIndicator as any).setNPages(maxPage)
	}
	get maxPage(): number {
		return (this._pageIndicator as any).nPages
	}
	set page(page: number) {
		(this._pageIndicator as any).setCurrentPosition(page)
	}
	get page(): number {
		return (this._pageIndicator as any)._currentPosition
	}
}
GObject.registerClass({
	Signals: {
		"page-activated": {param_types: [GObject.TYPE_INT]},
	}
}, Header)
// #endregion Header

// #region MediaWidget
namespace MediaWidget {
	export type Options = Partial<{
		showProgress: boolean
	} & St.BoxLayout.ConstructorProps>
}
class MediaWidget extends St.BoxLayout {
	_options: MediaWidget.Options
	_scroll: St.ScrollView
	_list: MediaList
	_header: Header
	_sections: St.BoxLayout

	constructor(options: MediaWidget.Options) {
		super(options)
	}
	_init(options: MediaWidget.Options) {
		super._init({
			vertical: true,
			x_expand: true,
			y_expand: true,
			reactive: true,
		} as Partial<St.BoxLayout.ConstructorProps>)
		this._options = options

		// Create header
		this._header = new Header({})
		this.add_child(this._header)

		// Create list
		this._list = new MediaList({ showProgress: options.showProgress })
		this.add_child(this._list)
		this._list.connect("notify::empty", this._syncEmpty.bind(this))
		this._syncEmpty()

		// Page navigation
		this.connect("scroll-event", (_: Clutter.Actor, event: Clutter.Event) => {
			const direction = event.get_scroll_direction();
			if (direction === Clutter.ScrollDirection.UP) {
				this._list._seekPage(-1)
			}
			if (direction === Clutter.ScrollDirection.DOWN) {
				this._list._seekPage(1)
			}
		})
		const swipeAction = new Clutter.SwipeAction()
		swipeAction.connect("swipe", (_, __, direction) => {
			if (direction === Clutter.SwipeDirection.RIGHT) {
				this._list._seekPage(-1)
			}

			if (direction === Clutter.SwipeDirection.LEFT) {
				this._list._seekPage(1)
			}
		})
		this.add_action(swipeAction)

		// Sync page update & page indicator
		this._header.page = this._list.page
		this._header.maxPage = this._list.maxPage
		const pageConnection = this._list.connect("page-updated", (_, page: number): void => {
			if (this._header.page == page) return
			this._header.page = page
		})
		const maxPageConnection = this._list.connect("max-page-updated", (_, maxPage: number): void => {
			if (this._header.maxPage == maxPage) return
			this._header.maxPage = maxPage
		})
		this.connect("destroy", ()=>{
			this._list.disconnect(pageConnection)
			this._list.disconnect(maxPageConnection)
		})
	}

	_syncEmpty() {
		this.visible = !this._list.empty
	}
}
GObject.registerClass(MediaWidget)
export { MediaWidget }
// #endregion MediaWidget

// #region MediaWidgetFeature
export class MediaWidgetFeature extends FeatureBase {
	// #region settings
	enabled: boolean
	compact: boolean
	showProgress: boolean
	removeShadow: boolean
	override loadSettings(loader: SettingLoader): void {
		this.enabled = loader.loadBoolean("media-enabled")
		this.compact = loader.loadBoolean("media-compact")
		this.showProgress = loader.loadBoolean("media-show-progress")
		this.removeShadow = loader.loadBoolean("media-remove-shadow")
	}
	// #endregion settings

	mediaWidget?: MediaWidget
	updateStyleClass() {
		let style = "QSTWEAKS-media"
		if (this.compact) style += " QSTWEAKS-message-compact"
		if (this.removeShadow) style += " QSTWEAKS-message-remove-shadow"
		this.mediaWidget.style_class = style
	}

	override reload(key: string): void {
		switch (key) {
			case "media-compact":
			case "media-remove-shadow":
				this.updateStyleClass()
				break
			default:
				super.reload()
				break
		}
	}
	override onLoad(): void {
		if (!this.enabled) return
		this.maid.destroyJob(
			this.mediaWidget = new MediaWidget({
				showProgress: this.showProgress
			})
		)

		Global.QuickSettingsGrid.add_child(this.mediaWidget)
		Global.QuickSettingsGrid.layout_manager.child_set_property(
			Global.QuickSettingsGrid, this.mediaWidget, "column-span", 2
		)

		this.updateStyleClass()
	}
	override onUnload(): void {
		this.mediaWidget = null
	}
}
// #endregion MediaWidgetFeature
