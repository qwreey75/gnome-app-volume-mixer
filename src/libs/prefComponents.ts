
import Adw from "gi://Adw"
import Gio from "gi://Gio"
import Gtk from "gi://Gtk"
import Gdk from "gi://Gdk"
import GLib from "gi://GLib"
import GObject from "gi://GObject"
import { gettext as _ } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js"

function addChildren(target: any, funcName: string, children?: any[]) {
	if (!children) return
	for (const item of children) {
		if (!item) continue
		target[funcName](item)
	}
}

function setLinkCursor(target: any) {
	target.cursor = Gdk.Cursor.new_from_name("pointer", null)
}

export function setScrollToFocus(target: Adw.PreferencesPage, value: boolean) {
	const viewport: Gtk.Viewport = target
		.get_first_child() // GtkScrolledWindow
		.get_first_child() as any // GtkViewport
	viewport.scrollToFocus = value
}
export function delayedSetScrollToFocus(target: Adw.PreferencesPage, value: boolean) {
	const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10, ()=>{
		setScrollToFocus(target, value)
		return GLib.SOURCE_REMOVE
	})
	GLib.source_set_name_by_id(id, "[quick-settings-tweaks] delayedSetScrollToFocus: id")
}
// Fix adwaita scroll flicking issue
export function fixPageScrollIssue(page: Adw.PreferencesPage) {
	page.connect("unmap", ()=>{
		setScrollToFocus(page, false)
	})
	page.connect("map", ()=>{
		delayedSetScrollToFocus(page, true)
	})
}

// #region Dialog
export function Dialog({
	window,
	title,
	minHeight,
	childrenRequest,
}: Dialog.Options): Adw.PreferencesDialog {
	const dialog = new Dialog.PrefDialog(title, childrenRequest)
	if (minHeight) dialog.height_request = minHeight
	dialog.present(window)
	return dialog
}
export namespace Dialog {
	export type ChildrenRequest = (page: Adw.PreferencesPage, dialog: Adw.PreferencesDialog)=>any
	export interface Options {
		title?: string
		minHeight?: number
		childrenRequest: ChildrenRequest
		window: Adw.PreferencesWindow
	}
	export const PrefDialogPage = GObject.registerClass({
		GTypeName: "qwreey-pref-components-PrefDialogPage",
	}, class PrefDialogPage extends Adw.PreferencesPage {
		constructor(childrenRequest: ChildrenRequest, dialog: Adw.PreferencesDialog, title?: string) {
			super({
				name: "PrefDialogPage",
			})
			if (title) {
				this.title = title
			}
			addChildren(this, "add", childrenRequest(this, dialog))
		}
	})
	export const PrefDialog = GObject.registerClass({
		GTypeName: "qwreey-pref-components-PrefDialog",
	}, class PrefDialog extends Adw.PreferencesDialog {
		constructor(title: string, childrenRequest: ChildrenRequest) {
			super({
				title: title ?? "",
				search_enabled: true,
				presentation_mode: Adw.DialogPresentationMode.BOTTOM_SHEET,
			})
			this.add(new PrefDialogPage(childrenRequest, this))
		}
	})
	export function StackedPage({ title, dialog, childrenRequest }: {
		title: string,
		dialog: Adw.PreferencesDialog,
		childrenRequest: ChildrenRequest,
	}): Adw.NavigationPage {
		const page = new Adw.NavigationPage({
			title: title,
			can_pop: true,
		})
		const view = page.child = new Adw.ToolbarView()
		view.add_top_bar(new Adw.HeaderBar())
		view.content = new Dialog.PrefDialogPage(childrenRequest, dialog)
		dialog.push_subpage(page)
		return page
	}
}
// #endregion Dialog

// #region ExperimentalIcon
export function ExperimentalIcon(options?: ExperimentalIcon.Options): Gtk.Image {
	return new Gtk.Image({
		css_classes: ["icon"],
		icon_name: "applications-science-symbolic",
		pixel_size: options?.pixelSize ?? 16,
		margin_end: options?.marginEnd ?? 4,
		margin_start: options?.marginStart ?? 2,
		opacity: 0.8,
		has_tooltip: true,
		tooltip_text: _("This feature marked as experimental"),
	})
}
export namespace ExperimentalIcon {
	export interface Options {
		marginEnd?: number
		marginStart?: number
		pixelSize?: number
	}
	export function prependExperimentalIcon(holder: Gtk.Widget, options?: ExperimentalIcon.Options) {
		ExperimentalIcon(options).insert_before(holder,holder.get_first_child())
	}
}
// #endregion ExperimentalIcon

