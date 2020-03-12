import net from 'net'
import fs from 'promise-fs'
import path from 'path'
import { read } from './files'
import { printError } from './client'
import config from './config'
import colors from './colors'

// Create server
const server = net.createServer(socket => {
	socket.on('data', data => {
		try {
			// Parse request
			const request = JSON.parse(data.toString())
			// Identify retrieve request
			if (request.name == 'retrieve') {
				read().then(files => {
					// Find requested file
					const file = files.find(file => file.hash == request.parameters.fileId)
					if (file == undefined) {
						// File not found
						const request = { statut: 'error', message: 'File requested not found' }
						socket.write(JSON.stringify(request))
					} else {
						console.log(`${colors.FG_MAGENTA}File requested: ${file.hash} (${colors.FG_CYAN}${file.name}${colors.FG_MAGENTA})${colors.RESET}`)
						// Send requested file
						socket.write(JSON.stringify({ status: 'success', data: { filename: file.name } }) + ';')
						const stream = fs.createReadStream(path.join(config.sharedDir, file.name))
						stream.pipe(socket)
					}
				})
			}
		} catch (err) {
			// Ignore parsing error
		}
	})
	socket.on('error', err => printError(`Server error: ${err.code}`))
})

/**
 * Start peer server
 */
function start() {
	server.listen(config.port)
}

export default { start }
