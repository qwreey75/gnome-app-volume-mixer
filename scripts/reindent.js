import { promises as fs } from "fs"
function getItems() {
	let allowed = false
	const items = process.argv.filter(item => {
		if (allowed) return true
		if (item == "--") allowed = true
		return false
	})
	return items
}
async function main() {
	await Promise.all(getItems().map(item =>
		fs.readFile(`./${item}`, { encoding: "utf-8" })
		.then(content =>
			content.replaceAll(/[^\n]*/g,
				substr => substr.replace(
					/^ */,
					indent => "\t".repeat(Math.floor(indent.length / 4))
				)
			))
		.then(fs.writeFile.bind(fs, item))
	))
}
main()