// #region Group
export function Group(options: Group.Options, children?: any[]): Adw.PreferencesGroup {
	options.title ??= ""
	const { experimental, parent, onCreated, nesting } = options
	delete options.parent
	delete options.experimental
	delete options.onCreated
	delete options.nesting
	const target = new Adw.PreferencesGroup(options)
	if (nesting) target.marginTop = 14
	if (experimental) ExperimentalIcon.prependExperimentalIcon(
		target.get_first_child().get_first_child(),
		{ marginEnd: 18, marginStart: 4, pixelSize: 20 }
	)
	addChildren(target, "add", children)
	if (parent) parent.add(target)
	if (onCreated) onCreated(target)
	return target
}
export namespace Group {
	export type Options = Partial<Adw.PreferencesGroup.ConstructorProps & {
		parent: any,
		experimental: boolean,
		nesting: boolean,
		onCreated?: (row: Adw.PreferencesGroup)=>void,
	}>
}
// #endregion Group

// #region Row
export function Row({
	settings,
	parent,
	title,
	subtitle,
	uri,
	icon,
	sensitiveBind,
	suffix,
	prefix,
	experimental,
	noLinkIcon,
	action,
	onCreated,
}: Row.Options): Adw.ActionRow {
	const row = new Adw.ActionRow({
		title: title ?? null,
		subtitle: subtitle ?? null,
		activatable: (!!uri) || (!!action),
	})
	if (parent) {
		parent.add(row)
	}
	if (uri) {
		row.connect("activated", ()=>{
			Gio.AppInfo.launch_default_for_uri_async(uri, null, null, null)
		})
		setLinkCursor(row)
		if (!noLinkIcon) Row.addSuffixIcon(row, "adw-external-link-symbolic")
		row.tooltip_text = uri
		row.has_tooltip = true
	}
	if (action) {
		row.connect("activated", ()=>action())
		setLinkCursor(row)
		if (!noLinkIcon) Row.addSuffixIcon(row, "go-next-symbolic")
	}
	if (icon) Row.appendLinkIcon(row, icon)
	if (suffix) {
		row.add_suffix(suffix)
	}
	if (prefix) {
		row.add_prefix(prefix)
	}
	if (sensitiveBind) {
		settings.bind(
			sensitiveBind,
			row, "sensitive",
			Gio.SettingsBindFlags.DEFAULT
		)
		row.sensitive = settings.get_boolean(sensitiveBind)
	}
	if (experimental) ExperimentalIcon.prependExperimentalIcon(row.child)
	if (onCreated) onCreated(row)
	return row
}
export namespace Row {
	export interface Options {
		parent?: any
		title?: string
		subtitle?: string
		uri?: string
		icon?: string
		settings?: Gio.Settings
		sensitiveBind?: string
		suffix?: Gtk.Widget
		prefix?: Gtk.Widget
		experimental?: boolean
		noLinkIcon?: boolean,
		action?: ()=>void
		onCreated?: (row: Adw.ActionRow)=>void
	}
	export function appendLinkIcon(row: any, name: string) {
		const linkText = row.child.get_first_child()
		linkText.margin_start = 32
		const image = new Gtk.Image({
			css_classes: ["icon"],
			icon_name: name,
			pixel_size: 20,
			margin_start: 2,
			margin_end: 2,
			halign: Gtk.Align.START,
		})
		image.insert_before(row.child, linkText)
	}
	export function addSuffixIcon(row: Adw.ActionRow, name: string) {
		row.add_suffix(new Gtk.Image({
			css_classes: ["icon"],
			icon_name: name,
			pixel_size: 16,
			margin_end: 4,
			valign: Gtk.Align.CENTER,
		}))
	}
}
// #endregion Row

// #region DialogRow
export function DialogRow(options: DialogRow.Options): Adw.ActionRow {
	return Row({
		...options,
		action: () => {
			const dialog = Dialog({
				...options,
				title: options.dialogTitle,
			})
			if (options.onDialogCreated) {
				options.onDialogCreated(dialog)
			}
		}
	})
}
export namespace DialogRow {
	export interface Options extends Dialog.Options, Row.Options {
		dialogTitle?: string
		onDialogCreated?: (dialog: Adw.PreferencesDialog)=>void
	}
}
// #endregion DialogRow

