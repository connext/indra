# Virtual Channels Tests

## Requirements

1. [latest Truffle](https://truffleframework.com/docs/getting_started/installation)
2. [Ganache-cli](https://github.com/trufflesuite/ganache-cli) or [Ganache](https://truffleframework.com/ganache). (Note : only fully tested with `Ganache-cli`)

## Usage

### Running tests

Assuming that the repository has been downloaded, from the `virtual-channels` directory

1. run ganache-cli : `npm run ganache`
2. in a separate terminal window run :

   `npm run test-unit`

3. tip : fire up Metamask with the same mnemonic used in Ganache and flip back and forth testing locally using the command line, [remix](http://remix.ethereum.org/) and Rinkeby. Also, works with [Gnosis web wallet](http://wallet.gnosis.pm/).

4. tip 2 : `npm run stop` kills all 8545 processes, useful for stopping ganache

### Issues

Please submit any [issues](https://github.com/SpankChain/virtual-channels/issues) you find!
