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

## Testing

You can find the sequential testing script in `peer/test` and run it after having started an index and an other peer:

```bash
# Run test of 500 sequential requests
cd peer
test/sequential
```

It works by using only one client requesting the same 10B file. See `peer/test/sequential_output.png` for the obtained response time.

The concurrential file is locted directly in `test`. Make sure to first download `peer` dependencies and to generate keys and to have `index` and `peer` running.
Then run it from the root:

```bash
test/concurrential 500
```

It works by first copying the `peer` folder as many times as we need clients, then making each client download a 1MB file from the very same Peer-server (located in `peer`) and save the response time. The response time is then saved in `test/concurrential_output.csv`. See `test/concurrential_output0.png` for the resulting graph.

We can see that over 500 simultaneous requests, the time evolution is linear. It shows that the server-Peer can scale almost perfectly until at least 500 requests.

## Contributions

See `CONTRIBUTIONS.md`.

## Credits

Implementation of the security fix #3 using the crypto module is inspired by [itsnuwan/digital-signature-for-document-signing](https://github.com/itsnuwan/digital-signature-for-document-signing), work of Nuwan Attanayake under the MIT license.