// #region ResetButton
export function ResetButton(options: ResetButton.Options): Gtk.Box {
	const { settings, bind } = options
	options.iconName ??= "view-refresh-symbolic"
	const box = Button({
		...options,
		onCreated: null,
	})
	box.halign = Gtk.Align.END
	const button: Gtk.Button = box.get_first_child() as any
	button.valign = Gtk.Align.CENTER
	button.has_frame = false
	button.tooltip_text = _("Reset to default")
	button.connect("clicked", ()=>settings.reset(bind))
	const image: Gtk.Image = button.get_first_child() as any
	image.pixel_size = 12
	image.opacity = 0.75
	const setVisible = ()=>{
		const state = ResetButton.getOptionState(settings, bind)
		box.visible = options.dontHideWhenMatch ? state.isSet : (!state.isMatch)
	}
	const settingsConnection = settings.connect(`changed::${bind}`, setVisible)
	setVisible()
	box.connect("destroy", ()=>{
		settings.disconnect(settingsConnection)
	})
	return box
}
export namespace ResetButton {
	export interface Options extends Button.OptionsBase {
		bind: string,
		dontHideWhenMatch?: boolean
	}
	export function getOptionState(settings: Gio.Settings, key: string): {
		isMatch: boolean,
		isSet: boolean,
	} {
		const userValue = settings.get_user_value(key)
		const defaultValue = settings.get_default_value(key)
		return {
			isSet: userValue != null,
			isMatch:
				(userValue == null)
				|| (userValue && defaultValue && userValue.equal(defaultValue)),
		}
	}
	export function pushResetButton(row_with_suffix: Adw.ActionRow, options: ResetButton.Options) {
		const suffixes = row_with_suffix
		.get_first_child() // GtkBox header
		.get_last_child() // GtkBox suffixes

		ResetButton(options)
		.insert_before(
			suffixes, suffixes.get_first_child()
		)
	}
}
// #endregion ResetButton

// #region SwitchRow
export function SwitchRow({
	bind,
	parent,
	value,
	title,
	subtitle,
	action,
	sensitiveBind,
	settings,
	experimental,
	noResetButton,
	onCreated,
}: SwitchRow.Options): Adw.SwitchRow {
	if (bind) value ??= settings.get_boolean(bind)

	const row = new Adw.SwitchRow({
		title: title ?? "",
		subtitle: subtitle ?? null,
		active: value,
	})
	setLinkCursor(row)

	if (action) {
		row.connect("notify::active", () => action(row.get_active()))
	}

	if (parent) {
		parent.add(row)
	}

	if (bind) {
		settings.bind(
			bind,
			row, "active",
			Gio.SettingsBindFlags.DEFAULT
		)
		if (!noResetButton) ResetButton.pushResetButton(row, { settings, bind })
	}

	if (sensitiveBind) {
		settings.bind(
			sensitiveBind,
			row, "sensitive",
			Gio.SettingsBindFlags.DEFAULT
		)
		row.sensitive = settings.get_boolean(sensitiveBind)
	}
	if (experimental) ExperimentalIcon.prependExperimentalIcon(row.child)
	if (onCreated) onCreated(row)

	return row
}
export namespace SwitchRow {
	export interface Options {
		settings?: Gio.Settings
		value?: boolean
		bind?: string
		parent?: any
		title?: string
		subtitle?: string
		action?: (value: boolean)=>void
		sensitiveBind?: string
		experimental?: boolean
		noResetButton?: boolean
		onCreated?: (row: Adw.SwitchRow)=>void
	}
}
// #endregion SwitchRow

