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
if (uniqueIds.length !== nodeIds.length) throw 'Duplicate leaf nodes in config.'

export default config
