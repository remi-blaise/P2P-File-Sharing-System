import fs from 'promise-fs'
import client from './client'
import server from './server'
import { config } from './config'

console.log(`Peer ID: ${config.peerId}`)
console.log(`Listening port: ${config.port}`)

// Create shared directory if doesn't exist
if (!fs.existsSync(config.dirname)) {
	fs.mkdirSync(config.dirname)
	console.log(`Shared directory created at path ${config.dirname}`)
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
