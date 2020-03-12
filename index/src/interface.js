import { Socket } from 'net'

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
				reject(err)
			}
		})

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
 * Search for a file on the index server
 * @param {string} host - Host name
 * @param {number} port - Port
 * @param {string} filename - Name of the file to search for
 */
export function search(host, port, ttl, filename) {
	// Format request as JSON
	const request = { name: 'search', parameters: { ttl: ttl, fileName: filename } }
	// Send request
	return sendData(host, port, JSON.stringify(request))
}

/**
 * Send a queryhit
 * @param {string} host - Host name
 * @param {number} port - Port
 * @param {string} filename - Name of the file to search for
 */
export function queryhit(host, port, messageId, fileId, peerIp, peerPort) {
	// Format request as JSON
	const request = { name: 'queryhit', parameters: { messageId: messageId, fileId: fileId, ip: peerIp, port: peerPort } }
	// Send request
	return sendData(host, port, JSON.stringify(request))
}
