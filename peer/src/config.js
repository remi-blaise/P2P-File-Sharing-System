import fs from 'fs'

const CONFIG_FILE = './config.json'

export default JSON.parse(fs.readFileSync(CONFIG_FILE).toString())
