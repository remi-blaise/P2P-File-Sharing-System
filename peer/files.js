import path from 'path'
import ip from 'ip'
import fs from 'promise-fs'
import crypto from 'crypto'
import { registry } from './interface'
import { config } from './config'

/**
 * Read files in shared directory
 * @returns {Promise} Files with id, name and size
 */
export async function read() {
	// Read shared directory
	try {
		const files = await fs.readdir(config.dirname)
		// For each file, return an object with data to send
		const promises = files.map(async (file) => {
			const pathfile = path.join(config.dirname, file)
			// Read file to get hash
			const hash = fs.readFile(pathfile)
				.then(data => crypto.createHash('sha1').update(data, 'utf8').digest('hex'))
				.catch(err => console.error(`ERROR: Cannot read file '${pathfile}' (${err.code})`))
			// Read stat to get size
			const stat = fs.stat(pathfile)
				.then(stats => stats.size)
				.catch(err => console.error(`ERROR: Cannot get stats of file '${pathfile}' (${err.code})`))
			const results = await Promise.all([hash, stat])
			return { id: results[0], name: file, size: results[1] }
		})

		return Promise.all(promises)
	}
	catch (err) {
		return console.error(`ERROR: Cannot read shared files (${err.code})`)
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