// #region ToggleButtonRow
export function ToggleButtonRow({
	bind,
	parent,
	value,
	title,
	subtitle,
	action,
	sensitiveBind,
	settings,
	experimental,
	text,
	noResetButton,
	onCreated,
}: ToggleButtonRow.Options): Adw.ActionRow {
	if (bind) value ??= settings.get_boolean(bind)

	const row = new Adw.ActionRow({
		title: title ?? "",
		subtitle: subtitle ?? null,
	})
	const box = new Gtk.Box({
		margin_bottom: 8,
		margin_top: 8,
	})
	const toggle = new Gtk.ToggleButton({
		label: text,
		active: value,
	})
	box.insert_child_after(toggle, null)
	row.add_suffix(box)
	setLinkCursor(row)

	if (action) {
		toggle.connect("notify::active", () => action(toggle.get_active()))
	}

	if (parent) {
		parent.add(row)
	}

	if (bind) {
		settings.bind(
			bind,
			toggle, "active",
			Gio.SettingsBindFlags.DEFAULT
		)
		if (!noResetButton) ResetButton.pushResetButton(row, { settings, bind })
	}

	if (sensitiveBind) {
		settings.bind(
			sensitiveBind,
			row, "sensitive",
			Gio.SettingsBindFlags.DEFAULT
		)
		row.sensitive = settings.get_boolean(sensitiveBind)
		settings.bind(
			sensitiveBind,
			toggle, "sensitive",
			Gio.SettingsBindFlags.DEFAULT
		)
		toggle.sensitive = settings.get_boolean(sensitiveBind)
	}
	if (experimental) ExperimentalIcon.prependExperimentalIcon(row.child)
	if (onCreated) onCreated(row)

	return row
}
export namespace ToggleButtonRow {
	export interface Options {
		settings?: Gio.Settings
		value?: boolean
		bind?: string
		parent?: any
		title?: string
		subtitle?: string
		action?: (value: boolean)=>void
		sensitiveBind?: string
		experimental?: boolean
		text?: string
		noResetButton?: boolean
		onCreated?: (row: Adw.ActionRow)=>void
	}
}
// #endregion ToggleButtonRow

// #region Button
export function Button({
	parent,
	action,
	sensitiveBind,
	settings,
	text,
	marginTop,
	marginBottom,
	iconName,
	onCreated,
}: Button.Options): Gtk.Box {
	const box = new Gtk.Box({
		margin_bottom: marginBottom ?? 8,
		margin_top: marginTop ?? 8,
	})
	const button = new Gtk.Button()
	box.insert_child_after(button, null)
	setLinkCursor(button)
	if (iconName) {
		button.icon_name = iconName
	}
	if (text) {
		button.label = text
	}

	if (action) {
		button.connect("activate", () => action())
	}

	if (parent) {
		parent.add(box)
	}

	if (sensitiveBind) {
		settings.bind(
			sensitiveBind,
			button, "sensitive",
			Gio.SettingsBindFlags.DEFAULT
		)
		button.sensitive = settings.get_boolean(sensitiveBind)
	}
	if (onCreated) onCreated(box)

	return box
}
export namespace Button {
	export interface Options extends OptionsBase {
		onCreated?: (row: Gtk.Box)=>void
	}
	export interface OptionsBase {
		settings?: Gio.Settings
		parent?: any
		action?: ()=>void
		sensitiveBind?: string
		text?: string
		marginTop?: number
		marginBottom?: number
		iconName?: string
	}
}
// #endregion Button

// #region ButtonRow
export function ButtonRow(options: ButtonRow.Options): Adw.ActionRow {
	const {
		parent,
		title,
		subtitle,
		experimental,
		onCreated,
	} = options
	const row = new Adw.ActionRow({
		title: title ?? "",
		subtitle: subtitle ?? null,
	})
	setLinkCursor(row)
	row.add_suffix(Button({
		...options,
		onCreated: null,
	}))

	if (parent) {
		parent.add(row)
	}

	if (experimental) ExperimentalIcon.prependExperimentalIcon(row.child)
	if (onCreated) onCreated(row)

	return row
}
export namespace ButtonRow {
	export interface Options extends Button.OptionsBase {
		settings?: Gio.Settings
		parent?: any
		title?: string
		subtitle?: string
		action?: ()=>void
		sensitiveBind?: string
		experimental?: boolean
		text?: string
		marginTop?: number
		marginBottom?: number
		onCreated?: (row: Adw.ActionRow)=>void
	}
}
// #endregion ButtonRow

