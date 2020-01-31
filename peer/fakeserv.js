const net = require('net')

// Server-side
const server = net.createServer(socket => {
	socket.write('Echo server\r\n')
	socket.on('data', data => console.log(JSON.parse(data.toString())))
	socket.on('error', err => console.error(`Error: ${err.code}`))
})

server.listen(8080)
