import fs from 'promise-fs'
import path from 'path'
import { createInterface } from 'readline'
import { search } from './interface'
import { read, hashFile } from './files'
import { config } from './config'
import { sendRegistry } from './files'
import { retrieve } from './interface'
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

	// Search file on index server
	let data = await search(filename)

	if (data == undefined) {
		// Back to menu
		showCLI()

		return
	}

	// Remove self from peers
	for (let i = 0; i < data.length; i++) {
		const file = data[i];
		file.peers = file.peers.filter(peer => peer.id != config.peerId)
	}

	// Remove file if peers are empty
	data = data.filter(file => file.peers.length > 0)

	if (data.length > 0) {
		console.log(`\nFiles corresponding to ${colors.BRIGHT}${colors.FG_CYAN}'${filename}'${colors.RESET}:\n`)
		var i = 1
		data.forEach(file => {
			console.log(colors.BRIGHT + i + '. ' + colors.RESET + file.name + ' (' + file.size + ' bytes) ' + colors.DIM + '(' + file.hash + ')' + colors.RESET + ' found on peers:')
			console.log(file.peers.map(peer => ' - ' + peer.ip + colors.DIM + ' (' + peer.id + ')' + colors.RESET).join('\n'))
			i++
		})
		console.log(`\nTotal: ${data.length}\n`)

		// Select file
		const answer = await ask('Which file do you want to download? ')

		const fileIndex = parseInt(answer)
		if (Number.isInteger(fileIndex)) {
			const file = data[fileIndex - 1]
			if (file != undefined) {
				// Start download
				const peer = file.peers[0]
				process.stdout.write('\nDownloading... ')
				retrieve(file.hash, peer.ip, peer.port)
					.then(() => {
						// Check that file has the same hash
						hashFile(path.join(config.sharedDir, file.name))
							.then(hash => {
								if (hash != file.hash) {
									printError('File downloaded corrupted')
									fs.unlink(path.join(config.sharedDir, file.name))
								} else {
									console.log(`${colors.BRIGHT}${colors.FG_GREEN}File successfully downloaded!${colors.RESET}`)
								}
								// Back to menu
								showCLI()
							})
							.catch(err => {
								printError(`Cannot read file '${file.name}' (${err.code})`)
								// Back to menu
								showCLI()
							})
					})
					.catch(err => {
						printError(err.message)
						// Back to menu
						showCLI()
					})
			}
		} else {
			console.log('\nNo valid index entered, back to main menu')
			// Back to menu
			showCLI()
		}
	} else {
		console.log(`\n${colors.BRIGHT}${colors.FG_YELLOW}No file named ${colors.FG_CYAN}'${filename}'${colors.FG_YELLOW} found.${colors.RESET}`)
		// Back to menu
		showCLI()
	}
}

export default { start, printError }