// #region UpDownButton
export function UpDownButton({
	parent,
	action,
	sensitiveBind,
	settings,
	marginTop,
	marginBottom,
	spacing,
	onCreated,
}: UpDownButton.Options): Gtk.Box {
	const box = new Gtk.Box({
		margin_bottom: marginTop ?? 8,
		margin_top: marginBottom ?? 8,
		spacing: spacing ?? 8
	})
	const down = new Gtk.Button({
		icon_name: "go-down-symbolic"
	})
	const up = new Gtk.Button({
		icon_name: "go-up-symbolic"
	})
	setLinkCursor(up)
	setLinkCursor(down)
	box.insert_child_after(up, null)
	box.insert_child_after(down, up)

	if (action) {
		down.connect("clicked", () => action(UpDownButton.Direction.Down))
		up.connect("clicked", () => action(UpDownButton.Direction.Up))
	}

	if (parent) {
		parent.add(box)
	}

	if (sensitiveBind) {
		settings.bind(
			sensitiveBind,
			up, "sensitive",
			Gio.SettingsBindFlags.DEFAULT
		)
		up.sensitive = settings.get_boolean(sensitiveBind)
		settings.bind(
			sensitiveBind,
			down, "sensitive",
			Gio.SettingsBindFlags.DEFAULT
		)
		down.sensitive = settings.get_boolean(sensitiveBind)
	}
	if (onCreated) onCreated(box)

	return box
}
export namespace UpDownButton {
	export interface Options {
		settings?: Gio.Settings
		parent?: any
		marginTop?: number
		marginBottom?: number
		spacing?: number
		action?: (direction: Direction)=>void
		sensitiveBind?: string
		onCreated?: (row: Gtk.Box)=>void
	}
	export enum Direction {
		Up,
		Down,
	}
}
// #endregion UpDownButton

// #region AdjustmentRow
export function AdjustmentRow({
	max,
	min,
	stepIncrement,
	pageIncrement,
	bind,
	parent,
	value,
	title,
	subtitle,
	action,
	sensitiveBind,
	settings,
	experimental,
	noResetButton,
	onCreated,
}: AdjustmentRow.Options): Adw.SpinRow {
	if (bind) value ??= settings.get_int(bind)

	const row = new Adw.SpinRow({
		title: title ?? "",
		subtitle: subtitle ?? null,
		adjustment: new Gtk.Adjustment({
			upper: max ?? 100,
			lower: min ?? 0,
			stepIncrement: stepIncrement ?? 1,
			pageIncrement: pageIncrement ?? 10,
			value: value
		}),
	})
	setLinkCursor(row)
	const header = row
	.get_first_child() // GtkBox header
	const suffixes = header
	.get_last_child() // GtkBox suffixes
	const spin = suffixes
	.get_first_child() // GtkSpinButton spin_button
	spin.hexpand = false
	suffixes.hexpand = false
	new Gtk.Box({ hexpand: true }).insert_before(header, suffixes)

	if (action) {
		row.connect("notify::value", () => {
			action(row.get_value())
		})
	}

	if (parent) {
		parent.add(row)
	}

	if (bind) {
		settings.bind(
			bind,
			row, "value",
			Gio.SettingsBindFlags.DEFAULT
		)
		if (!noResetButton) ResetButton.pushResetButton(row, { settings, bind })
	}

	if (sensitiveBind) {
		settings.bind(
			sensitiveBind,
			row, "sensitive",
			Gio.SettingsBindFlags.DEFAULT
		)
		row.sensitive = settings.get_boolean(sensitiveBind)
	}
	if (experimental) ExperimentalIcon.prependExperimentalIcon(row.child)
	if (onCreated) onCreated(row)

	return row
}
export namespace AdjustmentRow {
	export interface Options {
		settings?: Gio.Settings
		max?: number
		min?: number
		stepIncrement?: number
		pageIncrement?: number
		bind?: string
		parent?: any
		value?: number
		title?: string
		subtitle?: string
		action?: (value: number)=>void
		sensitiveBind?: string
		experimental?: boolean
		noResetButton?: boolean
		onCreated?: (row: Adw.SpinRow)=>void
	}
}
// #endregion AdjustmentRow

