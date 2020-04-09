import fs from 'promise-fs'
import ip from 'ip'
import path from 'path'
import { Socket } from 'net'
import crypto from 'crypto'
import config from './config'
import { printError } from './client'
import repository from './repository'

/**
 * Send data to the index server
 * @param {string} data - Data to be send
 * @returns {Promise} Server response
 */
function sendData(data, host = config.indexHost, port = config.indexPort) {
	// Create connection
	const client = new Socket()
	client.connect(port, host)
	// Send request
	client.write(data, err => {
		if (err) {
			printError(`Failed to send data (${err.code})`)
		}
	})
	// Wait for response
	return new Promise((resolve, reject) => {
		client.on('error', err => reject(new Error(`Cannot connect (${err.code})`)))
		client.on('data', data => {
			try {
				const response = JSON.parse(data.toString())
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
 * Register the peer to the index server
 * @param {string} host - Hostname of the peer
 * @param {number} port - Port of the peer server
 * @param {object[]} files - File list of the peer
 */
export async function registry(host, port, files) {
	const privateKeyFilename = config.keyStorageDir + '/privateKey.pem'
	// Format request as JSON
	const request = { name: 'registry', parameters: { ip: host, port: port, files: files } }
	// Read keys
	try {
		const privateKey = await fs.readFile(privateKeyFilename)
		// Sign request
		const sign = crypto.createSign('SHA256')
		sign.write(JSON.stringify(request))
		sign.end()
		const signature = sign.sign(privateKey, 'hex')
		request.parameters.signature = signature
		// Send request
		sendData(JSON.stringify(request))
			.catch(err => {
				printError(`Registry request failed: ${err.message}`)
			})
	} catch (e) {
		printError('One of your keys is missing, please execute `npm run generate-keys` to generate your keys', true)
	}
}

/**
 * Search for a file on the index server
 * @param {string} messageId - ID of the message
 * @param {string} filename - Name of the file to search for
 */
export function search(messageId, fileName) {
	// Format request as JSON
	const request = { name: 'search', parameters: { messageId, ttl: config.ttl, fileName, ip: ip.address(), port: config.port } }
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
	const request = { name: 'invalidate', parameters: { messageId, ip: ip.address(), port: config.port, fileName, version } }
	// Send request
	return sendData(JSON.stringify(request))
		.catch(err => {
			printError(`Invalidate request failed: ${err.message}`)
		})
}

/**
 * Poll the status of a file directly to a peer
 * @param {string} fileName - Name of the file to invalidate
 * @param {number} version - New version number of the file
 * @param {string} host - Hostname of the peer
 * @param {number} port - Port of the peer
 */
export function poll(fileName, version, host = null, port = null) {
	// Format request as JSON
	const request = { name: 'poll', parameters: { fileName, version } }
	// Send request
	return sendData(JSON.stringify(request), host, port)
		.catch(err => {
			printError(`Poll request failed: ${err.message}`)
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
		let ip, port
		socket.on('error', err => reject(new Error(`Cannot connect to the peer (${err.code})`)))
		socket.on('data', chunk => {
			ip = socket.remoteAddress
			port = socket.remotePort
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
					// Write content to file
					const filename = response.data.filename
					const dest = fs.createWriteStream(path.join(config.downloadDir, filename))
					// Add to database
					const file = await repository.File.create({
						name: filename,
						version: response.data.version,
						owned: false,
						valid: true,
						ip,
						port,
						ttr: response.data.ttr,
						lastModifiedTime: response.data.lastModifiedTime,
					})

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
