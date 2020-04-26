/**
 * Decode the tag from byte
 * @param {number} byte - Tag byte
 * @return {string} Tag
 */
function decodeTag(byte) {
    switch (byte) {
        case 2:
            return 'INTEGER'
        case 3:
            return 'BITSTRING'
        case 48:
            return 'SEQUENCE'
        default:
            throw new Error(`Unsupported type ${byte}`)
    }
}

/**
 * Decode a DER encoded buffer
 * @param {Buffer} buffer - Buffer to decode
 * @return {number[]} Decoded values
 */
function decode(buffer) {
    let i = 0
    let values = []
    let sizes = []
    while (i < buffer.length) {
        const tag = decodeTag(buffer[i])
        i++
        const firstByte = buffer[i]
        i++
        let size
        if (firstByte < 127) {
            size = firstByte
        }
        else if (firstByte > 127) {
            const sizeLen = firstByte - 0x80
            size = 0
            for (let j = 0; j < sizeLen; j++) {
                size = size * 256 + buffer[i]
                i++
            }
        }

        if (tag == 'INTEGER') {
            let value = 0n
            for (let j = 0; j < size; j++) {
                value = value * 256n + BigInt(buffer[i])
                i++
            }
            sizes.push(size)
            values.push(value)
        }
    }
    return { values, sizes }
}

export default { decode }
