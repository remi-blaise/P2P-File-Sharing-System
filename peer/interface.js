import { Socket } from 'net'
import { config } from './config'

// Constants
const SERVER_HOST = '127.0.0.1'
const SERVER_PORT = 8080

/**
 * Send data to the index server
 * @param {string} data - Data to be send
 */
export function sendData(data) {
	const client = new Socket()
	client.connect(SERVER_PORT, SERVER_HOST)
	client.on('error', err => console.error(`ERROR: Cannot connect to the server (${err.code})`))
	client.write(data, err => {
		if (err) {
			console.error(`ERROR: Failed to send registry to the server (${err.code})`)
		}
		client.destroy()
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
}

/**
 * Search for a file on the index server
 * @param {string} file ID of the file to search for
 */
export function search(file) {
	// Format request as JSON
	const request = { name: 'search', parameters: { fileId: file } }
	// Send request
	sendData(JSON.stringify(request))
}