// #region ExpanderRow
export function ExpanderRow({
	parent,
	title,
	subtitle,
	expanded,
	experimental,
	action,
	onCreated,
}: ExpanderRow.Options, children?: any[]): Adw.ExpanderRow {
	const row = new Adw.ExpanderRow({
		title: title ?? null,
		subtitle: subtitle ?? null,
	})
	setLinkCursor(row)
	if (parent) {
		parent.add(row)
	}
	addChildren(row, "add_row", children)
	if (expanded === false || expanded === true) {
		row.expanded = expanded
	}
	if (action) row.connect("notify::expanded", ()=>action(row.expanded))
	if (experimental) ExperimentalIcon.prependExperimentalIcon(row.child)
	if (onCreated) onCreated(row)
	return row
}
export namespace ExpanderRow {
	export interface Options {
		parent?: any
		title?: string
		subtitle?: string
		expanded?: boolean
		experimental?: boolean
		action?: (expanded: boolean)=>void
		onCreated?: (row: Adw.ExpanderRow)=>void
	}
}
// #endregion ExpanderRow

// #region DropdownRow
export function DropdownRow<T>({
	settings,
	items,
	bind,
	parent,
	value,
	title,
	subtitle,
	action,
	sensitiveBind,
	experimental,
	noResetButton,
	onCreated,
}: DropdownRow.Options<T>) {
	let filterModeModel = new Gio.ListStore({ item_type: DropdownRow.Items as any })
	let type: "number"|"string"
	for (const item of items) {
		type ??= (typeof item.value) as typeof type
		filterModeModel.append(new (DropdownRow.Items as any)(item.name, item.value))
	}

	const getIndex = (value: string) => {
		for (let i = 0; i < filterModeModel.get_n_items(); i++) {
			if ((filterModeModel.get_item(i) as any).value === value) {
				return i
			}
		}
		return -1
	}
	const getValueFromBind = (): any => {
		if (type == "string") {
			return settings.get_string(bind)
		}
		if (type == "number") {
			return settings.get_int(bind)
		}
	}
	const setValueFromBind = (value: any) => {
		if (type == "string") {
			settings.set_string(bind, value)
			return
		}
		if (type == "number") {
			settings.set_int(bind, value)
			return
		}
	}
	if (bind) value ??= getValueFromBind()
	
	let row = new Adw.ComboRow({
		title: title ?? "",
		subtitle: subtitle ?? null,
		model: filterModeModel,
		expression: new (Gtk.PropertyExpression as any)(DropdownRow.Items, null, "name"),
		selected: getIndex(value),
	})
	setLinkCursor(row)

	if (parent) {
		parent.add(row)
	}

	if (bind) {
		if (!noResetButton) ResetButton.pushResetButton(row, { settings, bind })
		const settingsConnection = settings.connect(`changed::${bind}`, ()=>{
			const selected = (row.selectedItem as any).value
			const changedTo = getValueFromBind()
			if (selected != changedTo) {
				row.selected = getIndex(changedTo)
			}
		})
		row.connect("destroy", ()=>settings.disconnect(settingsConnection))
	}
	if (bind || action) row.connect("notify::selected", () => {
		const selected = (row.selectedItem as any).value
		if (bind && (selected != getValueFromBind())) {
			setValueFromBind(selected)
		}
		if (action) {
			action(selected)
		}
	})
		
	if (sensitiveBind) {
		settings.bind(
			sensitiveBind,
			row, "sensitive",
			Gio.SettingsBindFlags.DEFAULT
		)
		row.sensitive = settings.get_boolean(sensitiveBind)
	}
	if (experimental) ExperimentalIcon.prependExperimentalIcon(row.child)
	if (onCreated) onCreated(row)

	return row
}
export namespace DropdownRow {
	export interface Options<T> {
		settings?: Gio.Settings
		items: { name: string, value: T }[]
		bind?: string
		parent?: any
		value?: string
		title?: string
		subtitle?: string
		sensitiveBind?: string
		action?: (value: string)=>void
		experimental?: boolean
		noResetButton?: boolean
		onCreated?: (row: Adw.ComboRow)=>void
	}
	export const Items = GObject.registerClass({
		Properties: {
			"name": GObject.ParamSpec.string(
				"name", "name", "name",
				GObject.ParamFlags.READWRITE,
				null),
		},
	}, class DropdownItems<T> extends GObject.Object {
		value: T
		_init(name: string, value: T) {
			super._init({ name })
			this.value = value
		}
	})
}
// #endregion DropdownRow

