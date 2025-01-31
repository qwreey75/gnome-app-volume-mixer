import { Global } from "../global.js"
import { FeatureBase, type SettingLoader } from "../libs/feature.js"
import { logger } from "../libs/logger.js"
import Config from "../config.js"

export class DebugFeature extends FeatureBase {
    disableDebugMessage = true

    // #region settings
    expose: boolean
    showLayoutBorder: boolean
    logLevel: number
    loadSettings(loader: SettingLoader): void {
        this.expose = loader.loadBoolean("debug-expose")
        this.showLayoutBorder = loader.loadBoolean("debug-show-layout-border")
        this.logLevel = loader.loadInt("debug-log-level")
    }
    // #endregion settings

    onLoad() {
        logger.setHeader(Config.loggerPrefix)
        logger.setLogLevel(this.logLevel)
        logger.debug(()=>`Logger initialized, LogLevel: ${this.logLevel}`)
        if (this.expose) {
            globalThis.qst = Global
            this.maid.functionJob(()=>{ delete globalThis.qst })
            logger.debug("Extension environment expose enabled")
        }
        if (this.showLayoutBorder) {
            // @ts-ignore
            Global.QuickSettingsMenu._boxPointer.styleClass += " QSTWEAKS-debug-show-layout"
            this.maid.functionJob(()=>{
                // @ts-ignore
                Global.QuickSettingsMenu._boxPointer.styleClass =
                // @ts-ignore
                Global.QuickSettingsMenu._boxPointer.styleClass.replace(/ QSTWEAKS-debug-show-layout/, "")
            })
            logger.debug("Show layout border enabled")
        }
    }
    onUnload(): void {}
}
