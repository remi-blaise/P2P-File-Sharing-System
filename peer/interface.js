import fs from 'promise-fs'
import path from 'path';
import { Socket } from 'net'
import { config } from './config'

// Constants
const SERVER_HOST = '127.0.0.1'
const SERVER_PORT = 8080

/**
 * Send data to the index server
 * @param {string} data - Data to be send
 * @returns {Promise} Server response
 */
export function sendData(data) {
	// Create connection
	const client = new Socket()
	client.connect(SERVER_PORT, SERVER_HOST)
	client.on('error', err => console.error(`ERROR: Cannot connect to the server (${err.code})`))
	// Send request
	client.write(data, err => {
		if (err) {
			console.error(`ERROR: Failed to send data to the server (${err.code})`)
		}
	})
	// Wait for response
	return new Promise((resolve, reject) => {
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
 * @param {Object[]} files - List of files of the peer
 * @param {string} files[].id - Hash of the file
 * @param {string} files[].name - Name of the file
 * @param {number} files[].size - Size of the file (in bytes)
 */
export function registry(host, port, files) {
	// Format request as JSON
	const request = { name: 'registry', parameters: { uuid: config.peerId, ip: host, port: port, files: files } }
	// Send request
	sendData(JSON.stringify(request))
		.catch(err => {
			console.error(`ERROR: Registry request failed: ${err.message}`)
		})
}

/**
 * Search for a file on the index server
 * @param {string} file - ID of the file to search for
 */
export function search(file) {
	// Format request as JSON
	const request = { name: 'search', parameters: { fileId: file } }
	// Send request
	sendData(JSON.stringify(request))
		.then(data => {
			if (data.length > 0) {
				console.log(`\nPeers found for file '${file}':`)
				console.log(data.map(peer => peer.uuid + '\t' + peer.host).join('\n'))
				console.log(`Total: ${data.length}`)
				// Start download
				const peer = data[0]
				retrieve(file, peer.host, peer.port)
			} else {
				console.log(`No peer found for file '${file}'`)
			}
		})
		.catch(err => {
			console.error(`ERROR: Search request failed: ${err.message}`)
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
	socket.on('error', err => console.error(err))
	// Send request
	const request = { name: 'retrieve', parameters: { fileId: file } }
	socket.write(JSON.stringify(request), err => {
		if (err) {
			console.error(err)
		}
	})
	// Get response
	var filename = null // Name of the file downloaded
	socket.on('data', data => {
		// Retrieve file
		try {
			// Get filename
			const response = JSON.parse(data.toString())
			if (response.status == 'success') {
				filename = response.data.filename
			} else {
				console.error(`ERROR: ${response.message}`)
			}
		} catch (e) {
			// Raw data
			const dest = fs.createWriteStream(path.join(config.dirname, filename))
			dest.write(data)
			console.log('File successfully downloaded')
		}
	})
}