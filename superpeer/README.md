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

Config keys:
- `port`: the port is server will be listening on.
- `keyStorageDir`: directory where to store client public keys, requires write access.
- `enableSignatureChecks`: enable peer identity checks, recommended.
- `logAllDatabase`: display the full content of the database after each non-idempotent request. Not recommended for performance.

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

Refer to the Design Document to know about the protocol format. Here are example data you can use (you need to turn `enableSignatureChecks` to `false` as these requests don't include signatures):

```json
// Register a first peer server
{"name":"registry","parameters":{"uuid":"769f8727-ea80-42f1-9f42-49e8e6757656","ip":"1.1.1.1","port":42,"files":[]}}

// Update the same server information
{"name":"registry","parameters":{"uuid":"769f8727-ea80-42f1-9f42-49e8e6757656","ip":"1.1.1.1","port":42,"files":[{"hash":"aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d","name":"french.png","size":45000},{"hash":"7f550a9f4c44173a37664d938f1355f0f92a47a7","name":"italian.png","size":900000000000}]}}

// Do the opposite update with a second peer
{"name":"registry","parameters":{"uuid":"0ca3a65e-d5b1-4d95-baf1-42fd5812cc34","ip":"1.1.1.1","port":42,"files":[{"hash":"d083f45d08841f886b7cbe0507f7808a7ec6316e","name":"spanish.png","size":78400}]}}
{"name":"registry","parameters":{"uuid":"0ca3a65e-d5b1-4d95-baf1-42fd5812cc34","ip":"1.1.1.1","port":42,"files":[]}}

// Register a third peer server
{"name":"registry","parameters":{"uuid":"1ebea849-5861-458a-93da-3fafce793d63","ip":"1.1.1.2","port":42,"files":[{"hash":"7f550a9f4c44173a37664d938f1355f0f92a47a7","name":"italian.png","size":900000000000}]}}

// Query for a file
{"name":"search","parameters":{"fileName":"italian.png"}}
{"name":"search","parameters":{"fileName":"fren"}}
{"name":"search","parameters":{"fileName":"spanish"}}
```
