/**
 * procedures.js
 *
 * Define the procedures of the provided API
 * Here goes the business logic
 *
 * @author Rémi Blaise <hello@remi-blaise.com>
 */

import { isUUID, isPort, isIP, isHash } from 'validator'
import { registerPeer, retrieveFilePeers } from './repository'

function checkForParameter(name, parameters) {
    if (!(name in parameters)) throw name + ' parameter is missing.'
}

function registry(parameters) {
    // 1. Validate parameters

    checkForParameter('uuid', parameters)
    checkForParameter('ip', parameters)
    checkForParameter('port', parameters)
    checkForParameter('files', parameters)

    if (typeof parameters.uuid !== 'string' || !isUUID(parameters.uuid)) throw "Bad uuid."
    if (typeof parameters.ip !== 'string' || !isIP(parameters.ip)) throw "Bad ip."
    if (typeof parameters.port !== 'number' || !isPort(parameters.port.toString())) throw "Bad port."
    if (!Array.isArray(parameters.files)) throw "Files should be an array."

    parameters.files.forEach((hash, index) => {
        if (typeof hash !== 'string' || !isHash(hash, 'sha1')) throw 'file #' + index + "'s id is not a valid sha-1 hash."
    })

    // 2. Persist peer

    registerPeer({
        // I select only data I want from the input
        // in case a malicious person adds unwanted keys
        id: parameters.uuid,
        ip: parameters.ip,
        port: parameters.port,
        files: parameters.files.join(',')
    })
}

function search(parameters) {
    // 1. Validate parameters

    checkForParameter('fileId', parameters)

    if (typeof parameters.fileId !== 'string' || !isHash(parameters.fileId, 'sha1')) throw "fileId should be a valid sha-1 hash."

    // 2. Search for the file

    return retrieveFilePeers(parameters.fileId)
}

export default {
    registry,
    search
}
