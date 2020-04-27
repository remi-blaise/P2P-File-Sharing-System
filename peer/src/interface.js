import fs from 'promise-fs'
import ip from 'ip'
import path from 'path'
import { Socket } from 'net'
import crypto from 'crypto'
import rsa from './rsa/rsa'
import config from './config'
import { pemPublicKey, readPrivateKey } from './rsa/rsa-keypair'
import { printError } from './client'
import repository from './repository'
import keystore from './keystore'

const id = ip.address() + ':' + config.port

/**
 * Send data to the index server
 * @param {string} data - Data to be send
 * @param {boolean} encrypted - Specify if the request has to be encrypted
 * @param {string} host - Host name
 * @param {number} port - Port
 * @returns {Promise} Server response
 */
function sendData(data, encrypted = true, host = config.indexHost, port = config.indexPort) {
	// Create connection
	const client = new Socket()
	client.connect(port, host)

	if (encrypted) {
		// Encrypt message using RSA
		const key = rsa.importKey(keystore.getKey(`${host}:${port}`))
		if (config.debugRSA) console.log('Plain text message:', data)
		const cypher = rsa.encryptText(data, key)
		if (config.debugRSA) console.log('Cyphertext:', cypher)
		// Send request
		client.write(cypher, err => {
			if (err) {
				printError(`Failed to send data (${err.code})`)
			}
		})
	} else {
		// Plain text message
		// Send request
		client.write(data, err => {
			if (err) {
				printError(`Failed to send data (${err.code})`)
			}
		})
	}

	// Wait for response
	return new Promise((resolve, reject) => {
		client.on('error', err => reject(new Error(`Cannot connect (${err.code})`)))
		client.on('data', async data => {
			try {
				if (config.debugRSA) console.log('Encrypted response:', data.toString())
				const key = await readPrivateKey()
				const response = JSON.parse(rsa.decryptText(data.toString(), key))
				if (config.debugRSA) console.log('Decrypted response:', response)
				if (response.status == 'success') {
					resolve(response.data)
				} else {
					const err = new Error(response.message)
					reject(err)
				}
			} catch (err) {
				reject(err)
			}
			client.destroy()
		})
		// Timeout if the response is too long
		setTimeout(() => {
			const err = new Error('Response not received before timeout.')
			reject(err)
		}, 1000)
	})
}

/**
 * Share public key with superpeer
 */
export async function shareKey() {
	const key = await pemPublicKey()
	// Format request as JSON
	const request = { name: 'pks', parameters: { id, key } }
	// Send request
	sendData(JSON.stringify(request), false)
		.then(data => {
			keystore.setKey(`${config.indexHost}:${config.indexPort}`, data)
		})
		.catch(err => {
			printError(`Registry request failed: ${err.message}`)
		})
}

/**
 * Register the peer to the index server
 * @param {string} host - Hostname of the peer
 * @param {number} port - Port of the peer server
 * @param {object[]} files - File list of the peer
 */
export async function registry(files) {
	// Format request as JSON
	const request = { name: 'registry', parameters: { id, files: files } }
	// Send request
	sendData(JSON.stringify(request))
		.catch(err => {
			printError(`Registry request failed: ${err.message}`)
		})
}

/**
 * Search for a file on the index server
 * @param {string} messageId - ID of the message
 * @param {string} filename - Name of the file to search for
 */
export function search(messageId, fileName) {
	// Format request as JSON
	const request = { name: 'search', parameters: { id, messageId, ttl: config.ttl, fileName } }
	// Send request
	return sendData(JSON.stringify(request))
		.catch(err => {
			printError(`Search request failed: ${err.message}`)
		})
}

/**
 * Invalidate a file on the network
 * @param {string} messageId - ID of the message
 * @param {string} fileName - Name of the file to invalidate
 * @param {number} version - New version number of the file
 */
export function invalidate(messageId, fileName, version) {
	// Format request as JSON
	const request = { name: 'invalidate', parameters: { id, messageId, fileName, version } }
	// Send request
	return sendData(JSON.stringify(request))
		.catch(err => {
			printError(`Invalidate request failed: ${err.message}`)
		})
}

/**
 * Retrieve a file from a peer
 * @param {string} file - Name of the file to download
 * @param {string} host - Hostname of the peer
 * @param {number} port - Port of the peer
 */
export function retrieve(file, host, port) {
	// Create connection
	const socket = new Socket()
	socket.connect(port, host)
	// Send request
	const request = { name: 'retrieve', parameters: { fileName: file } }
	socket.write(JSON.stringify(request), err => {
		if (err) {
			printError(`Failed to send data to the peer (${err.code})`)
		}
	})
	// Get response
	return new Promise((resolve, reject) => {
		let data = ''
		socket.on('error', err => reject(new Error(`Cannot connect to the peer (${err.code})`)))
		socket.on('data', chunk => {
			data += chunk.toString()
		})
		socket.on('end', async () => {
			// Separate JSON response from file data stream
			const separatorIndex = data.indexOf(';')
			const header = data.substring(0, separatorIndex)
			const content = data.substring(separatorIndex + 1)
			// Read JSON response
			try {
				const response = JSON.parse(header)

				if (response.status == 'success') {
					const filename = response.data.filename
					// Add to database
					const file = await repository.File.create({
						name: filename,
						version: response.data.version,
						owned: false,
						valid: true,
						ip: host,
						port,
						ttr: response.data.ttr,
						lastModifiedTime: response.data.lastModifiedTime,
					})
					// Write content to file
					const dest = fs.createWriteStream(path.join(config.downloadDir, filename))

					dest.write(content, () => {
						socket.destroy()
						resolve(file)
					})
				} else {
					const err = new Error(response.message || 'Unkown error')
					reject(err)
				}
			} catch (err) {
				reject(err)
			}
		})
	})
}

/**
 * Generate a message ID
 * @returns {number} Message ID
 */
export async function generateMessageID() {
	const seqPath = '.cache/sequence'
	let sequenceNumber = 0
	if (fs.existsSync(seqPath)) {
		sequenceNumber = parseInt((await fs.readFile(seqPath)).toString())
	}
	sequenceNumber++
	fs.writeFile(seqPath, sequenceNumber)

	return crypto.createHash('SHA256').update(`[${ip.address()}:${config.port}, ${sequenceNumber}]`).digest('hex')
}
