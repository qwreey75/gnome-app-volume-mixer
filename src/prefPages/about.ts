import Adw from "gi://Adw"
import GObject from "gi://GObject"
import Gio from "gi://Gio"
import { gettext as _ } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js"
import type QstExtensionPreferences from "../prefs.js"
import Config from "../config.js"
import {
	Group,
	Row,
	ContributorsRow,
	LicenseRow,
	LogoGroup,
	DialogRow,
	ChangelogDialog,
	fixPageScrollIssue,
} from "../libs/prefComponents.js"

export const AboutPage = GObject.registerClass({
	GTypeName: Config.baseGTypeName+"AboutPage",
}, class AboutPage extends Adw.PreferencesPage {
	constructor(_settings: Gio.Settings, prefs: QstExtensionPreferences, window: Adw.PreferencesWindow) {
		super({
			name: "about",
			title: _("About"),
			iconName: "dialog-information-symbolic"
		})
		fixPageScrollIssue(this)

		// Logo
		LogoGroup({
			parent: this,
			name: prefs.metadata.name,
			icon: "qst-project-icon",
			version: prefs.getVersionString(),
			versionAction: () => ChangelogDialog({
				window,
				content: async () => prefs.getChangelog(),
				currentBuildNumber: Config.buildNumber,
				defaultPageBuildNumber: Config.buildNumber,
			})
		})

		// About
		Group({
			parent: this,
			title: _("About"),
			description: _("Common extension informations"),
		},[
			Row({
				title: _("Changelogs"),
				subtitle: _("View the change history for this extension"),
				action: ()=>ChangelogDialog({
					window,
					title: _("Changelogs"),
					subtitle: _("View the change history for this extension"),
					content: async () => prefs.getChangelog(),
					currentBuildNumber: Config.buildNumber,
				}),
				icon: "object-rotate-right-symbolic",
			}),
			DialogRow({
				window,
				title: _("License"),
				subtitle: _("License of codes"),
				dialogTitle: _("License"),
				minHeight: 520,
				icon: "emblem-documents-symbolic",
				childrenRequest: _page=>[
					Group({
						title: _("License"),
						description: _("License of codes")
					}, prefs.getLicenses().map(LicenseRow)),
				],
			}),
			DialogRow({
				window,
				title: _("Contributors"),
				subtitle: _("The creators of this extension"),
				dialogTitle: _("Contributors"),
				icon: "emblem-favorite-symbolic",
				childrenRequest: _page=>[
					Group({
						title: _("Contributors"),
						description: _("The creators of this extension"),
					}, [
						...prefs.getContributorRows().map(ContributorsRow),
						Row({
							title: _("More contributors"),
							subtitle: _("See more contributors on github"),
							uri: "https://github.com/qwreey/quick-settings-tweaks/graphs/contributors"
						}),
					])
				]
			})
		])

		// Links
		Group({
			parent: this,
			title: _("Link"),
			description: _("External links about this extension")
		},[
			Row({
				uri: "https://patreon.com/user?u=44216831",
				title: _("Donate via patreon"),
				subtitle: _("Support development!"),
				icon: "qst-patreon-logo-symbolic",
			}),
			Row({
				uri: "https://extensions.gnome.org/extension/5446/quick-settings-tweaker/",
				title: "Gnome Extension",
				subtitle: _("Rate and comment the extension!"),
				icon: "qst-gnome-extension-logo-symbolic",
			}),
			Row({
				uri: "https://github.com/qwreey75/quick-settings-tweaks",
				title: _("Github Repository"),
				subtitle: _("Add Star on Repository is helping me a lot!\nPlease, if you found bug from this extension, you can make issue to make me know that!\nOr, you can create PR with wonderful features!"),
				icon: "qst-github-logo-symbolic",
			}),
			Row({
				uri: "https://weblate.paring.moe/projects/gs-quick-settings-tweaks/",
				title: "Webslate",
				subtitle: _("Add translation to this extension!"),
				icon: "qst-weblate-logo-symbolic",
			}),
		])
	}
})
