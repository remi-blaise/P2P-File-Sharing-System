import net from 'net'
import fs from 'promise-fs'
import cli from './cli'
import { config } from './config'
import { sendRegistry } from './files'

console.log(`Peer ID: ${config.peerId}`)

// Create shared directory if not exists
if (!fs.existsSync(config.dirname)) {
	fs.mkdirSync(config.dirname)
	console.log(`Shared directory created at path ${config.dirname}`)
}

// Register to the index server
sendRegistry()

// Watch changes
fs.watch(config.dirname, sendRegistry)

// CLI
console.log('\n====== WELCOME TO P2P FILE SHARING SYSTEM ======')
cli.show()

// Server-side
const server = net.createServer(socket => {

})

server.listen(config.port)
