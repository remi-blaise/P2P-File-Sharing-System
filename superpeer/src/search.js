/**
 * query.js
 *
 * Handle queries' local search and propagation
 *
 * @author Rémi Blaise <hello@remi-blaise.com>
 */

import { search, queryhit, invalidate, poll } from './interface'
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
            queryhit(ip, port, messageId, file.name, peer.ip, peer.port)
        )
    })
}

export async function propagateSearch(parameters) {
    config.neighbors.forEach(neighbor =>
        search(neighbor.ip, neighbor.port, parameters.messageId, parameters.ttl, parameters.fileName)
    )
}

export async function propagateInvalidate(parameters) {
    config.neighbors.forEach(neighbor =>
        invalidate(neighbor.ip, neighbor.port, parameters.messageId, parameters.fileName, parameters.version)
    )

    config.leafNodes.filter(leafnode => leafnode.ip != parameters.ip || leafnode.port != parameters.port)
    .forEach(leafnode =>
        invalidate(leafnode.ip, leafnode.port, parameters.messageId, parameters.fileName, parameters.version)
    )
}

/**
 * Refresh one file
 * @param {Object} file - File Sequelize entity
 */
async function refresh(file, leafIp, leafPort) {
    const responses = await Promise.all(
        config.neighbors.map(neighbor => poll(neighbor.ip, neighbor.port, file.name, file.version))
    )

    responses.forEach(({ outOfDate }) => {
        if (outOfDate) {
            invalidate(leafIp, leafPort, 0, file.name, file.version)
        }
    })

    // Set up timeout
    setRefreshTimeout(file)
}

export function setRefreshTimeout(file, leafIp, leafPort) {
    setTimeout(() => refresh(file, leafIp, leafPort), file.ttr * 1000) // Can elicit stack overflow?
}
