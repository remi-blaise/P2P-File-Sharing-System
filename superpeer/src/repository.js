/**
 * repository.js
 *
 * Handle the memory layer: save and retrieve data.
 *
 * @author Rémi Blaise <hello@remi-blaise.com>
 */

import config from './config'
import util from 'util'

/****** FILES ******/

/**
 * In-memory file list
 *
 * Under the form:
 * [
 *     {
 *         id,
 *         hash,
 *         name,
 *         size,
 *         peers = [
 *             {
 *                 ip, port
 *             }
 *         ]
 *     }
 * ]
 */
const files = []

function logAllDatabase() {
    if (config.logAllDatabase) console.log(util.inspect(files, false, null, true))
}

Array.prototype.includesById = function(element) {
    return this.filter(e => e.name === element.name).length
}

/**
 * Save a peer
 */
export function registerPeer(peer, peerFiles) {
    const peerFileIds = peerFiles.map(file => file.name)

    // 1. If file is known and to unlink
    files
        .map((file, index) => [index, file])
        .filter(([index, file]) => file.peers.includes(peer) && !peerFileIds.includes(file.name))
        .forEach(([index, file]) => {
            // If it was the only file's peer: remove the file
            if (file.peers.length === 1) {
                files.splice(index, 1)
            }
            // Else only remove peer from file's peer list
            else {
                file.peers = file.peers.filter(p => p !== peer)
            }
        })

    // 2. If file is known but not linked yet to peer: link it
    files
        .filter(file => peerFiles.includesById(file) && !file.peers.includes(peer))
        .forEach(file => file.peers.push(peer))

    // 3. If file is unknown: add it
    peerFiles
        .filter(file => !files.includesById(file))
        .map(file => { return { ...file, peers: [peer] } })
        .forEach(file => files.push(file))

    logAllDatabase()
}

/**
 * Retrieve all peers having a file
 */
export function retrieveFiles(fileName) {
    // Search for file with corresponding file names
    return files.filter(file => file.name.includes(fileName))
}

/****** MESSAGES ******/

/**
 * In-memory message list
 *
 * Under the shape:
 * [
 *      {
 *          messageId,
 *          ip,
 *          port,
 *      }
 * ]
 */
const messages = []

export function logMessage(id, ip, port) {
    messages.push({ messageId: id, ip: ip, port: port, timestamp: new Date() })
}

export function getMessageSender(id) {
    return messages.find(message => message.messageId === id)
}

export function flushMessages() {
    messages
        .filter(message => message.timestamp < new Date() - config.queryLifetime)
        .forEach((_message, index) => messages.splice(index, 1))
}
