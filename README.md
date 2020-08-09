[![](https://github.com/ConnextProject/indra/workflows/CD%20Master/badge.svg)](https://github.com/ConnextProject/indra/actions)
[![](https://github.com/ConnextProject/indra/workflows/CD%20Staging/badge.svg)](https://github.com/ConnextProject/indra/actions)

[![](https://img.shields.io/discord/454734546869551114)](https://discord.gg/m93Sqf4)
[![](https://img.shields.io/twitter/follow/ConnextNetwork?style=social)](https://twitter.com/ConnextNetwork)

# Indra

Connext is the protocol for p2p micropayments. To learn more about this project, check out our [docs](https://docs.connext.network). This monorepo contains all the core pieces necessary to run a node in or interact with the Connext Network.

For any unanswered questions, open a [new issue](https://github.com/ConnextProject/indra/issues/new) or reach out on our [Discord channel](https://discord.gg/SmMSFf) & we'll be happy to help.

## Architecture Overivew

Indra contains several packages to help developers interact with the Connext state channel network:

- [@connext/client](https://docs.connext.network/en/latest/reference/client.html): state channel client
- [@connext/cf-core](https://docs.connext.network/en/latest/reference/cf-core.html): lower level channel protocol logic
- [@connext/store](https://docs.connext.network/en/latest/reference/store.html): various implementations of the `IStoreService` type for client usage
- [@connext/types](https://docs.connext.network/en/latest/reference/types.html): type definitions
- [@connext/utils](https://docs.connext.network/en/latest/reference/utils.html): core channel utilities and helpers
- [@connext/watcher](https://docs.connext.network/en/latest/reference/watcher.html): watchtower package for responding to and managing channel disputes

## Launch Indra Locally

**Prerequisites:**

- `make`: Probably already installed, otherwise install w `brew install make` or `apt install make` or similar.
- `jq`: Probably not installed yet, install w `brew install jq` or `apt install jq` or similar.
- `docker`: sadly, Docker is kinda annoying to install. See [website](https://www.docker.com/) for instructions.

To start, clone & enter the Indra repo:

```bash
git clone https://github.com/ConnextProject/indra.git
cd indra
```

To build everything and deploy Indra in dev-mode, run the following:

```bash
make start

# view the node logs
bash ops/logs.sh node
```

That's all! But beware: the first time `make start` is run, it will take a very long time (maybe 10 minutes, depends on your internet speed) but have no fear: downloads will be cached & most build steps won't ever need to be repeated again so subsequent `make start` runs will go much more quickly. Get this started asap & browse the rest of the README while the first `make start` runs.

By default, Indra will launch using two local chains (ganache with chain id `1337` and `1338`) but you can also run a local Indra stack against a public chain (or multiple chains!) such as Rinkeby. To do so, run `make start` with a custom `INDRA_CHAIN_PROVIDERS` environment variable. The variable is formatted as a JSON string with a chainId:providerUrl mapping:

```bash
INDRA_CHAIN_PROVIDERS='{"4":"https://rinkeby.infura.io/abc123","42":"https://kovan.infura.io/abc123"}' make start
```

Note: this will start a local Connext node pointed at a remote chain, so make sure the mnemonic used to start your node is funded in the appropriate native currencies and supported chain assets. By default, the node starts with the account:

```node
mnemonic: "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";
privateKey: "0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3";
address: "0x627306090abaB3A6e1400e9345bC60c78a8BEf57";
```

For more information on developing with Indra stack, see the [quickstart](https://docs.connext.network/en/latest/quickstart/introduction.html).

## Resources

### Further Reading

- [Indra architecture and protocol](https://docs.connext.network/en/latest/background/architecture.html)
- [State channels background](https://docs.connext.network/en/latest/quickstart/introduction.html#state-channel-basics)
- [What is Connext](https://docs.connext.network/en/latest/quickstart/introduction.html#what-is-connext)

### Developer Resources and Guides

- [Quick Start Guide](https://docs.connext.network/en/latest/quickstart/introduction.html)
- [Deploying indra](https://docs.connext.network/en/latest/how-to/deploy-indra.html)
- [Integrating additional chains](https://docs.connext.network/en/latest/how-to/integrate-chain.html)
- [Integrating clients in node](https://docs.connext.network/en/latest/how-to/integrate-node.html)
- [Integrating clients in the browser](https://docs.connext.network/en/latest/how-to/integrate-browser.html)
- [Integrating clients in react native](https://docs.connext.network/en/latest/how-to/integrate-react-native.html)
- [FAQ](https://docs.connext.network/en/latest/background/faq.html)

### Contributing

If you're interested in contributing, great! See [this guide](https://docs.connext.network/en/latest/contributor/CONTRIBUTING.html) before starting.
