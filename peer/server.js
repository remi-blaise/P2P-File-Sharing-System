import net from 'net'
import fs from 'promise-fs'
import path from 'path'
import { config } from './config'
import { read } from './files'

// Create server
const server = net.createServer(socket => {
	socket.on('data', data => {
		try {
			// Parse request
			const request = JSON.parse(data.toString())
			// Identify retreive request
			if (request.name == 'retrieve') {
				read().then(files => {
					// Find requested file
					const file = files.find(file => file.id == request.parameters.fileId)
					console.log(`File requested: ${file.id} (${file.name})`)
					// Send requested file
					const stream = fs.createReadStream(path.join(config.dirname, file.name))
					stream.push(JSON.stringify({ status: 'success', data: { filename: file.name } })) // Send file name
					stream.pipe(socket)
				})
			}
		} catch (err) {
			// Ignore parsing error
		}
	})
	socket.on('error', err => console.error(`Server error: ${err.code}`))
})

/**
 * Start peer server
 */
function start() {
	server.listen(config.port)
}

export default { start }
