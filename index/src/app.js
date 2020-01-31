import net from 'net'
import { PORT } from '../config'

const server = net.createServer(socket => {
    socket.on('data', buffer => {
        console.log(buffer.toString())
        socket.destroy()
    })
})

server.on('error', err => {
    throw err
})

server.listen(PORT, () => {
    console.log('Server is listening...')
})

