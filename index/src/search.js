/**
 * query.js
 *
 * Handle queries' local search and propagation
 *
 * @author Rémi Blaise <hello@remi-blaise.com>
 */

import { search, queryhit } from './interface'
import { retrieveFiles } from './repository'
import config from './config'

// Fisher-Yates from https://javascript.info/task/shuffle
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1)) // random index from 0 to i
        ;[array[i], array[j]] = [array[j], array[i]]
    }
}

export async function localSearch(messageId, fileName, ip, port) {
    // Search locally
    const files = await retrieveFiles(fileName)

    // Send one `queryhit` request back to the peer
    files.forEach(file => {
        const peers = [ ...file.peers ]
        shuffle(peers)
        file.peers.forEach(peer =>
            queryhit(ip, port, messageId, file.id, peer.ip, peer.port)
        )
    })
}

export async function propagateSearch(parameters) {
    config.neighbors.forEach(neighbor =>
        search(neighbor.ip, neighbor.port, parameters.messageId, parameters.ttl, parameters.fileName)
    )
}
