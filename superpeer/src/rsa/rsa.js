/**
 * RSA Algorithm
 * This file contains functions for all the phases of the algorithm:
 * - Key generation
 * - Encryption
 * - Decryption
 * Resources used to make this implementation:
 * - https://en.wikipedia.org/wiki/RSA_(cryptosystem)
 * - https://www.di-mgt.com.au/rsa_alg.html
 * - https://tools.ietf.org/html/rfc8017
 * - https://tls.mbed.org/kb/cryptography/asn1-key-structures-in-der-and-pem
 */

import keypair from 'keypair' // Used to generate the key pair
import bigInt from 'big-integer' // Used to handle more easily BitInt types
import { createHash, randomBytes } from 'crypto' // Functions necessary for OAEP
import asn1 from './asn1' // Custom module to decode PEM key files

/**
 * @typedef {Object} KeyPair
 * @property {string} public - Public key
 * @property {string} private - Private key
 */
/**
 * Generate RSA public and private keys
 * @param {number} length - Length of the key in bits
 * @return {KeyPair} Public key and private key in PEM format (PKCS#1)
 */
function generateKeyPair(length = 1024) {
    return keypair({ bits: length })
}

/**
 * @typedef {Object} Key
 * @property {BigInt} n - Public key modulus
 * @property {BigInt} e - Public key exponent
 * @property {BigInt} d - Private key exponent
 * @property {'private'|'public'} type - Private or public key
 * @property {number} length - Length of the public modulus in bytes
 */
/**
 * Import a public/private key from PEM format (PKCS#1)
 * @param {string} key - PEM string key
 * @return {Key} Key
 */
function importKey(key) {
    let type
    if (key.startsWith('-----BEGIN RSA PUBLIC KEY-----')) {
        type = 'public'
    } else if (key.startsWith('-----BEGIN RSA PRIVATE KEY-----')) {
        type = 'private'
    } else {
        throw new Error('Incorrect key format')
    }

    const ber = key
        .replace('-----BEGIN RSA PUBLIC KEY-----\n', '')
        .replace('\n-----END RSA PUBLIC KEY-----', '')
        .replace('-----BEGIN RSA PRIVATE KEY-----\n', '')
        .replace('\n-----END RSA PRIVATE KEY-----', '')

    const { sizes, values } = asn1.decode(Buffer.from(ber, 'base64'))

    if (type == 'public') {
        return { n: values[0], e: values[1], type, length: sizes[0] - 1 }
    } else {
        return { n: values[1], d: values[3], type, length: sizes[1] - 1 }
    }
}

/**
 * Encrypt a message using RSA
 * @param {number | BigInt} message - Message to encrypt
 * @param {BigInt} n - Public key modulus
 * @param {BigInt} e - Public key exponent
 * @return {BigInt} Encrypted message as a cyphertext
 */
function encrypt(message, n, e) {
    // To encrypt, we need to compute the cyphertext c ≡ m^e mod n
    return bigInt(message).modPow(e, n).value
}

/**
 * Decrypt a cypher using RSA
 * @param {number | BigInt} cypher - Message to decrypt
 * @param {BigInt} d - Private key exponent
 * @param {BigInt} n - Public key modulus
 * @return {BigInt} Decrypted message
 */
function decrypt(cypher, d, n) {
    // To encrypt, we need to compute m ≡ c^d mod n
    return bigInt(cypher).modPow(d, n).value
}

/**
 * Integer to Octet Stream Primitive
 * I2OSP converts a nonnegative integer to an octet string of a specified length
 * https://tools.ietf.org/html/rfc8017#section-4.1
 * @param {number | BigInt} x - Nonnegative integer to be converted
 * @param {number} xLen - Intended length of the resulting octet string
 * @return {Buffer} Corresponding octet string of length `xLen`
 */
function i2osp(x, xLen = 4) {
    if (x >= 256 ** xLen) {
        throw new Error('Integer too large')
    }

    let str = x.toString(16)
    str = '0'.repeat(xLen * 2 - str.length) + str

    return Buffer.from(str, 'hex')
}