// #region ContributorsRow
export function ContributorsRow(row: ContributorsRow.Contributor[]): Adw.ActionRow {
	const target = Row({})
	const box = new Gtk.Box({
		baseline_position: Gtk.BaselinePosition.CENTER,
		homogeneous: true,
		orientation: Gtk.Orientation.HORIZONTAL,
	})
	target.set_child(box)
	for (const item of row) {
		let itemButton = new Gtk.Button({
			has_frame: false,
		})
		let itemBox = new Gtk.Box({
			baseline_position: Gtk.BaselinePosition.CENTER,
			orientation: Gtk.Orientation.VERTICAL,
			cursor: Gdk.Cursor.new_from_name("pointer", null),
		})
		itemButton.child = itemBox
		itemButton.connect("clicked", ()=>{
			Gio.AppInfo.launch_default_for_uri_async(item.link, null, null, null)
		})
		const itemImage = new Gtk.Image({
			margin_bottom: 2,
			margin_top: 2,
			icon_name: item.image,
			pixel_size: 38,
		})
		itemBox.append(itemImage)
		const nameText = new Gtk.Label({
			label: `<span size="small">${item.name}</span>`,
			useMarkup: true,
			hexpand: true,
		})
		itemBox.append(nameText)
		let labelBox = new Gtk.Box({
			baseline_position: Gtk.BaselinePosition.CENTER,
			orientation: Gtk.Orientation.VERTICAL,
			vexpand: true,
			hexpand: true,
			margin_bottom: 2,
			valign: Gtk.Align.CENTER
		})
		for (const label of item.label.split("\n")) {
			const labelText = new Gtk.Label({
				label: `<span size="small">${label}</span>`,
				useMarkup: true,
				hexpand: true,
				opacity: 0.7,
			})
			labelBox.append(labelText)
		}
		itemBox.append(labelBox)
		box.append(itemButton)
	}
	return target
}
export namespace ContributorsRow {
	export interface Contributor {
		name: string
		label: string
		link: string
		image: string
	}
}
// #endregion ContributorsRow

// #region LicenseRow
export function LicenseRow(item: LicenseRow.License): Adw.ExpanderRow {
	let contentRow: Adw.ActionRow
	let loaded = false
	return ExpanderRow({
		title: item.name,
		subtitle: `by ${item.author}`,
		expanded: false,
		action: (expanded)=>{
			if (!expanded) return
			if (loaded) return
			if (item.content) item.content().then(
				subtitle => contentRow.subtitle = subtitle
			).catch(
				error => {
					contentRow.subtitle = `ERROR: ${error}`
					log(error)
				}
			)
		}
	},[
		Row({
			title: "Homepage",
			subtitle: item.url,
			uri: item.url,
			icon: "go-home",
		}),
		item.content ? (contentRow = Row({
			title: "License",
			subtitle: "Loading . . .",
		})) : null,
		item.licenseUri ? Row({
			title: "License",
			subtitle: item.licenseUri,
			icon: "emblem-documents-symbolic",
			uri: item.licenseUri
		}) : null,
	])
}
export namespace LicenseRow {
	export interface License {
		url: string
		author: string
		name: string
		file?: string
		content?: ()=>Promise<string>
		licenseUri?: string
	}
}
// #endregion LicenseRow

// #region LogoBox
export function LogoBox({
	icon, name, version, versionAction,
}: LogoBox.Options): Gtk.Box {
	const logoBox = new Gtk.Box({
		baseline_position: Gtk.BaselinePosition.CENTER,
		margin_top: 6,
		spacing: 20,
		orientation: Gtk.Orientation.VERTICAL,
	})

	// Logo icon
	const logoImage = new Gtk.Image({
		icon_name: icon,
		pixel_size: 100,
	})
	logoBox.append(logoImage)

	// Extension name
	const logoText = new Gtk.Label({
		label: name,
		css_classes: ["title-2"],
		halign: Gtk.Align.CENTER,
	})
	logoBox.append(logoText)

	// Version
	const logoVersion = new Gtk.Button({
		css_classes: ["success"],
		label: version,
		halign: Gtk.Align.CENTER,
	})
	logoBox.append(logoVersion)
	if (versionAction) {
		logoVersion.connect("clicked", ()=>versionAction())
		setLinkCursor(logoVersion)
	}

	return logoBox
}
export namespace LogoBox {
	export interface Options {
		name: string
		version: string
		icon: string
		versionAction?: ()=>void
	}
}
// #endregion LogoBox

