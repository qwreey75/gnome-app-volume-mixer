import { type QuickToggle } from "resource:///org/gnome/shell/ui/quickSettings.js"

export interface QuickToggleOrderItem {
    constructorName?: string
    titleRegex?: string
    friendlyName?: string
    nonOrdered?: boolean
    isSystem?: boolean
    cachedTitleRegex?: RegExp
    hide?: boolean
}
export namespace QuickToggleOrderItem {
    export function match(a: QuickToggleOrderItem, b: QuickToggleOrderItem) {
        if (
            a.isSystem != b.isSystem
            || a.nonOrdered != b.nonOrdered
            || a.hide != b.hide
        ) return false
        if (a.nonOrdered) return true
        if (a.isSystem) return a.constructorName == b.constructorName
        return (
            a.constructorName == b.constructorName
            && a.titleRegex == b.titleRegex
            && a.friendlyName == b.friendlyName
        )
    }
    export function toggleMatch(item: QuickToggleOrderItem, toggle: QuickToggle): boolean {
        if (item.constructorName && toggle.constructor.name != item.constructorName)
            return false
        if (item.cachedTitleRegex && toggle.title.match(item.cachedTitleRegex) == null)
            return false
        return true
    }
    export const Default: QuickToggleOrderItem = {
        hide: false,
        titleRegex: "",
        constructorName: "",
        friendlyName: ""
    }
    export function create(friendlyName: string): QuickToggleOrderItem {
        return {
            ...Default,
            friendlyName,
        }
    }
}
