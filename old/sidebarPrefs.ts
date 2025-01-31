import Gtk from "gi://Gtk"
import Gdk from "gi://Gdk"
import Gio from "gi://Gio"
import Adw from "gi://Adw"
import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js"
import { gettext as _ } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js"
import { WidgetsPage } from "./prefPages/widgets.js"
import { TogglesPage } from "./prefPages/toggles.js"
import { OtherPage } from "./prefPages/other.js"
import { AboutPage } from "./prefPages/about.js"
import { MenuPage } from "./prefPages/menu.js"
import { ContributorsRow, LicenseRow, Row, Group } from "./libs/prefComponents.js"
import Config from "./config.js"

var pageList = [
	WidgetsPage,
	TogglesPage,
	MenuPage,
	OtherPage,
	AboutPage,
]

export default class QstExtensionPreferences extends ExtensionPreferences {
	appendIconPath(path: string) {
		const iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default())
		if (!iconTheme.get_search_path().includes(path))
			iconTheme.add_search_path(path)
	}

	readExtensionFile(path: string) {
		const decoder = new TextDecoder()
		const file = Gio.File.new_for_path(`${this.path}/${path}`)
		const content = file.load_contents(null)[1]
		return decoder.decode(content)
	}

	getContributorRows(): ContributorsRow.Contributor[][] {
		const contributors = JSON.parse(
			this.readExtensionFile("media/contributors/data.json")
		) as ContributorsRow.Contributor[]
		if (!contributors.length) return []
		const rows: ContributorsRow.Contributor[][] = [[]]
		contributors.reduce((currentRow: ContributorsRow.Contributor[], obj: ContributorsRow.Contributor)=>{
			if (currentRow.length >= 4) rows.push(currentRow = [])
			currentRow.push(obj)
			return currentRow
		}, rows[0])
		return rows
	}

	getLicenses(): LicenseRow.License[] {
		const licenses = JSON.parse(
			this.readExtensionFile("media/licenses.json")
		) as LicenseRow.License[]
		for (const item of licenses) {
			if (item.file) {
				item.content = async () => this.readExtensionFile(item.file)
			}
		}
		return licenses
	}

	getVersionString(): string {
		let version = Config.version.toUpperCase().replace(/-.*?$/, "")
		if (this.metadata.version) {
			version += "." + this.metadata.version
		}
		version += "   —   "
		if (Config.isReleaseBuild) {
			version += _("Stable") 
		} else if (Config.isDevelopmentBuild) {
			version += _("Development")
		} else {
			version += _("Preview")
		}
		if (Config.isGithubBuild) {
			version += "  " + _("(Github Release)")
		} else if (!this.metadata.version) {
			version += "  " + _("(Built from source)")
		}
		return version
	}

	getChangelog(): string {
		return this.readExtensionFile("media/Changelog.md")
	}

	async fillPreferencesWindow(window: Adw.PreferencesWindow) {
		let settings = this.getSettings()

		// Register icon path
		this.appendIconPath(this.path + "/media")
		this.appendIconPath(this.path + "/media/contributors")

		// Set window options
		window.set_search_enabled(true)
		window.set_default_size(720, 640)

		// Create sidebar area
		const sidebar = new Adw.NavigationPage({
			title: this.metadata.name,
			width_request: 196,
		})
		const sidebarToolbar = new Adw.ToolbarView()
		const sidebarHeader = new Adw.HeaderBar()
		sidebarToolbar.add_top_bar(sidebarHeader)
		sidebar.set_child(sidebarToolbar)
		const sidebarPage = new Adw.PreferencesPage()
		sidebarToolbar.set_content(sidebarPage)
		
		// Create content area
		const content = new Adw.NavigationPage({
			title: "undefined"
		})
		const contentToolbar = new Adw.ToolbarView()
		const contentHeader = new Adw.HeaderBar()
		contentToolbar.add_top_bar(contentHeader)
		content.set_child(contentToolbar)

		// Create navigation
		const navigation = new Adw.NavigationSplitView({
			vexpand: true,
			hexpand: true,
		})
		navigation.set_show_content(true)
		navigation.set_sidebar(sidebar)
		navigation.set_content(content)
		window.set_content(navigation)
		window.add(new Adw.PreferencesPage())

		const open = (page: Adw.PreferencesPage) => {
			contentToolbar.content = page
			content.title = page.title
		}
		const sidebarGroup = Group({
			parent: sidebarPage,
		})
		for (const PageClass of pageList) {
			const page = new PageClass(settings, this, window)
			const row = Row({
				parent: sidebarGroup,
				title: page.title,
				icon: page.iconName,
				noLinkIcon: true,
				action: ()=>{
					open(page)
				}
			})
			if (!contentToolbar.content) open(page)
		}
	}
}
