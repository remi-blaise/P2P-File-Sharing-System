import fs from 'promise-fs'
import client from './client'
import server from './server'
import config from './config'
import colors from './colors'

console.log(`${colors.DIM}Listening port: ${config.port}${colors.RESET}`)

// Create shared directory if doesn't exist
if (!fs.existsSync(config.sharedDir)) {
	fs.mkdirSync(config.sharedDir)
	console.log(`Shared directory created at path ${config.sharedDir}`)
}

// Create key storage directory if doesn't exist
if (!fs.existsSync(config.keyStorageDir)) {
	fs.mkdirSync(config.keyStorageDir)
	console.log(`Key storage directory created at path ${config.keyStorageDir}`)
}

// Client-side
client.start()

// Server-side
server.start()
