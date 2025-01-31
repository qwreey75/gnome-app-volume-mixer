import Clutter from "gi://Clutter"
import GObject from "gi://GObject"
import St from "gi://St"
import { FeatureBase, type SettingLoader } from "../../libs/feature.js"
import { Global } from "../../global.js"

// #region Header
namespace Header {   
	export type Options = Partial<{
	} & St.BoxLayout.ConstructorProps>
}
class Header extends St.BoxLayout {
	_headerLabel: St.Label
	_locationLabel: St.Label

	constructor(options: Header.Options) {
		super(options)
	}
	_init(_options: Header.Options) {
		super._init({
			style_class: "QSTWEAKS-header"
		} as Partial<St.BoxLayout.ConstructorProps>)

		// Label
		this._headerLabel = new St.Label({
			text: _("Weather"),
			style_class: "QSTWEAKS-header-label",
			y_align: Clutter.ActorAlign.CENTER,
			x_align: Clutter.ActorAlign.START,
			x_expand: true,
		})
		this._locationLabel = new St.Label({
			style_class: "QSTWEAKS-location-label",
			y_align: Clutter.ActorAlign.CENTER,
			opacity: 190,
		})
		this.add_child(this._headerLabel)
		this.add_child(this._locationLabel)
	}
}
GObject.registerClass(Header)
// #endregion Header

// #region WeatherWidget
class WeatherWidget extends St.BoxLayout {
	_item: St.Button
	_header: Header
	_init() {
		super._init({
			vertical: true,
		})

		this.add_child(
			this._header = new Header({})
		)
		this.add_child(
			this._item = new (Global.DateMenu as any)._weatherItem.constructor()
		)
		this._item.connect("clicked", ()=>(Global.QuickSettingsMenu as any).close())
		this._item.styleClass += " message";

		// Hide Location
		(this._item as any)._titleLocation.hide();
		(this._item as any)._titleLocation.connect("show", ()=>{
			(this._item as any)._titleLocation.hide()
		})

		// Hide Title
		const syncTitleVisible = ()=>{
			(this._item as any)._titleLabel.visible = !(this._item as any)._weatherClient.hasLocation
		}
		syncTitleVisible();
		(this._item as any)._weatherClient.connect("changed", syncTitleVisible);

		// Sync Location
		(this._item as any)._titleLocation.bind_property("text",
			this._header._locationLabel, "text",
			GObject.BindingFlags.DEFAULT)
		this._header._locationLabel.text = (this._item as any)._titleLocation.text
	}
}
GObject.registerClass(WeatherWidget)
export { WeatherWidget }
// #endregion WeatherWidget

// #region WeatherWidgetFeature
export class WeatherWidgetFeature extends FeatureBase {
	// #region settings
	enabled: boolean
	compact: boolean
	removeShadow: boolean
	override loadSettings(loader: SettingLoader): void {
		this.enabled = loader.loadBoolean("weather-enabled")
		this.removeShadow = loader.loadBoolean("weather-remove-shadow")
		this.compact = loader.loadBoolean("weather-compact")
	}
	// #endregion settings

	weatherWidget: WeatherWidget
	updateStyleClass() {
		let style = "QSTWEAKS-weather"
		if (this.removeShadow) style += " QSTWEAKS-weather-remove-shadow"
		if (this.compact) style += " QSTWEAKS-weather-compact"
		this.weatherWidget.styleClass = style
	}

	override reload(key: string): void {
		switch (key) {
			case "weather-remove-shadow":
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
			this.weatherWidget = new WeatherWidget()
		)
		this.updateStyleClass()

		Global.QuickSettingsGrid.add_child(this.weatherWidget)
		Global.QuickSettingsGrid.layout_manager.child_set_property(
			Global.QuickSettingsGrid, this.weatherWidget, "column-span", 2
		)
	}
	override onUnload(): void {
		this.weatherWidget = null
	}
}
// #endregion WeatherWidgetFeature
