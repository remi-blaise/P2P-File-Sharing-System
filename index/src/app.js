import net from 'net'
import { PORT } from '../config'
import procedures from './procedures'

function sendError(socket, message = "") {
    console.log("An error occurred: " + message)
    socket.write(JSON.stringify({
        status: 'error',
        message
    }))
    socket.destroy()
    console.log("Error response sent.")
}

function sendData(socket, data = null) {
    socket.write(JSON.stringify({
        status: 'success',
        data
    }))
    socket.destroy()
    console.log("Response sent.")
}

const server = net.createServer(socket => {
    socket.on('data', buffer => {
        console.log("Request incoming!")
        const message = buffer.toString()

        try {
            var procedure = JSON.parse(message)
        }
        catch (exception) {
            return sendError(socket, "Can't parse JSON.")
        }

        if (!(procedure.name in procedures)) return sendError(socket, "Wrong procedure name.")

        const data = procedures[procedure.name](procedure.parameters)

        return sendData(socket, data)
    })
})

server.on('error', err => {
    throw err
})

server.listen(PORT, () => {
    console.log('Server is listening...')
})

