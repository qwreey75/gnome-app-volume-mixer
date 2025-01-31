function logger(str: string|(()=>string)) {
	if (str instanceof Function) str = str()
	if (logger.show_info) console.log(logger.LOG_INFO_HEADER + str)
}
namespace logger {
	export let LOG_HEADER_PREFIX: string = ""
	export let LOG_INFO_HEADER: string = ""
	export let LOG_DEBUG_HEADER: string = ""
	export let LOG_ERROR_HEADER: string = ""
	export let show_info: boolean = true
	export function setHeader(header: string) {
		LOG_HEADER_PREFIX = header
		LOG_INFO_HEADER = `${header} (info) `
		LOG_DEBUG_HEADER = `${header} (debug) `
		LOG_ERROR_HEADER = `${header} (error) `
	}

	export enum LogLevel {
		none = -1,
		error = 0,
		info = 1,
		debug = 2,
	}

	const void_function = (()=>{}) as (str: string)=>void
	export let debug: (str: string|(()=>string))=>void
	function debug_internal(str: string|(()=>string)) {
		if (str instanceof Function) str = str()
		console.log(LOG_DEBUG_HEADER + str)
	}
	export let error: (str: string|(()=>string))=>void
	function error_internal(str: string|(()=>string)) {
		if (str instanceof Function) str = str()
		console.log(`${LOG_ERROR_HEADER}${str}\n${new Error().stack}`)
	}

	export let currentLevel: number
	export function setLogLevel(level: number) {
		debug = level >= LogLevel.debug
			? debug_internal
			: void_function
		error = level >= LogLevel.error
			? error_internal
			: void_function
		show_info = level >= LogLevel.info
		currentLevel = level
	}
}
export { logger }
