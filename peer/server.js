import net from 'net'
import fs from 'promise-fs'
import path from 'path'
import { config } from './config'
import { read } from './files'

const server = net.createServer(socket => {
	socket.on('data', data => {
		try {
			// Parse request
			const request = JSON.parse(data.toString())
			// Identify retreive request
			if (request.name == 'retrieve') {
				read().then(files => {
					const file = files.find(file => file.id == request.parameters.fileId)
					console.log(`File requested: ${file.id} (${file.name})`)
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

function start() {
	server.listen(config.port)
}

export default { start }
