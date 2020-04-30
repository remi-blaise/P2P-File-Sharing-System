/**
 * query.js
 *
 * Handle queries' local search and propagation
 *
 * @author Rémi Blaise <hello@remi-blaise.com>
 */

import { shareKey, search, queryhit, invalidate } from './interface'
import { retrieveFiles } from './repository'
import keystore from './keystore'
import config from './config'

// Fisher-Yates from https://javascript.info/task/shuffle
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1)) // random index from 0 to i
            ;[array[i], array[j]] = [array[j], array[i]]
    }
}

export async function localSearch(messageId, fileName, ip, port, key) {
    // Search locally
    const files = await retrieveFiles(fileName)

    // Send one `queryhit` request back to the peer
    files.forEach(file => {
        const peers = [...file.peers]
        shuffle(peers)
        file.peers.forEach(peer =>
            queryhit(ip, port, messageId, file.name, peer.ip, peer.port, keystore.getKey(`${peer.ip}:${peer.port}`))
        )
    })
}

export async function propagateSearch(parameters) {
    config.neighbors.forEach(neighbor => {
        // Exchange public keys first if we don't have it
        if (keystore.getKey(`${neighbor.ip}:${neighbor.port}`) === undefined) {
            shareKey(neighbor.ip, neighbor.port)
                .then(() => {
                    search(neighbor.ip, neighbor.port, parameters.messageId, parameters.ttl, parameters.fileName)
                })
        } else {
            search(neighbor.ip, neighbor.port, parameters.messageId, parameters.ttl, parameters.fileName)
        }
    })
}

export async function propagateInvalidate(parameters) {
    config.neighbors.forEach(neighbor => {
        // Exchange public keys first if we don't have it
        if (keystore.getKey(`${neighbor.ip}:${neighbor.port}`) === undefined) {
            shareKey(neighbor.ip, neighbor.port)
                .then(() => {
                    invalidate(neighbor.ip, neighbor.port, parameters.messageId, parameters.fileName, parameters.version)
                })
        } else {
            invalidate(neighbor.ip, neighbor.port, parameters.messageId, parameters.fileName, parameters.version)
        }
    })

    config.leafNodes.filter(leafnode => leafnode.ip != parameters.ip || leafnode.port != parameters.port)
        .forEach(leafnode =>
            invalidate(leafnode.ip, leafnode.port, parameters.messageId, parameters.fileName, parameters.version)
        )
}