// #region LogoGroup
export function LogoGroup(options: LogoGroup.Options): Adw.PreferencesGroup {
	return Group({
		parent: options.parent,
	},[
		LogoBox(options),
	])
}
export namespace LogoGroup {
	export interface Options extends LogoBox.Options {
		parent: any,
	}
}
// #endregion LogoGroup

// #region ChangelogDialog
export function ChangelogDialog({
	content,
	window,
	currentBuildNumber,
	defaultPageBuildNumber,
	title,
	subtitle,
}: ChangelogDialog.Options): Adw.PreferencesDialog {
	const dialog = Dialog({
		window,
		title: title ?? _("Changelog"),
		childrenRequest: ()=>[Group({
			title: title ?? "",
			description: subtitle ?? "",
			onCreated: (group: Adw.PreferencesGroup) => {
				content()
				.then(ChangelogDialog.getReleases)
				.then(releases => releases.map(release => Row({
					title: release.version,
					subtitle: release.Date ?? "",
					action: ()=>ChangelogDialog.ChangelogPage(dialog, release),
					onCreated: (row)=>{
						if (release.BuildNumber == currentBuildNumber) {
							row.add_css_class("success")
							row.title += " " + _("(Current)")
						}
						if (release.BuildNumber == defaultPageBuildNumber) {
							ChangelogDialog.ChangelogPage(dialog, release)
						}
						group.add(row)
					}
				})))
				.catch(log)
			},
		})]
	})
	dialog.height_request = 520
	return dialog
}
export namespace ChangelogDialog {
	export interface Options {
		window: Adw.PreferencesWindow
		currentBuildNumber: number
		content: ()=>Promise<string>
		defaultPageBuildNumber?: number
		title?: string
		subtitle?: string
	}
	const LITEM = (t: string,lv: number)=>`${"　 ".repeat(lv)}<span alpha="70%">　•　</span>${t}`
	const TITLE = (t: string,lv: number)=>`<span size="${100+((8-lv)*2.5)}%"><span alpha="50%">${"#".repeat(lv)} </span><span weight="bold">${t}</span></span>`
	const QUOTE = (t: string)=>`<span size="90%" alpha="70%">&gt;</span><span size="90%" alpha="85%" weight="light">${t}</span>`
	export function simpleMarked(mdlike: string): string {
		return mdlike.split("\n").map(
			line => line
			.replaceAll(
				/^( *)\-  *(.*)/g,
				(_, indent, t: string)=>LITEM(t, Math.floor(indent.length/2))
			)
			.replaceAll(
				/^ *\>  *(.*)/g,
				(_, t: string)=>QUOTE(t)
			)
			.replaceAll(
				/^ *(\#*)  *(.*)/g,
				(_, head: string, t: string)=>TITLE(t, head.length)
			)
			.replaceAll(
				/\<\!\-\-.*?\-\-\>/g,
				""
			)
		).join("\n")
	}
	export interface Release {
		version: string
		content: string
		Includes: string[]
		BuildNumber: number
		Date: string
	}
	export function getReleases(content: string): Release[] {
		type Item = Partial<Release & { buffer: string[] }>
		const releases: Item[] = []
		let last: Item
		for (const line of content.split("\n")) {
			const version = line.match(/^#  *(.*) *$/)
			if (version) {
				releases.push(last = {
					version: version[1],
					buffer: [line],
				})
				continue
			}
			const meta = line.match("\<\!\-\-  *\@([^ ]*) *: *(.*?) *\-\-\>")
			if (meta) {
				last[meta[1]] = JSON.parse(meta[2])
				continue
			}
			if (!last) continue
			last.buffer.push(line)
		}
		for (const item of releases) {
			item.content = item.buffer.join("\n")
			delete item.buffer
		}
		return releases as Release[]
	}
	export function ChangelogPage(
		dialog: Adw.PreferencesDialog,
		release: Release,
	): Adw.NavigationPage {
		return Dialog.StackedPage({
			dialog,
			title: release.version,
			childrenRequest: ()=>[
				Group({},[
					new Gtk.Label({
						use_markup: true,
						label: ChangelogDialog.simpleMarked(release.content),
						halign: Gtk.Align.START,
						hexpand: true,
					})
				])
			]
		})
	}
}
// #endregion ChangelogDialog
