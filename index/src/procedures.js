/**
 * procedures.js
 *
 * Define the procedures of the provided API
 * Here goes the business logic
 *
 * @author Rémi Blaise <hello@remi-blaise.com>
 */

import { isUUID, isPort, isIP, isHash } from 'validator'
import crypto from 'crypto'
import fs from 'fs'
import config from './config'
import { registerPeer, retrieveFilePeers } from './repository'

// Utility function
function checkForParameter(name, parameters) {
    if (!(name in parameters)) throw name + ' parameter is missing.'
}

/**
 * The registry procedure
 * @param {object} parameters
 * @return {any} data
 */
function registry(parameters) {
    // 1. Validate parameters

    checkForParameter('uuid', parameters)
    checkForParameter('ip', parameters)
    checkForParameter('port', parameters)
    checkForParameter('files', parameters)
    checkForParameter('signature', parameters)

    if (typeof parameters.uuid !== 'string' || !isUUID(parameters.uuid)) throw "Bad uuid."
    if (typeof parameters.ip !== 'string' || !isIP(parameters.ip)) throw "Bad ip."
    if (typeof parameters.port !== 'number' || !isPort(parameters.port.toString())) throw "Bad port."
    if (!Array.isArray(parameters.files)) throw "Files should be an array."
    if (typeof parameters.signature !== 'string') throw "Signature should be a string."
    if (parameters.publicKey && typeof parameters.publicKey !== 'string') throw "Bad public key."

    parameters.files.forEach((hash, index) => {
        if (typeof hash !== 'string' || !isHash(hash, 'sha1')) throw 'file #' + index + "'s id is not a valid sha-1 hash."
    })

    // 2. Verify the signature

    const filename = config.keyStorageDir + '/' + parameters.uuid
    let hasPublicKey = fs.existsSync(filename)
    let publicKey

    if (hasPublicKey) {
        // If the public key exists, retrieve it
        publicKey = fs.readFileSync(filename)
    } else {
        // Otherwise, require the public key to be given
        if (!parameters.publicKey) throw "A public key should be given."
        publicKey = parameters.publicKey
    }

    // Verify the signature
    const verify = crypto.createVerify('SHA256')
    verify.write(JSON.stringify( (({ uuid, ip, port, files }) => { return { name: 'registry', parameters: { uuid, ip, port, files } } })(parameters) ))
    verify.end()

    if (!verify.verify(publicKey, parameters.signature, 'hex')) throw "Invalid signature."

    // If it's first registration, store the public key
    if (!hasPublicKey) fs.writeFileSync(filename, publicKey)

    // 3. Persist peer

    registerPeer({
        // I select only data I want from the input
        // in case a malicious person adds unwanted keys
        id: parameters.uuid,
        ip: parameters.ip,
        port: parameters.port,
        files: parameters.files.join(',')
    })
}

/**
 * The search procedure
 * @param {object} parameters
 * @return {any} data
 */
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
