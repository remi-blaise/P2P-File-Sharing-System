import fs from 'fs'
import ip from 'ip'
import path from 'path'
import { promisify } from 'util'
import { exec } from 'child_process'
import { ask, deleteFolderRecursive, copyFolderRecursive } from './utils'
import colors from '../../peer/src/colors'

const TARGET_DIR = '../target'
const SP_SRC_DIR = '../superpeer'
const LN_SRC_DIR = '../peer'
const IP_ADDR = ip.address()

async function createSuperPeers(number, leafNodes, topology, strategy, ttr) {
	var superPeers = []

	for (let i = 0; i < number; i++) {
		console.log(`\n${colors.BRIGHT}Creating super-peer #${i + 1}...${colors.RESET}`)

		const superPeerPort = portCounter
		const superPeerPath = path.join(TARGET_DIR, `superpeer${i}`)
		let peers = []

		copyFolderRecursive(SP_SRC_DIR, superPeerPath)

		for (let j = 0; j < leafNodes; j++) {
			portCounter++
			process.stdout.write(`Leaf node #${j + 1}... `)
			await createLeafNode(`${i}${j}`, portCounter, superPeerPort, strategy, ttr)
			// Copy public key to super-peer
			fs.copyFileSync(path.join(TARGET_DIR, `leafnode${i}${j}`, 'keys', 'publicKey.pem'), path.join(superPeerPath, 'keys', `${j}.pem`))
			peers.push({ ip: IP_ADDR, port: portCounter })
			console.log(`${colors.BRIGHT}${colors.FG_GREEN}Done!${colors.RESET}`)
		}

		superPeers.push({ ip: IP_ADDR, port: superPeerPort })

		// Edit config
		process.stdout.write('Configuring... ')
		let config = JSON.parse(fs.readFileSync(path.join(superPeerPath, 'config.json.dist')))
		config.port = superPeerPort
		config.leafNodes = peers
		config.strategy = strategy
		fs.writeFileSync(path.join(superPeerPath, 'config.json'), JSON.stringify(config, null, '\t'))

		// Install dependencies
		process.stdout.write('Installing dependencies... ')
		await promisify(exec)(`cd ${superPeerPath} && npm install`)
		console.log(`${colors.BRIGHT}${colors.FG_GREEN}Done!${colors.RESET}`)

		portCounter++
	}

	process.stdout.write(`\n${colors.BRIGHT}Setting up network topology...${colors.RESET} `)
	for (let i = 0; i < number; i++) {
		// Edit config
		const configPath = path.join(TARGET_DIR, `superpeer${i}`, 'config.json')
		let config = JSON.parse(fs.readFileSync(configPath))
		let neighbors = []
		if (topology == 1) {
			// All-to-all: every super-peer (except ourself) is our neighbor
			neighbors = [...superPeers]
			neighbors.splice(i, 1)
		} else {
			// Linear: each super-peer has 2 neighbors
			if (i > 0) {
				neighbors.push(superPeers[i - 1])
			} else {
				neighbors.push(superPeers[superPeers.length - 1])
			}
			neighbors.push(superPeers[(i + 1) % superPeers.length])
		}
		config.neighbors = neighbors
		fs.writeFileSync(configPath, JSON.stringify(config, null, '\t'))
	}
	console.log(`${colors.BRIGHT}${colors.FG_GREEN}Done!${colors.RESET}`)
}

async function createLeafNode(index, port, superPeerPort, strategy, ttr) {
	const leafNodePath = path.join(TARGET_DIR, `leafnode${index}`)

	copyFolderRecursive(LN_SRC_DIR, leafNodePath)

	// Edit config
	process.stdout.write('Configuring... ')
	let config = JSON.parse(fs.readFileSync(path.join(leafNodePath, 'config.json.dist')))
	config.indexHost = '127.0.0.1'
	config.indexPort = superPeerPort
	config.port = port
	config.strategy = strategy
	config.ttr = ttr
	fs.writeFileSync(path.join(leafNodePath, 'config.json'), JSON.stringify(config, null, '\t'))

	// Generate keys
	process.stdout.write('Generating keys... ')
	await promisify(exec)(`cd ${leafNodePath} && npm run generate-keys`)

	// Install dependencies
	process.stdout.write('Installing dependencies... ')
	await promisify(exec)(`cd ${leafNodePath} && npm install`)
}

async function main() {
	console.log(`\n${colors.BRIGHT}====== GNUTELLA-STYLE P2P FILE SHARING SYSTEM INSTALLER ======${colors.RESET}\n`)

	// Ask for configuration settings
	const superPeers = parseInt(await ask('How many super-peers do you want to deploy? '))
	const leafNodes = parseInt(await ask('How many leaf nodes per super-peer do you want to deploy? '))
	console.log('Which topology do you want to generate?')
	console.log('1. All-to-all')
	console.log('2. Linear')
	const raw = parseInt(await ask('Your choice: (1) '))
	const topology = raw == 2 ? 2 : 1

	let strategy
	while (true) {
		console.log('What consistency strategy do you want?')
		console.log('0. The pull-based approach')
		console.log('1. The push-based approach with leaf-peer cache')
		console.log('2. The push-based approach with superpeer cache')
		strategy = parseInt(await ask('Strategy: '))
		if (strategy != 0 && strategy != 1 && strategy != 2) {
			console.error("Invalid strategy, please choose one!")
		} else {
			break
		}
	}

	let ttr
	if (strategy === 1) {
		ttr = parseInt(await ask('Choose the ttr (sec): (60) '))
		if (ttr === NaN) ttr = 60
	}

	// Clean target directory
	process.stdout.write('\nCleaning old peers... ')
	if (fs.existsSync(TARGET_DIR)) {
		deleteFolderRecursive(TARGET_DIR)
	}
	fs.mkdirSync(TARGET_DIR)
	console.log(`${colors.BRIGHT}${colors.FG_GREEN}Done!${colors.RESET}`)

	await createSuperPeers(superPeers, leafNodes, topology, strategy, ttr)

	console.log('\nBye!')
	process.exit()
}

var portCounter = 8080
main()
