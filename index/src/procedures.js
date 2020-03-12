/**
 * procedures.js
 *
 * Define the procedures of the provided API
 * Here goes the business logic
 *
 * @author Rémi Blaise <hello@remi-blaise.com>
 */

import { isUUID, isPort, isIP, isHash, isInt } from 'validator'
import crypto from 'crypto'
import fs from 'fs'
import config from './config'
import { registerPeer, retrieveFiles } from './repository'

// Utility function
function checkForParameter(name, parameters) {
    if (!(name in parameters)) throw name + ' parameter is missing.'
}

// Fisher-Yates from https://javascript.info/task/shuffle
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1)) // random index from 0 to i
        ;[array[i], array[j]] = [array[j], array[i]]
    }
}

/**
 * The registry procedure
 * @param {object} parameters
 * @return {any} data
 */
async function registry(parameters) {
    // 1. Validate parameters

    checkForParameter('ip', parameters)
    checkForParameter('port', parameters)
    checkForParameter('files', parameters)
    if (config.enableSignatureChecks) checkForParameter('signature', parameters)

    if (typeof parameters.ip !== 'string' || !isIP(parameters.ip)) throw "Bad ip."
    if (typeof parameters.port !== 'number' || !isPort(parameters.port.toString())) throw "Bad port."
    if (!Array.isArray(parameters.files)) throw "Files should be an array."
    if (config.enableSignatureChecks && typeof parameters.signature !== 'string') throw "Signature should be a string."

    parameters.files.forEach((file, index) => {
        if (typeof file !== 'object') throw 'file #' + index + " should be an object."
        checkForParameter('hash', file)
        checkForParameter('name', file)
        checkForParameter('size', file)
        if (typeof file.hash !== 'string' || !isHash(file.hash, 'sha1')) throw 'file #' + index + "'s hash is not a valid sha-1 hash."
        if (typeof file.name !== 'string') throw 'file #' + index + "'s name should be a string."
        if (typeof file.size !== 'number' || !isInt(file.size.toString())) throw 'file #' + index + "'s size should be an int in byte."
    })

    const matchingLeafs = config.leafNodes.filter(leaf => leaf.ip === parameters.ip && leaf.port === parameters.port)
    if (matchingLeafs.length !== 1) throw "Unknow leaf node in config."
    const leafPeer = matchingLeafs[0]
    const leafIndex = config.leafNodes.indexOf(leafPeer)

    // 2. Verify the signature

    if (config.enableSignatureChecks) {
        const filename = config.keyStorageDir + '/' + leafIndex + '.pem'
        const publicKey = fs.readFileSync(filename)

        // Verify the signature
        const verify = crypto.createVerify('SHA256')
        verify.write(JSON.stringify( (({ ip, port, files }) => { return { name: 'registry', parameters: { ip, port, files } } })(parameters) ))
        verify.end()

        if (!verify.verify(publicKey, parameters.signature, 'hex')) throw "Invalid signature."
    }

    // 3. Persist peer

    registerPeer(
        // I select only data I want from the input
        // in case a malicious person adds unwanted keys
        leafPeer,
        parameters.files.map(({ hash, name, size }) => { return { id: hash + '-' + name, hash, name, size } })
    )
}

/**
 * The search procedure
 * @param {object} parameters
 * @return {any} data
 */
async function search(parameters) {
    // 1. Validate parameters

    checkForParameter('fileName', parameters)
    if (typeof parameters.fileName !== 'string') throw "fileName should be a string."

    // 2. Search for the file

    const files = await retrieveFiles(parameters.fileName)

    // 3. Randomize peer lists

    files.forEach(file => shuffle(file.peers))

    return files
}

export default {
    registry,
    search
}
