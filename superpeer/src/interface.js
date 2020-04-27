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
import rsa from './rsa/rsa'
import config from './config'
import keystore from './keystore'
import { pemPublicKey, readPrivateKey } from './rsa/rsa-keypair'

const id = ip.address() + ':' + config.port

/**
 * Send data to another peer
 * @param {string} host - Host name
 * @param {number} port - Port
 * @param {string} data - Data to be send
 * @param {boolean} encrypted - Specify if the request has to be encrypted
 * @returns {Promise} Server response
 */
function sendData(host, port, data, encrypted = true) {
	// Create connection
	const client = new Socket()
	client.connect(port, host)

	// Wait for response
	return new Promise((resolve, reject) => {
		if (encrypted) {
			// Encrypt message using RSA
			const key = rsa.importKey(keystore.getKey(`${host}:${port}`))
			console.log(`${BOLD}${GREEN}Request sent:${RESET}${BLUE}`, data, RESET)
			const cypher = rsa.encryptText(data, key)
			if (config.debugRSA) console.log('Cyphertext:', cypher)
			// Send request
			client.write(cypher, err => {
				if (err) {
					console.log(`${BOLD}${RED}An error occured while sending data to the peer:`, err.message, RESET)
					reject(err)
				}
			})
		} else {
			// Plain text message
			// Send request
			client.write(data, err => {
				if (err) {
					console.log(`${BOLD}${RED}An error occured while sending data to the peer:`, err.message, RESET)
					reject(err)
				}
			})
			console.log(`${BOLD}${GREEN}Request sent:${RESET}${BLUE}`, data, RESET)
		}

		client.on('error', err => {
			err = new Error(`Cannot connect to the server (${err.code})`)
			console.log(`${BOLD}${RED}An error occured while sending data to the peer:`, err.message, RESET)
			reject(err)
		})
		client.on('data', async data => {
			try {
				if (config.debugRSA) console.log('Encrypted response:', data.toString())
				const key = await readPrivateKey()
				const response = JSON.parse(rsa.decryptText(data.toString(), key))
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
 * Share public key with another peer
 * @param {string} host - Host name
 * @param {number} port - Port
 */
export async function shareKey(host, port) {
	const key = await pemPublicKey()
	// Format request as JSON
	const request = { name: 'pks', parameters: { id, key } }
	// Send request
	return sendData(host, port, JSON.stringify(request), false)
		.then(data => {
			keystore.setKey(`${host}:${port}`, data)
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
	const request = { name: 'search', parameters: { id, messageId, ttl, fileName } }
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
	const request = { name: 'queryhit', parameters: { id, messageId, fileName, ip: peerIp, port: peerPort } }
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
	const request = { name: 'invalidate', parameters: { id, messageId, fileName, version } }
	// Send request
	return sendData(host, port, JSON.stringify(request))
}
