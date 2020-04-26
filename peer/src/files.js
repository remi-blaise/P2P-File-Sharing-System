import path from 'path'
import fs from 'promise-fs'
import crypto from 'crypto'
import { Op } from 'sequelize'
import { registry } from './interface'
import { printError } from './client'
import repository from './repository'
import config from './config'

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
 * @param {boolean} downloaded - Read downloaded or shared files
 * @returns {Promise} Files with id, name and size
 */
export async function read(downloaded = false) {
	// Read shared directory
	const dir = downloaded ? config.downloadDir : config.sharedDir
	try {
		var files = await fs.readdir(dir)
		files = files.filter(file => !/\..*/.test(file)) // Exclude hidden files
		// For each file, return an object with data to send
		const promises = files.map(async (file) => {
			const pathfile = path.join(dir, file)
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
	repository.File.findAll({ where: { [Op.or]: [{ valid: true }, { owned: true }] } })
		.then(files => {
			registry(files)
		})
}
