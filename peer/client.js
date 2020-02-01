import fs from 'promise-fs'
import { createInterface } from 'readline'
import { search } from './interface'
import { read } from './files'
import { config } from './config'
import { sendRegistry } from './files'

/**
 * Start client peer
 */
function start() {
	// Register to the index server
	sendRegistry()

	// Watch shared directory changes
	fs.watch(config.dirname, sendRegistry)

	// Show CLI
	console.log('\n====== WELCOME TO P2P FILE SHARING SYSTEM ======')
	showCLI()
}

/**
 * Show CLI menu
 */
function showCLI() {
	console.log('\n1. See the list of local files')
	console.log('2. Download file')

	const rl = createInterface({
		input: process.stdin,
		output: process.stdout
	})

	rl.question('What do you want to do? ', answer => {
		rl.close()

		switch (answer) {
			case '1':
				// 1. See the list of local files
				console.log('\nList of local files:')
				read()
					.then(files => {
						console.log(files.map(file => file.id + '\t' + file.name + '\t' + file.size).join('\n'))
						showCLI()
					})
				break;

			case '2':
				// 2. Download file
				const rl2 = createInterface({
					input: process.stdin,
					output: process.stdout
				})
				// Ask for file ID
				rl2.question('File ID: ', answer => {
					search(answer) // Search file on index server
					rl2.close()
				})
				break;

			default:
				// Wrong input: ask again
				showCLI()
				break;
		}
	})
}

export default { start, showCLI }
