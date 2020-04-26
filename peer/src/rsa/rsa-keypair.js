import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import rsa from './rsa'
import config from '../config'

const privateKeyPath = path.join(config.keyStorageDir, 'private.pem')
const publicKeyPath = path.join(config.keyStorageDir, 'pub.pem')

/**
 * If the key files are not present on disk, generate them
 * @return {Promise}
 */
async function generateKeyPairIfNotExists() {
    const exists = promisify(fs.exists)
    const writeFile = promisify(fs.writeFile)

    const dirExists = await exists(config.keyStorageDir)
    const privateExists = await exists(privateKeyPath)
    const pubExists = await exists(publicKeyPath)

    if (!dirExists || !privateExists || !pubExists) {
        if (!dirExists) {
            await promisify(fs.mkdir)(config.keyStorageDir)
        }

        const keypair = rsa.generateKeyPair()
        await writeFile(privateKeyPath, keypair.private)
        await writeFile(publicKeyPath, keypair.public)
    }
}

/**
 * Read the public key on disk and import it
 * @return {Key} Public key
 */
async function readPublicKey() {
    return rsa.importKey((await promisify(fs.readFile)(publicKeyPath)).toString())
}

/**
 * Read the public key on disk
 * @return {string} Public key as PEM string
 */
async function pemPublicKey() {
    return (await promisify(fs.readFile)(publicKeyPath)).toString()
}

/**
 * Read the private key on disk and import it
 * @return {Key} Private key
 */
async function readPrivateKey() {
    return rsa.importKey((await promisify(fs.readFile)(privateKeyPath)).toString())
}

export { generateKeyPairIfNotExists, pemPublicKey, readPublicKey, readPrivateKey }
