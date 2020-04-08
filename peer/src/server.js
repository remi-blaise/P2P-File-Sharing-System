import net from 'net'
import fs from 'promise-fs'
import path from 'path'
import { read } from './files'
import { printError } from './client'
import repository from './repository'
import config from './config'
import colors from './colors'

export var queryhits = {}

// Create server
const server = net.createServer(socket => {
	socket.on('data', data => {
		try {
			// Parse request
			const request = JSON.parse(data.toString())
			// Identify retrieve request
			if (request.name == 'retrieve') {
				repository.File.findOne({ where: { name: request.parameters.fileName, owned: true } })
					.then(file => {
						if (file == null) {
							// File not found
							const request = { statut: 'error', message: 'File requested not found' }
							socket.write(JSON.stringify(request))
						} else {
							console.log(`${colors.FG_MAGENTA}File requested: ${colors.FG_CYAN}${file.name}${colors.RESET}`)
							// Send requested file
							socket.write(JSON.stringify({ status: 'success', data: { filename: file.name, version: file.version, ip: file.ip, port: file.port } }) + ';')
							const stream = fs.createReadStream(path.join(config.sharedDir, file.name))
							stream.pipe(socket)
						}
					})
			} else if (request.name == 'queryhit') {
				if (request.parameters.messageId != undefined && request.parameters.fileName != undefined && request.parameters.ip != undefined && request.parameters.port != undefined) {
					const hit = { fileName: request.parameters.fileName, ip: request.parameters.ip, port: request.parameters.port }
					if (queryhits.hasOwnProperty(request.parameters.messageId)) {
						queryhits[request.parameters.messageId].push(hit)
					} else {
						queryhits[request.parameters.messageId] = [hit]
					}
					socket.write(JSON.stringify({ status: 'success', data: null }))
				} else {
					console.log(`${colors.FG_RED}Received queryhit with invalid paramers${colors.RESET}`)
					socket.write(JSON.stringify({ status: 'error', message: 'Invalid parameters' }))
				}
			} else if (request.name = 'invalidate') {
				if (request.parameters.messageId != undefined && request.parameters.fileName != undefined && request.parameters.version != undefined && request.parameters.ip != undefined && request.parameters.port != undefined) {
					repository.File.findOne({ where: { name: request.parameters.fileName } })
						.then(file => {
							if (file != null) {
								file.valid = false
								file.save()
							}
						})
						.catch(err => console.error(err))
					socket.write(JSON.stringify({ status: 'success', data: null }))
				} else {
					console.log(`${colors.FG_RED}Received queryhit with invalid paramers${colors.RESET}`)
					socket.write(JSON.stringify({ status: 'error', message: 'Invalid parameters' }))
				}
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
