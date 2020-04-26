import fs from 'promise-fs'
import client from './client'
import server from './server'
import config from './config'
import colors from './colors'
import { shareKey } from './interface'
import { generateKeyPairIfNotExists } from './rsa/rsa-keypair'

console.log(`${colors.DIM}Listening port: ${config.port}${colors.RESET}`)

// Create shared directory if doesn't exist
if (!fs.existsSync(config.sharedDir)) {
	fs.mkdirSync(config.sharedDir)
	console.log(`Shared directory created at path ${config.sharedDir}`)
}

// Create downloads directory if doesn't exist
if (!fs.existsSync(config.downloadDir)) {
	fs.mkdirSync(config.downloadDir)
	console.log(`Downloads directory created at path ${config.downloadDir}`)
}

// Generate key pair if necessary
generateKeyPairIfNotExists()
	.then(() => shareKey()) // Share key with superpeer
	.then(() => client.start()) // Client-side

// Server-side
server.start()
