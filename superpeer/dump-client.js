import net from 'net'
import readline from 'readline'
import process from 'process'
import fs from 'fs'
import config from './src/config'

const CACHE = '.cache/dump-client'

const stdin = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

stdin.question(`Type a message to send to the server: [press Enter for last]\n> `, (message) => {
    stdin.close()

    if (message) {
        fs.writeFileSync(CACHE, message)
    }
    else {
        try {
            message = fs.readFileSync(CACHE)
            console.log('Send: ' + message)
        }
        catch (exception) {
            console.log("Can't read last line.")
            return
        }
    }

    const socket = net.createConnection({ port: config.port }, () => {
        console.log('connected to server!')
        socket.write(message)
        console.log('message sent')
    })

    socket.on('data', buffer => {
        console.log(buffer.toString())
        socket.end()
    })

    socket.on('end', () => {
        console.log('disconnected by server')
    })
})
