/**
 * interface.js
 *
 * A client for sending requests
 *
 * @author Florentin Bekier
 */

import { Socket } from 'net'
import { RESET, BOLD, RED, GREEN, BLUE } from './colors'
import ip from 'ip'
import config from './config'

/**
 * Send data to another peer
 * @param {string} host - Host name
 * @param {number} port - Port
 * @param {string} data - Data to be send
 * @returns {Promise} Server response
 */
function sendData(host, port, data) {
	// Create connection
	const client = new Socket()
	client.connect(port, host)

	// Wait for response
	return new Promise((resolve, reject) => {
		// Send request
		client.write(data, err => {
			if (err) {
				console.log(`${BOLD}${RED}An error occured while sending data to the peer:`, err.message, RESET)
				reject(err)
			}
		})
		console.log(`${BOLD}${GREEN}Request sent:${RESET}${BLUE}`, data, RESET)

		client.on('error', err => {
			err = new Error(`Cannot connect to the server (${err.code})`)
			console.log(`${BOLD}${RED}An error occured while sending data to the peer:`, err.message, RESET)
			reject(err)
		})
		client.on('data', data => {
			try {
				const response = JSON.parse(data.toString())
				if (response.status == 'success') {
					console.log(`${BOLD}${GREEN}Response received:${RESET}${BLUE}`, response.data, RESET)
					resolve(response.data)
				} else {
					console.log(`${BOLD}${RED}An error was returned by peer:`, response.message, RESET)
					reject(new Error(response.message))
				}
			} catch (err) {
				console.log(`${BOLD}${RED}An error occured while sending data to the peer:`, err.message, RESET)
				reject(err)
			}
			client.destroy()
		})
	})
}

/**
 * Search for a file on the index server
 * @param {string} host - Host name
 * @param {number} port - Port
 * @param {string} messageId - ID of the message
 * @param {number} ttl - TTL (time-to-live) of the request
 * @param {string} filename - Name of the file to search for
 */
export function search(host, port, messageId, ttl, fileName) {
	// Format request as JSON
	const request = { name: 'search', parameters: { messageId, ttl, fileName, ip: ip.address(), port: config.port } }
	// Send request
	return sendData(host, port, JSON.stringify(request))
}

/**
 * Send a queryhit
 * @param {string} host - Host name
 * @param {number} port - Port
 * @param {string} fileId - ID of the file
 * @param {string} fileHash - Hash of the file
 * @param {string} fileName - Name of the file
 * @param {number} fileSize - Size of the file
 * @param {string} peerIp - IP of the peer
 * @param {number} peerPort - Port of the peer
 */
export function queryhit(host, port, messageId, fileName, peerIp, peerPort) {
	// Format request as JSON
	const request = { name: 'queryhit', parameters: { messageId, fileName, ip: peerIp, port: peerPort } }
	// Send request
	return sendData(host, port, JSON.stringify(request))
}

/**
 * Invalidate a file on the network
 * @param {string} host - Host name
 * @param {number} port - Port
 * @param {string} messageId - ID of the message
 * @param {string} fileName - Name of the file to invalidate
 * @param {number} version - New version number of the file
 */
export function invalidate(host, port, messageId, fileName, version) {
	// Format request as JSON
	const request = { name: 'invalidate', parameters: { messageId, ip: ip.address(), port: config.port, fileName, version } }
	// Send request
	return sendData(host, port, JSON.stringify(request))
}

/**
 * Poll the status of a file directly to a peer
 * @param {string} fileName - Name of the file to invalidate
 * @param {number} version - New version number of the file
 * @param {string} host - Hostname of the peer
 * @param {number} port - Port of the peer
 */
export function poll(host, port, fileName, version) {
	// Format request as JSON
	const request = { name: 'poll', parameters: { fileName, version } }
	// Send request
	return sendData(host, port, JSON.stringify(request))
}
