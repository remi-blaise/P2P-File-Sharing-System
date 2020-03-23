import fs from 'promise-fs'
import ip from 'ip'
import path from 'path'
import crypto from 'crypto'
import { createInterface } from 'readline'
import { search } from './interface'
import { read, hashFile } from './files'
import { sendRegistry } from './files'
import { retrieve } from './interface'
import { queryhits } from './server'
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
function start() {
	// Register to the index server
	sendRegistry()

	// Watch shared directory changes
	fs.watch(config.sharedDir, sendRegistry)

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

	const answer = await ask('What do you want to do? ')

	switch (parseInt(answer)) {
		case 1:
			// 1. See the list of local files
			listFiles()
			break;
		case 2:
			// 2. Download file
			searchFile()
			break;
		case 3:
			// 3. Exit program
			process.exit()
		default:
			// Wrong input: ask again
			showCLI()
			break;
	}
}

/**
 * List local files
 */
async function listFiles() {
	const files = await read()

	if (files.length > 0) {
		console.log('\nList of local files:')
		console.log(files.map(file => file.size + '\t' + file.name + '\t' + file.hash).join('\n'))
	} else {
		console.log('\nThe shared directory is empty…')
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
	// Get sequence number
	const seqPath = '.cache/sequence'
	let sequenceNumber = 0
	if (fs.existsSync(seqPath)) {
		sequenceNumber = parseInt((await fs.readFile(seqPath)).toString())
	}
	sequenceNumber++
	fs.writeFile(seqPath, sequenceNumber)
	// Search file on index server
	const messageId = crypto.createHash('SHA256').update(`[${ip.address()}:${config.port}, ${sequenceNumber}]`).digest('hex')
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
		process.stdout.write(`\nDownloading from ${peer.ip}... `)

		try {
			await retrieve(file.hash, peer.ip, peer.port) 

			// Check that file has the same hash
			try {
				const hash =  await hashFile(path.join(config.sharedDir, file.name))

				if (hash != file.hash) {
					printError('File downloaded corrupted')
					fs.unlink(path.join(config.sharedDir, file.name))
					// Try next peer
					downloadFile(file, i + 1)
				} else {
					console.log(`${colors.BRIGHT}${colors.FG_GREEN}File successfully downloaded!${colors.RESET}`)
					// Back to menu
					showCLI()
				}
			} catch (err) {
				printError(`Cannot read file '${file.name}' (${err.code})`)
				// Back to menu
				showCLI()
			}
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

export default { start, printError }