/**
 * Octet Stream to Integer Primitive
 * OS2IP converts an octet string to a nonnegative integer
 * https://tools.ietf.org/html/rfc8017#section-4.2
 * @param {Buffer} X - Octet string to be converted
 * @return {BigInt} Corresponding nonnegative integer
 */
function os2ip(X) {
    let x = 0n
    for (let i = 0; i < X.length; i++) {
        x += BigInt(X[i]) * (256n ** BigInt(X.length - i - 1))
    }

    return x
}

/**
 * Mask generation function
 * https://en.wikipedia.org/wiki/Mask_generation_function#MGF1
 * @param {Buffer} seed - Seed
 * @param {number} desiredLength - Desired length
 * @return {Buffer} Mask
 */
function mgf1(seed, desiredLength) {
    let temp = ''
    let counter = 0

    while (temp.length < desiredLength) {
        const C = i2osp(counter, 4)
        temp += createHash('sha256').update(Buffer.concat([seed, C])).digest('hex')
        counter++
    }

    return Buffer.from(temp, 'hex').slice(0, desiredLength)
}

/**
 * OAEP Padding using SHA-256 hash function and MGF1
 * https://en.wikipedia.org/wiki/Optimal_asymmetric_encryption_padding
 * https://tools.ietf.org/html/rfc8017#section-7.1.1
 * @param {string} message - Message to pad
 * @param {number} length - Length in octets of the RSA modulus n
 * @return {Buffer} Padded message
 */
function pad(message, length = 128) {
    const hLen = 32 // Length in octets of the hash function output (SHA-256)
    const buffer = Buffer.from(message)
    const mLen = buffer.length // Length in octets of the message to be encrypted

    if (mLen > length - 2 * hLen - 2) {
        throw new Error('Message too long')
    }

    // Let L be the empty string
    // Let lHash = Hash(L), an octet string of length hLen
    const lHash = createHash('sha256').update('').digest('hex')
    // Generate a padding string PS consisting of k - mLen - 2hLen - 2 zero octets
    const ps = Buffer.alloc(length - mLen - 2 * hLen - 2)
    // Concatenate lHash, PS, a single octet with hexadecimal value 0x01, and the message M
    const db = Buffer.concat([Buffer.from(lHash, 'hex'), ps, Buffer.from('01', 'hex'), buffer])
    // Generate a random octet string seed of length hLen
    const seed = randomBytes(hLen)
    // Let dbMask = MGF(seed, k - hLen - 1)
    const dbMask = mgf1(seed, length - hLen - 1)
    // Let maskedDB = DB ^ dbMask
    let maskedDB = Buffer.alloc(length - hLen - 1)
    for (let i = 0; i < maskedDB.length; i++) {
        maskedDB[i] = db[i] ^ dbMask[i]
    }
    // Let seedMask = MGF(maskedDB, hLen)
    const seedMask = mgf1(maskedDB, hLen)
    // Let maskedSeed = seed \xor seedMask
    let maskedSeed = Buffer.alloc(hLen)
    for (let i = 0; i < maskedSeed.length; i++) {
        maskedSeed[i] = seed[i] ^ seedMask[i]
    }
    // Concatenate a single octet with hexadecimal value 0x00, maskedSeed, and maskedDB
    return Buffer.concat([Buffer.from('00', 'hex'), maskedSeed, maskedDB])
}

/**
 * OEAP Unpadding
 * @param {Buffer} message - Cypher to unpad
 * @param {number} length - Length in octet of the RSA modulus n
 * @return {string} Unpadded message
 */
