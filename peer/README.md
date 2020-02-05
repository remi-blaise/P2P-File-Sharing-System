# P2P peer software

## Install dependencies

First, you will to install the dependencies:

```bash
npm install
```

## Configure the software

Do at least once:

1) Copy the configuration: `cp config.js.dist config.js`
2) Edit the file: `vim config.js`

## Generate your keys

You need to generate your keys if you want to use the peer as a server in the network:

```bash
npm run generate-keys
```

## Start the software

Run:

```bash
npm start
```
