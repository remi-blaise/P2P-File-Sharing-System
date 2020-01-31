import fs from 'promise-fs'
import uuid from 'uuid/v1'

const configFile = './config.json'

export const config = JSON.parse(fs.readFileSync(configFile).toString())

// Retrieve or create peer ID
if (config.peerId == undefined || config.peerId == '') {
	config.peerId = uuid()
	fs.writeFileSync(configFile, JSON.stringify(config, null, '\t'))
}
