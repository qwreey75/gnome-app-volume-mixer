import Gtk from "gi://Gtk"
import Gdk from "gi://Gdk"
import Gio from "gi://Gio"
import Adw from "gi://Adw"
import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js"
import { gettext as _ } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js"
import { WidgetsPage } from "./prefPages/widgets.js"
import { TogglesPage } from "./prefPages/toggles.js"
import { LayoutPage } from "./prefPages/layout.js"
import { OtherPage } from "./prefPages/other.js"
import { AboutPage } from "./prefPages/about.js"
import { MenuPage } from "./prefPages/menu.js"
import { ContributorsRow, LicenseRow } from "./libs/prefComponents.js"
import Config from "./config.js"

var pageList = [
	WidgetsPage,
	TogglesPage,
	LayoutPage,
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

		// Window options
		window.set_search_enabled(true)
		window.set_default_size(640, 640)

		// Register icon path
		this.appendIconPath(this.path + "/media")
		this.appendIconPath(this.path + "/media/contributors")

		for (const page of pageList) {
			window.add(new page(settings, this, window))
		}
	}
}
