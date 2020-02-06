import fs from 'promise-fs'
import path from 'path'
import { Socket } from 'net'
import crypto from 'crypto'
import { config } from './config'
import { printError } from './client'

/**
 * Send data to the index server
 * @param {string} data - Data to be send
 * @returns {Promise} Server response
 */
function sendData(data) {
	// Create connection
	const client = new Socket()
	client.connect(config.indexPort, config.indexHost)
	// Send request
	client.write(data, err => {
		if (err) {
			printError(`Failed to send data to the server (${err.code})`)
		}
	})
	// Wait for response
	return new Promise((resolve, reject) => {
		client.on('error', err => reject(new Error(`Cannot connect to the server (${err.code})`)))
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
			const err = new Error('Response not recieved before timeout.')
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
export function registry(host, port, files) {
	const publicKeyFilename = config.keyStorageDir + '/publicKey.pem'
	const privateKeyFilename = config.keyStorageDir + '/privateKey.pem'
	const registryCacheFilename = '.cache/lastPrivateKey.pem'
	// Format request as JSON
	const request = { name: 'registry', parameters: { uuid: config.peerId, ip: host, port: port, files: files } }
	// Check if key files are present
	if (!fs.existsSync(publicKeyFilename) || !fs.existsSync(privateKeyFilename)) {
		printError('One of your keys is missing, please execute `npm run generate-keys` to generate your keys', true)
	}
	// Read keys
	const publicKey = fs.readFileSync(publicKeyFilename).toString()
	const privateKey = fs.readFileSync(privateKeyFilename)
	const isRegistered = fs.existsSync(registryCacheFilename)
	const lastKey = isRegistered && fs.readFileSync(registryCacheFilename)
	// Sign request
	const sign = crypto.createSign('SHA256')
	sign.write(JSON.stringify(request))
	sign.end()
	const signature = sign.sign(lastKey || privateKey, 'hex')
	request.parameters.signature = signature
	if (!isRegistered || privateKey !== lastKey) {
		request.parameters.publicKey = publicKey
	}
	// Send request
	sendData(JSON.stringify(request))
		.then(() => {
			if (!isRegistered) {
				fs.writeFile(registryCacheFilename, privateKey)
			}
		})
		.catch(err => {
			printError(`Registry request failed: ${err.message}`)
		})
}

/**
 * Search for a file on the index server
 * @param {string} filename - Name of the file to search for
 */
export function search(filename) {
	// Format request as JSON
	const request = { name: 'search', parameters: { fileName: filename } }
	// Send request
	return sendData(JSON.stringify(request))
		.catch(err => {
			printError(`Search request failed: ${err.message}`)
		})
}

/**
 * Retrieve a file from a peer
 * @param {string} file - ID of the file to download
 * @param {string} host - Hostname of the peer
 * @param {number} port - Port of the peer
 */
export function retrieve(file, host, port) {
	// Create connection
	const socket = new Socket()
	socket.connect(port, host)
	socket.on('error', err => printError(`Cannot connect to the peer (${err.code})`))
	// Send request
	const request = { name: 'retrieve', parameters: { fileId: file } }
	socket.write(JSON.stringify(request), err => {
		if (err) {
			printError(`Failed to send data to the peer (${err.code})`)
		}
	})
	// Get response
	var filename = null // Name of the file downloaded
	var emptyFile = true
	return new Promise((resolve, reject) => {
		socket.on('data', data => {
			// Retrieve file
			try {
				// Get filename
				const response = JSON.parse(data.toString())
				if (response.status == 'success') {
					filename = response.data.filename
				} else {
					const err = new Error(response.message || 'Unkown error')
					reject(err)
				}
			} catch (e) {
				// Raw data
				emptyFile = false
				const dest = fs.createWriteStream(path.join(config.dirname, filename))
				dest.write(data)
			}
		})
		socket.on('end', () => {
			// We resolve the promise when the stream has ended
			// If we downloaded an empty file, we need to create it here
			if (emptyFile) {
				fs.open(path.join(config.dirname, filename), 'w')
					.then(fd => {
						fs.close(fd)
						resolve()
					})
			} else {
				resolve()
			}
		})
		// Timeout if the response is too long
		setTimeout(() => {
			if (filename == null) {
				const err = new Error('Response not recieved before timeout.')
				reject(err)
			}
		}, 1000)
	})
}
