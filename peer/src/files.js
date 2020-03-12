import path from 'path'
import ip from 'ip'
import fs from 'promise-fs'
import crypto from 'crypto'
import config from './config'
import { registry } from './interface'
import { printError } from './client'

/**
 * Hash a file in SHA1
 * @param {path} path - Path of the file to hash
 * @returns {Promise} Hash of the file
 */
export function hashFile(path) {
	return fs.readFile(path)
		.then(data => crypto.createHash('sha1').update(data, 'utf8').digest('hex'))
}

/**
 * Read files in shared directory
 * @returns {Promise} Files with id, name and size
 */
export async function read() {
	// Read shared directory
	try {
		var files = await fs.readdir(config.sharedDir)
		files = files.filter(file => !/\..*/.test(file)) // Exclude hidden files
		// For each file, return an object with data to send
		const promises = files.map(async (file) => {
			const pathfile = path.join(config.sharedDir, file)
			// Read file to get hash
			const hash = hashFile(pathfile)
				.catch(err => printError(`Cannot read file '${pathfile}' (${err.code})`))
			// Read stat to get size
			const stat = fs.stat(pathfile)
				.then(stats => stats.size)
				.catch(err => printError(`Cannot get stats of file '${pathfile}' (${err.code})`))
			const results = await Promise.all([hash, stat])
			return { hash: results[0], name: file, size: results[1] }
		})

		return Promise.all(promises)
	}
	catch (err) {
		return printError(`Cannot read shared files (${err.code})`)
	}
}

/**
 * Read the files and then send registry to the index server
 */
export function sendRegistry() {
	read()
		.then(files => {
			registry(ip.address(), config.port, files)
		})
}
