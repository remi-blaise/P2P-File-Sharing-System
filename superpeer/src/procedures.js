/**
 * procedures.js
 *
 * Define the procedures of the provided API
 * Here goes the business logic
 *
 * @author Rémi Blaise <hello@remi-blaise.com>
 */

import { isPort, isIP, isHash, isInt } from 'validator'
import crypto from 'crypto'
import fs from 'fs'
import config from './config'
import { registerPeer, logMessage, getMessageSender, flushMessages } from './repository'
import { localSearch, propagateSearch, propagateInvalidate } from './search'
import { queryhit as clientQueryhit } from './interface'

// Utility function
function checkForParameter(name, parameters) {
    if (!(name in parameters)) throw name + ' parameter is missing.'
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
        //checkForParameter('hash', file)
        checkForParameter('name', file)
        //checkForParameter('size', file)
        //if (typeof file.hash !== 'string' || !isHash(file.hash, 'sha1')) throw 'file #' + index + "'s hash is not a valid sha-1 hash."
        if (typeof file.name !== 'string') throw 'file #' + index + "'s name should be a string."
        //if (typeof file.size !== 'number' || !isInt(file.size.toString())) throw 'file #' + index + "'s size should be an int in byte."
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
        verify.write(JSON.stringify((({ ip, port, files }) => { return { name: 'registry', parameters: { ip, port, files } } })(parameters)))
        verify.end()

        if (!verify.verify(publicKey, parameters.signature, 'hex')) throw "Invalid signature."
    }

    // 3. Persist peer

    registerPeer(
        // I select only data I want from the input
        // in case a malicious person adds unwanted keys
        leafPeer,
        parameters.files
    )
}

/**
 * The search procedure
 * @param {object} parameters
 * @return {any} data
 */
async function search(parameters) {
    // 1. Validate parameters

    checkForParameter('messageId', parameters)
    checkForParameter('ttl', parameters)
    checkForParameter('fileName', parameters)
    checkForParameter('ip', parameters)
    checkForParameter('port', parameters)
    if (typeof parameters.messageId !== 'string') throw "messageId should be a string."
    if (typeof parameters.ttl !== 'number') throw "ttl should be a number."
    if (typeof parameters.fileName !== 'string') throw "fileName should be a string."
    if (typeof parameters.ip !== 'string') throw "ip should be a string."
    if (typeof parameters.port !== 'number') throw "port should be a string."

    // 2. Ignore if the message was already received

    if (getMessageSender(parameters.messageId) != undefined) {
        return null
    }

    // 3. Start local search

    localSearch(parameters.messageId, parameters.fileName, parameters.ip, parameters.port)

    // 4. Log the message

    logMessage(parameters.messageId, parameters.ip, parameters.port)

    // 5. Propagate request

    if (parameters.ttl > 0) propagateSearch({ ...parameters, ttl: parameters.ttl - 1 })

    // 6. Flush log

    flushMessages()

    return null
}

/**
 * The queryhit procedure
 * @param {object} parameters
 * @return {any} data
 */
async function queryhit(parameters) {
    // 1. Validate parameters

    checkForParameter('messageId', parameters)
    if (typeof parameters.messageId !== 'string') throw "messageId should be a string."
    checkForParameter('fileId', parameters)
    if (typeof parameters.fileId !== 'string') throw "fileId should be a string."
    checkForParameter('ip', parameters)
    if (typeof parameters.ip !== 'string') throw "ip should be a string."
    checkForParameter('port', parameters)
    if (typeof parameters.port !== 'number') throw "port should be a number."

    // 2. Search for original message

    const sender = getMessageSender(parameters.messageId)

    // 3. Backpropagate

    if (sender !== undefined) {
        clientQueryhit(sender.ip, sender.port, parameters.messageId, parameters.fileId, parameters.fileHash, parameters.fileName, parameters.fileSize, parameters.ip, parameters.port)
    }

    return null
}

/**
 * The invalidate procedure
 * @param {object} parameters
 * @return {any} data
 */
function invalidate(parameters) {
    // 1. Validate parameters

    checkForParameter('messageId', parameters)
    if (typeof parameters.messageId !== 'string') throw "messageId should be a string."
    checkForParameter('fileName', parameters)
    if (typeof parameters.fileName !== 'string') throw "fileName should be a string."
    checkForParameter('version', parameters)
    if (typeof parameters.version !== 'number') throw "version should be a number."
    checkForParameter('ip', parameters)
    if (typeof parameters.ip !== 'string') throw "ip should be a string."
    checkForParameter('port', parameters)
    if (typeof parameters.port !== 'number') throw "port should be a number."

    // 2. Ignore if the message was already received

    if (getMessageSender(parameters.messageId) != undefined) {
        return null
    }

    // 3. Log the message

    logMessage(parameters.messageId, parameters.ip, parameters.port)

    // 4. Propagate request

    propagateInvalidate(parameters)

    // 5. Flush log

    flushMessages()

    return null
}

export default {
    registry,
    search,
    queryhit,
    invalidate
}
