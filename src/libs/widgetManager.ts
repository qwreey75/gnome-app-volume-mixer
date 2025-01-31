import St from "gi://St"
import { Global } from "../global.js"
import { QuickMenuToggle } from "resource:///org/gnome/shell/ui/quickSettings.js"
import Maid from "./maid.js"

export class WidgetManager {
    _scroll: St.ScrollView
    _sections: St.BoxLayout
    _maid: Maid
    _boxes: St.BoxLayout[]

    update() {
        this._boxes[]
    }

    load(): void {
        this._maid = new Maid()
        Global.QuickSettingsBox.vertical = false

        this._maid.connectJob(
            Global.Settings,
            "changed::layout",
            this.update.bind(this)
        )

        this._maid.connectJob(
            Global.QuickSettingsBox, "notify::mapped", ()=>{
                if (Global.QuickSettingsBox.mapped) this.update()
            }
        )
    }
    unload(): void {
        this._maid.destroy()
        Global.QuickSettingsBox.vertical = true
    }
}
