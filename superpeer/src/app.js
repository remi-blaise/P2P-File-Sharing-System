/**
 * app.js
 *
 * Entry point of the software, instanciate the server
 *
 * @author Rémi Blaise <hello@remi-blaise.com>
 */

import net from 'net'
import rsa from './rsa/rsa'
import config from './config'
import keystore from './keystore'
import procedures from './procedures'
import { generateKeyPairIfNotExists, readPrivateKey } from './rsa/rsa-keypair'
import { RESET, BOLD, RED, GREEN, BLUE } from './colors'

// Generate key pair if necessary
generateKeyPairIfNotExists()

// Utility function
function send(socket, response, id) {
    if (id === undefined || keystore.getKey(id) === undefined) {
        // Send plain text message (key missing)
        socket.write(response, () => {
            socket.destroy()
            console.log(`${BOLD}${GREEN}Response sent:${RESET}${BLUE}`, response, RESET)
        })
    } else {
        // Send encrypted message
        const key = rsa.importKey(keystore.getKey(id))
        const cypher = rsa.encryptText(response, key)
        socket.write(cypher, () => {
            socket.destroy()
            console.log(`${BOLD}${GREEN}Response sent:${RESET}${BLUE}`, response, RESET)
            if (config.debugRSA) console.log('Cyphertext:', cypher)
        })
    }
}

/**
 * Utility function, send an error through the socket and close the connection
 */
function sendError(socket, exception = '', id) {
    console.log(`${BOLD}${RED}An error occurred:`, exception, RESET)
    send(socket, JSON.stringify({
        status: 'error',
        message: typeof exception === 'string' ? exception : 'Server error.'
    }), id)
}

/**
 * Utility function, send data through the socket and close the connection
 */
function sendData(socket, data = null, id) {
    send(socket, JSON.stringify({ status: 'success', data }), id)
}

async function executeProcedure(socket, procedure) {
    if (!(procedure.name in procedures)) return sendError(socket, 'Wrong procedure name.', procedure.parameters.id)

    try {
        var data = await procedures[procedure.name](procedure.parameters)
    }
    catch (exception) {
        return sendError(socket, exception, procedure.parameters.id)
    }

    // 4. Reply through the socket

    return sendData(socket, data, procedure.parameters.id)
}

// Create the server
const server = net.createServer(socket => {
    socket.on('data', async buffer => {
        // 1. Retrieve the message received through the socket

        let message = buffer.toString()
        console.log(`${BOLD}${GREEN}Request incoming!${RESET}${BLUE}`, message, RESET)

        // 2. Parse message

        try {
            const procedure = JSON.parse(message)

            // 3. Call the requested procedure

            return executeProcedure(socket, procedure)
        }
        catch {
            // Encrypted message
            const key = await readPrivateKey()
            message = rsa.decryptText(message, key)
            if (config.debugRSA) console.log('Decrypted message:', message)

            try {
                const procedure = JSON.parse(message)

                // 3. Call the requested procedure

                return executeProcedure(socket, procedure)
            }
            catch (exception) {
                return sendError(socket, 'Can\'t parse JSON.')
            }
        }
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
