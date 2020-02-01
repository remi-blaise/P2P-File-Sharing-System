# P2P index software

## Install dependencies

Run at least once:

```bash
npm install
```

## Configure the software

Do at least once:

1) Copy the configuration: `cp config.json.dist config.json`
2) Edit the file: `nano config.js`

## Start the software

Run:

```bash
npm start
```

## Test with a dump client

You can use the dump client to test the software. This client allow you to manually type input into the socket.

```bash
npm run dump-client
```

Refer to the Design Document to know about the protocol format. Here are example data you can use:

```json
// Register a first peer server
{"name":"registry","parameters":{"uuid":"769f8727-ea80-42f1-9f42-49e8e6757656","ip":"1.1.1.1","port":42,"files":["aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d","7f550a9f4c44173a37664d938f1355f0f92a47a7"]}}

// Register a second peer server
{"name":"registry","parameters":{"uuid":"1ebea849-5861-458a-93da-3fafce793d63","ip":"1.1.1.2","port":42,"files":["7f550a9f4c44173a37664d938f1355f0f92a47a7"]}}

// Query for a file
{"name":"search","parameters":{"fileId":"7f550a9f4c44173a37664d938f1355f0f92a47a7"}}
```