function unpad(message, length = 128) {
    const hLen = 32 // Length in octets of the hash function output (SHA-256)
    const buffer = Buffer.from(message, 'hex')
    const mLen = buffer.length // Length in octets of the message to be encrypted

    // Let L be the empty string
    // Let lHash = Hash(L), an octet string of length hLen
    const lHash = createHash('sha256').update('').digest('hex')
    // Separate the encoded message EM into a single octet Y, an
    // octet string maskedSeed of length hLen, and an octet
    // string maskedDB of length k - hLen - 1
    const Y = buffer[0]
    if (Y != 0) {
        throw new Error('Decryption error')
    }
    const maskedSeed = buffer.slice(1, hLen + 1)
    const maskedDB = buffer.slice(hLen + 1, mLen)
    // Let seedMask = MGF(maskedDB, hLen)
    const seedMask = mgf1(maskedDB, hLen)
    // Let seed = maskedSeed \xor seedMask
    let seed = Buffer.alloc(hLen)
    for (let i = 0; i < seed.length; i++) {
        seed[i] = maskedSeed[i] ^ seedMask[i]
    }
    // Let dbMask = MGF(seed, k - hLen - 1)
    const dbMask = mgf1(seed, length - hLen - 1)
    // Let DB = maskedDB \xor dbMask
    let db = Buffer.alloc(length - hLen - 1)
    for (let i = 0; i < db.length; i++) {
        db[i] = maskedDB[i] ^ dbMask[i]
    }
    // Separate DB into an octet string lHash' of length hLen, a
    // (possibly empty) padding string PS consisting of octets
    // with hexadecimal value 0x00, and a message M
    const lHash2 = db.slice(0, hLen)
    if (lHash != lHash2.toString('hex')) {
        throw new Error('Decryption error')
    }
    let val = 0
    let i = hLen
    while (val != 1) {
        if (i >= db.length) {
            throw new Error('Decryption error')
        }
        val = db[i]
        i++
    }
    const m = db.slice(i, db.length)

    return m.toString()
}

/**
 * Encrypt a plain text string using RSA
 * @param {string} message - Message to encrypt
 * @param {Key} key - Public key
 * @return {string} Encrypted messaged (cypher)
 */
function encryptText(message, key) {
    // Check public key
    if (key.type != 'public') {
        throw new Error('This is not a public key')
    }

    // If the message is too long, we break it in chunks
    // This method is not recommended for a real-life usage but it's our
    // only option here because we want to be able to encode messages of variable length
    const hLen = 32
    const maxLength = key.length - 2 * hLen - 2
    const buffer = Buffer.from(message)
    let idx = 0
    let encoded = ''
    while (idx < buffer.length) {
        const length = Math.min(maxLength, buffer.length - idx)
        const submessage = buffer.toString('utf-8', idx, idx + length)
        idx += length
        // EME-OAEP encoding
        const em = pad(submessage, key.length)
        // Convert the encoded message EM to an integer message representative m
        const m = os2ip(em)
        // Apply RSA to produce an integer ciphertext representative c
        const c = encrypt(m, key.n, key.e)
        // Convert the ciphertext representative c to a ciphertext of length k octets
        encoded += i2osp(c, key.length).toString('hex')
    }

    return encoded
}

/**
 * Decrypt a cypher to plain text using RSA
 * @param {string} cypher - Cypher to decrypt
 * @param {Key} key - Private key
 * @return {string} Plain text message
 */
function decryptText(cypher, key) {
    // Check private key
    if (key.type != 'private') {
        throw new Error('This is not a private key')
    }

    // Decode the message chunk by chunk
    let idx = 0
    let decoded = ''
    while (idx < cypher.length) {
        const length = Math.min(key.length * 2, cypher.length - idx)
        const subcypher = cypher.substr(idx, length)
        idx += length
        // Convert the ciphertext to an integer ciphertext representative c
        const c = os2ip(Buffer.from(subcypher, 'hex'))
        // Apply RSA to produce an integer message representative m
        const m = decrypt(c, key.d, key.n)
        // Convert the message representative m to an encoded message EM of length k octets
        const em = i2osp(m, key.length)
        // EME-OAEP decoding
        decoded += unpad(em, key.length)
    }

    return decoded
}

export default { generateKeyPair, importKey, encryptText, decryptText }
