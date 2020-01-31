import net from 'net'
import readline from 'readline'
import process from 'process'
import { PORT } from './config'

const stdin = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

stdin.question(`Type a message to send to the server:\n> `, (message) => {
    stdin.close()
    console.log("\n")

    const socket = net.createConnection({ port: PORT }, () => {
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
