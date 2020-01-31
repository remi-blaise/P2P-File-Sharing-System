import fs from 'promise-fs'
import uuid from 'uuid/v1'

const configFile = './config.json'

export const config = JSON.parse(fs.readFileSync(configFile).toString())

// Retrieve or create peer ID
if (config.peerId == null || config.peerId == '') {
	module.exports.peerId = uuid()
	fs.writeFileSync(configFile, JSON.stringify(module.exports, null, '\t'))
}
