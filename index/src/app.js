/**
 * app.js
 *
 * Entry point of the software, instanciate the server
 *
 * @author Rémi Blaise <hello@remi-blaise.com>
 */

import net from 'net'
import config from './config'
import procedures from './procedures'

/**
 * Utility function, send an error through the socket and close the connection
 */
function sendError(socket, exception = "") {
    console.log("An error occurred:", exception)
    socket.write(JSON.stringify({
        status: 'error',
        message: typeof exception === 'string' ? exception : "Server error."
    }))
    socket.destroy()
    console.log("Error response sent.")
}

/**
 * Utility function, send data through the socket and close the connection
 */
function sendData(socket, data = null) {
    socket.write(JSON.stringify({
        status: 'success',
        data
    }))
    socket.destroy()
    console.log("Response sent.")
}

// Create the server
const server = net.createServer(socket => {
    socket.on('data', async buffer => {
        console.log("Request incoming!")

        // 1. Retrieve the message received through the socket

        const message = buffer.toString()

        // 2. Parse message

        try {
            var procedure = JSON.parse(message)
        }
        catch (exception) {
            return sendError(socket, "Can't parse JSON.")
        }

        // 3. Call the requested procedure

        if (!(procedure.name in procedures)) return sendError(socket, "Wrong procedure name.")

        try {
            var data = await procedures[procedure.name](procedure.parameters)
        }
        catch (exception) {
            return sendError(socket, exception)
        }

        // 4. Reply through the socket

        return sendData(socket, data)
    })
})

// Handle errors
server.on('error', err => {
    throw err
})

// Listen on the port
server.listen(config.port, () => {
    console.log('Server is listening...')
})

