import Maid from "./maid.js";
import { Global } from "../global.js";
import { logger } from "./logger.js";

export class SettingLoader {
	records: Set<string>
	listeners: number[]
	onChange: (key: string)=>void
	parent: FeatureBase
	constructor(
		onChange: SettingLoader["onChange"],
		parent: FeatureBase,
	) {
		this.parent = parent
		this.records = new Set()
		this.listeners = []
		this.onChange = onChange
	}

	private push(key: string) {
		if (this.records.has(key)) return
		this.records.add(key)
		this.listeners.push(
			Global.Settings.connect(
				`changed::${key}`,
				() => this.onChange(key)
			)
		)
		if (!this.parent.disableDebugMessage)
			logger.debug(()=>`Setting listener for key '${key}' added for feature ${this.parent.constructor.name}`)
	}
	clear() {
		for (const source of this.listeners) {
			Global.Settings.disconnect(source)
		}
		this.listeners = []
		this.records.clear()
		if (!this.parent.disableDebugMessage) {
			logger.debug(()=>`Disconnected setting listeners for feature ${this.parent.constructor.name	}`)
		}
	}

	loadBoolean(key: string): boolean {
		this.push(key)
		return Global.Settings.get_boolean(key)
	}
	loadString(key: string): string {
		this.push(key)
		return Global.Settings.get_string(key)
	}
	loadInt(key: string): number {
		this.push(key)
		return Global.Settings.get_int(key)
	}
	loadStrv(key: string): string[] {
		this.push(key)
		return Global.Settings.get_strv(key)
	}
	loadValue<T>(key: string): T {
		this.push(key)
		return Global.Settings.get_value(key).recursiveUnpack()
	}
}

export abstract class FeatureBase {
	disableDebugMessage: boolean = false
	loader: SettingLoader
	maid: Maid

	constructor() {
		this.maid = new Maid()
		this.loader = new SettingLoader((key: string)=>{
			this.loader.clear()
			this.loadSettings(this.loader)
			this.reload(key)
		}, this)
	}

	load(noSettingsLoad?: boolean): void {
		if (!noSettingsLoad) this.loadSettings(this.loader)
		this.onLoad()
	}
	unload(noSettingsUnload?: boolean): void {
		if (!noSettingsUnload) this.loader.clear()
		this.onUnload()
		this.maid.clear()
	}
	abstract onLoad(): void
	abstract onUnload(): void
	reload(changedKey?: string): void {
		this.unload(true)
		this.load(true)
	}
	abstract loadSettings(loader: SettingLoader): void
}
