# P2P File Sharing System

By Florentin Bekier and Rémi Blaise.

## Requirements

Install node v12. Here is the recommanded procedure with `nvm` (Node Version Manager):
```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.2/install.sh | bash

# Install node and npm
nvm install 12

# Check your version of node
node -v
```

## Usage

To launch an index server or a peer, move to the according directory and refer to the `README.md`.
Be carefull specifying the same value for the `port` key of the index' `config.json` and the `indexPort` key of the peer's `config.json`.

## Contributions

See `CONTRIBUTIONS.md`.
