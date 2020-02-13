/**
 * app.js
 *
 * Entry point of the software, instanciate the server
 *
 * @author Rémi Blaise <hello@remi-blaise.com>
 */

import fs from 'fs'
import net from 'net'
import config from './config'
import procedures from './procedures'

// Create keyStorageDir if doesn't exist
if (!fs.existsSync(config.keyStorageDir)) {
    fs.mkdirSync(config.keyStorageDir)
    console.log(`Key storage directory created at path ${config.keyStorageDir}`)
}

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const BLUE = '\x1b[33m'

// Utility function
function send(socket, response) {
    socket.write(response, () => {
        socket.destroy()
        console.log(`${BOLD}${GREEN}Response sent:${RESET}${BLUE}`, response, RESET)
    })
}

/**
 * Utility function, send an error through the socket and close the connection
 */
function sendError(socket, exception = "") {
    console.log(`${BOLD}${RED}An error occurred:`, exception, RESET)
    send(socket, JSON.stringify({
        status: 'error',
        message: typeof exception === 'string' ? exception : "Server error."
    }))
}

/**
 * Utility function, send data through the socket and close the connection
 */
function sendData(socket, data = null) {
    send(socket, JSON.stringify({
        status: 'success',
        data
    }))
}

// Create the server
const server = net.createServer(socket => {
    socket.on('data', async buffer => {
        // 1. Retrieve the message received through the socket

        const message = buffer.toString()
        console.log(`${BOLD}${GREEN}Request incoming!${RESET}${BLUE}`, message, RESET)

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

    // Handle socket errors
    socket.on('error', exception => {
        socket.destroy()
        console.log(`${BOLD}${RED}Connection has been closed by the client:`, exception.message, RESET)
    })
})

// Handle errors
server.on('error', err => {
    throw err
})

// Listen on the port
server.listen(config.port, () => {
    console.log(`${BOLD}${GREEN}Server is listening...${RESET}`)
})

