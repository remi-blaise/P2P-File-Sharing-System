import fs from 'promise-fs'
import ip from 'ip'
import path from 'path'
import { createInterface } from 'readline'
import { search } from './interface'
import { read, hashFile } from './files'
import { sendRegistry } from './files'
import { invalidate, retrieve, generateMessageID, poll } from './interface'
import { queryhits } from './server'
import repository from './repository'
import config from './config'
import colors from './colors'

// Instanciate the command line interface reader

const rl = createInterface({
	input: process.stdin,
	output: process.stdout
})

// Bufferize stdin
// Allow to pass input all at once in stdin for performance test scripting
const inputBuffer = []

rl.on('line', (input) => {
	inputBuffer.push(input)
})

/**
 * Ask for an input line
 * Retrieve the line from buffer if exists
 * @param {string} question - Question to output
 * @return {Promise<string>} The answer from stdin
 */
async function ask(question) {
	if (inputBuffer.length) return inputBuffer.shift()

	return new Promise(resolve => {
		rl.question(question, answer => {
			resolve(answer)
		})
	})
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Start client peer
 */
export function start() {
	// Add missing files to database
	read()
		.then(files => {
			return repository.sequelize
				.transaction(t => {
					return Promise.all(files.map(file => {
						return repository.File.findOrCreate({ where: { name: file.name, owned: true }, transaction: t })
					}))
				})
		})
		.then(() => {
			// Register to the index server
			sendRegistry()
		})
		.catch(err => console.error(err))

	// Watch shared directory changes
	fs.watch(config.sharedDir, (event, filename) => {
		repository.File.findOne({ where: { name: filename, owned: true } })
			.then(async file => {
				if (file != null) {
					if (event == 'rename' && !fs.existsSync(path.join(config.sharedDir, filename))) {
						file.destroy()
					} else {
						file.version += 1
						file.save()
					}

					// Invalidate request
					if (config.strategy === 0 || config.strategy === 2) invalidate(await generateMessageID(), file.name, file.version)
				} else {
					File.create({ name: filename, owned: true })
						.catch(err => console.error(err))
				}

				// Register to the index server
				sendRegistry()
			})
			.catch(err => console.error(err))
	})

	// Watch download directory changed
	fs.watch(config.downloadDir, () => {
		// Register to the index server
		sendRegistry()
	})

	// Show CLI
	console.log(`\n${colors.BRIGHT}====== WELCOME TO P2P FILE SHARING SYSTEM ======${colors.RESET}`)
	showCLI()
}

/**
 * Print a formatted error in the console
 * @param {string} message Error message
 * @param {boolean} fatal Is the error fatal. If so, we exit the program
 */
export function printError(message, fatal = false) {
	console.error(`\n${colors.BRIGHT}${colors.FG_RED}ERROR: ${message}${colors.RESET}\n`)
	if (fatal) {
		process.exit()
	}
}

/**
 * Show CLI menu
 */
async function showCLI() {
	console.log(`\n${colors.BRIGHT}1.${colors.RESET} See the list of local files`)
	console.log(`${colors.BRIGHT}2.${colors.RESET} Download a file`)
	console.log(`${colors.BRIGHT}3.${colors.RESET} Exit program`)
	if (config.strategy === 1) console.log(`${colors.BRIGHT}4.${colors.RESET} Refresh downloaded files`)

	const answer = await ask('What do you want to do? ')

	switch (parseInt(answer)) {
		case 1:
			// 1. See the list of local files
			listFiles()
			break
		case 2:
			// 2. Download file
			searchFile()
			break
		case 3:
			// 3. Exit program
			process.exit()
		case 4:
			// 4. Refresh all files
			if (config.strategy === 1) {
				refreshAll()
				break
			}
		default:
			// Wrong input: ask again
			showCLI()
			break
	}
}

/**
 * List local files
 */
async function listFiles() {
	const sharedFiles = await read()
	const downloadedFiles = await read(true)

	if (sharedFiles.length > 0) {
		console.log('\nList of shared files:')
		console.log(sharedFiles.map(file => file.size + '\t' + file.name + '\t' + file.hash).join('\n'))
	} else {
		console.log('\nThe shared directory is empty…')
	}

	if (downloadedFiles.length > 0) {
		console.log('\nList of downloaded files:')
		console.log(downloadedFiles.map(file => file.size + '\t' + file.name + '\t' + file.hash).join('\n'))
	}

	// Back to menu
	showCLI()
}

/**
 * Search for a file on the index server
 */
async function searchFile() {
	// Ask for filename
	const filename = await ask('\nName of the file: ')

	// Cleaning queryhits before
	//queryhits = {}
	// Get message ID
	const messageId = await generateMessageID()
	// Search file on index server
	await search(messageId, filename)
	process.stdout.write('\nSearching... ')
	await sleep(config.queryLifetime)
	var results = queryhits[messageId]

	if (results == undefined) {
		console.log(`${colors.BRIGHT}${colors.FG_YELLOW}No file named ${colors.FG_CYAN}'${filename}'${colors.FG_YELLOW} found.${colors.RESET}`)
		// Back to menu
		showCLI()

		return
	}

	// Remove self from results
	results = results.filter(file => file.ip != ip.address() || file.port != config.port)

	// Group by file ID
	var data = []
	results.forEach(result => {
		var found = false
		for (let i = 0; i < data.length; i++) {
			if (data[i].fileId == result.fileId) {
				data[i].peers.push({ ip: result.ip, port: result.port })
				found = true
				break
			}
		}

		if (!found) {
			data.push({
				id: result.fileId,
				hash: result.fileHash,
				name: result.fileName,
				size: result.fileSize,
				peers: [{ ip: result.ip, port: result.port }]
			})
		}
	})

	if (data.length > 0) {
		console.log(`Files corresponding to ${colors.BRIGHT}${colors.FG_CYAN}'${filename}'${colors.RESET}:\n`)
		var i = 1
		data.forEach(file => {
			console.log(colors.BRIGHT + i + '. ' + colors.RESET + file.name + ' (' + file.size + ' bytes) ' + colors.DIM + '(' + file.hash + ')' + colors.RESET + ' found on peers:')
			console.log(file.peers.map(peer => ' - ' + peer.ip + ':' + peer.port).join('\n'))
			i++
		})
		console.log(`\nTotal: ${data.length}\n`)

		// Select file
		const answer = await ask('Which file do you want to download? ')

		const fileIndex = parseInt(answer)
		const file = data[fileIndex - 1]
		if (file != undefined) {
			// Start download
			downloadFile(file)
		} else {
			console.log(`\n${colors.FG_YELLOW}No valid index entered, back to main menu.${colors.RESET}`)
			// Back to menu
			showCLI()
		}
	} else {
		console.log(`${colors.BRIGHT}${colors.FG_YELLOW}No file named ${colors.FG_CYAN}'${filename}'${colors.FG_YELLOW} found.${colors.RESET}`)
		// Back to menu
		showCLI()
	}
}

/**
 * Attempt to download a file from peers
 * @param {Object} file - File object
 * @param {number} [i=0] - Index of the peer to try
 */
async function downloadFile(file, i = 0) {
	if (i < file.peers.length) {
		const peer = file.peers[i]
		process.stdout.write(`\nDownloading from ${peer.ip}:${peer.port}... `)

		try {
			// Download and add to database
			const fileEntity = await retrieve(file.name, peer.ip, peer.port)

			// Check that file has the same hash
			/*try {
				const hash = await hashFile(path.join(config.sharedDir, file.name))

				if (hash != file.hash) {
					printError('File downloaded corrupted')
					fs.unlink(path.join(config.sharedDir, file.name))
					// Try next peer
					downloadFile(file, i + 1)
				} else {*/
					// Set up timeout
					if (config.strategy === 1) setRefreshTimeout(fileEntity)

					console.log(`${colors.BRIGHT}${colors.FG_GREEN}File successfully downloaded!${colors.RESET}`)
					// Back to menu
					showCLI()
				/*}
			} catch (err) {
				printError(`Cannot read file '${file.name}' (${err.code})`)
				// Back to menu
				showCLI()
			}*/
		} catch (err) {
			printError(err.message)
			// Try next peer
			downloadFile(file, i + 1)
		}
	} else {
		// Back to menu
		showCLI()
	}
}

/**
 * Refresh one file
 * @param {Object} file - File Sequelize entity
 */
async function refresh(file) {
	const { upToDate, ttr, lastModifiedTime } = await poll(file.name, file.version, file.ip, file.port)

	if (upToDate) {
		// Save new ttr
		[ file.ttr, file.lastModifiedTime ] = [ ttr, lastModifiedTime ]
		await file.save()
	}
	else {
		// Delete the entry in the database
		await file.destroy()

		// Download the new version
		file = await retrieve(file.name, file.ip, file.port)
	}

	// Set up timeout
	setRefreshTimeout(file)
}

function setRefreshTimeout(file) {
	setTimeout(() => refresh(file), new Date(file.lastModifiedTime) - (-file.ttr * 1000) - new Date()) // Can elicit stack overflow?
}

async function refreshAll() {
	await Promise.all(
		repository.File.findAll({ where: { owned: false } }).map(refresh)
	)

	// Back to menu
	showCLI()
}

export default { start, printError }
