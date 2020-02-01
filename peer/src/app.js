import fs from 'promise-fs'
import client from './client'
import server from './server'
import { config } from './config'

console.log(`Peer ID: ${config.peerId}`)
console.log(`Listening port: ${config.port}`)

// Create shared directory if not exists
if (!fs.existsSync(config.dirname)) {
	fs.mkdirSync(config.dirname)
	console.log(`Shared directory created at path ${config.dirname}`)
}

// Client-side
client.start()

// Server-side
server.start()
