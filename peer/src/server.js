import net from 'net'
import fs from 'promise-fs'
import path from 'path'
import { printError } from './client'
import repository from './repository'
import config from './config'
import colors from './colors'
import rsa from './rsa/rsa'
import keystore from './keystore'
import { readPrivateKey } from './rsa/rsa-keypair'

export var queryhits = {}

// Utility function
function send(socket, response, id) {
    if (id === undefined || keystore.getKey(id) === undefined) {
        // Send plain text message (key missing)
        socket.write(response)
    } else {
        // Send encrypted message
        const key = rsa.importKey(keystore.getKey(id))
        const cypher = rsa.encryptText(response, key)
		socket.write(cypher)
		if (config.debugRSA) console.log('Cyphertext:', cypher)
    }
}

// Create server
const server = net.createServer(socket => {
	socket.on('data', async data => {
		try {
			const key = await readPrivateKey()
			if (config.debugRSA) console.log('Received encrypted message:', data.toString())
			const message = rsa.decryptText(data.toString(), key)
			if (config.debugRSA) console.log('Decrypted message:', message)
			// Parse request
			const request = JSON.parse(message)
			// Identify retrieve request
			if (request.name === 'retrieve') {
				repository.File.findOne({ where: { name: request.parameters.fileName, owned: true } })
					.then(file => {
						if (file == null) {
							// File not found
							const request = { statut: 'error', message: 'File requested not found' }
							send(socket, JSON.stringify(request), request.parameters.id)
						} else {
							console.log(`${colors.FG_MAGENTA}File requested: ${colors.FG_CYAN}${file.name}${colors.RESET}`)
							// Send requested file
							socket.write(JSON.stringify({ status: 'success', data: {
								filename: file.name,
								version: file.version,
								ttr: config.ttr,
								lastModifiedTime: (new Date()).toISOString(),
							} }) + ';')
							const stream = fs.createReadStream(path.join(config.sharedDir, file.name))
							stream.pipe(socket)
						}
					})
			} else if (request.name === 'queryhit') {
				if (request.parameters.messageId != undefined && request.parameters.fileName != undefined && request.parameters.ip != undefined && request.parameters.port != undefined) {
					const hit = { fileName: request.parameters.fileName, ip: request.parameters.ip, port: request.parameters.port }
					if (queryhits.hasOwnProperty(request.parameters.messageId)) {
						queryhits[request.parameters.messageId].push(hit)
					} else {
						queryhits[request.parameters.messageId] = [hit]
					}
					send(socket, JSON.stringify({ status: 'success', data: null }), request.parameters.id)
				} else {
					console.log(`${colors.FG_RED}Received invalid paramers${colors.RESET}`, request.parameters)
					send(socket, JSON.stringify({ status: 'error', message: 'Invalid parameters' }), request.parameters.id)
				}
			} else if (request.name === 'invalidate') {
				if (request.parameters.messageId != undefined && request.parameters.fileName != undefined && request.parameters.version != undefined && request.parameters.ip != undefined && request.parameters.port != undefined) {
					repository.File.findOne({ where: { name: request.parameters.fileName } })
						.then(file => {
							if (file != null) {
								file.valid = false
								file.save()
							}
						})
						.catch(err => console.error(err))
						send(socket, JSON.stringify({ status: 'success', data: null }), request.parameters.id)
				} else {
					console.log(`${colors.FG_RED}Received invalid paramers${colors.RESET}`, request.parameters)
					send(socket, JSON.stringify({ status: 'error', message: 'Invalid parameters' }), request.parameters.id)
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
