import fs from 'fs'
import path from 'path'
import { createInterface } from 'readline'

const rl = createInterface({
	input: process.stdin,
	output: process.stdout
})

/**
 * Ask for an input line
 * Retrieve the line from buffer if exists
 * @param {string} question - Question to output
 * @return {Promise<string>} The answer from stdin
 */
async function ask(question) {
	return new Promise(resolve => {
		rl.question(question, answer => {
			resolve(answer)
		})
	})
}

/**
 * Recursively delete a folder on disk and everything inside it
 * @param {string} folderPath - Path to the folder
 */
function deleteFolderRecursive(folderPath) {
	if (fs.existsSync(folderPath)) {
		fs.readdirSync(folderPath).forEach((file, index) => {
			const curPath = path.join(folderPath, file)
			if (fs.lstatSync(curPath).isDirectory()) { // recurse
				deleteFolderRecursive(curPath)
			} else { // delete file
				fs.unlinkSync(curPath)
			}
		})
		fs.rmdirSync(folderPath)
	}
}

/**
 * Recursively copy a folder on disk
 * @param {string} src - Source folder
 * @param {string} dest - Destination folder
 */
function copyFolderRecursive(src, dest) {
	const exists = fs.existsSync(src)
	const stats = exists && fs.statSync(src)
	const isDirectory = exists && stats.isDirectory()
	if (isDirectory) {
		fs.mkdirSync(dest)
		fs.readdirSync(src).forEach(childItemName => {
			copyFolderRecursive(path.join(src, childItemName), path.join(dest, childItemName))
		})
	} else {
		fs.copyFileSync(src, dest)
	}
}

export { ask, deleteFolderRecursive, copyFolderRecursive }
