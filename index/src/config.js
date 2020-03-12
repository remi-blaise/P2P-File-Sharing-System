/**
 * config.js
 *
 * Read the configuration file
 *
 * @author Rémi Blaise <hello@remi-blaise.com>
 */

import fs from 'fs'

const CONFIG_FILE = './config.json'

const config = JSON.parse(fs.readFileSync(CONFIG_FILE).toString())

// Guarantee leaf node unicity
const makeId = node => node.ip + node.port
const nodeIds = config.leafNodes.map(makeId)
const uniqueIds = [...new Set(nodeIds)]
if (uniqueIds.length !== nodeIds.length) throw "Duplicate leaf nodes in config."

// Ensure the public keys exists
config.leafNodes.forEach((leaf, index) => {
    const filename = config.keyStorageDir + '/' + index + '.pem'
    if (!fs.existsSync(filename)) throw "The peer public key " + filename + " doesn't exist."
})

export default config
