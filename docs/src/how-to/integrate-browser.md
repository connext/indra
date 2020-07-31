# How To Integrate With a Browser App

The connext client `@connext/client` has built-in defaults that make it easy to use in a web browser. By default, the client will store it's state in localStorage (Look for keys prefixed with `INDRA_CLIENT_CF_CORE`).

To get started, install the required connext package.

```
npm install @connext/client
```

## Prerequisites

1. You need access to an Indra node.

Connext exposes 2 Indra nodes for public use:

- `https://rinkeby.indra.connext.network`: Good for testing & experimenting on the Rinkeby test net
- `https://indra.connext.network`: To interact with mainnet channels in production.

You can also run your own Indra node locally by running the start command in an indra repo.

```bash
git clone https://github.com/connext/indra
cd indra
make start-headless
```

Once Indra wakes up after running the above, it'll be available at http://localhost:8080 + a testnet eth provider will be available at http://localhost:8545 (you can send testnet ETH to any address by running `bash ops/fund.sh 0xabc123...` in the indra repo).

2. You need access to an ethereum provider.

For small scale experiments, you can use a default ethers provider by passing in an optional first arg with the network name string (supported networks: "rinkeby" & "mainnet").

In production, you'll want to get an API key for [alchemy](https://alchemyapi.io/), [etherscan](https://etherscan.io/), or [infura](https://infura.io/) & use that URL.

3. You need a key pair & you need to keep it safe.

Internally, we derive a `signingAddress` from a provided private key & funds at this Ethereum address will be used when calling `deposit()`. Alternatively, to protect the private key, you can wrap it in a ChannelSigner interface & inject that interface. See [reference](../reference/utils.html#channelsigner) for more info.

## Example Code

Create a state channel on a local testnet (Run `make start-headless` in indra first)

```
import { connect } from "@connext/client";
import { Wallet } from "ethers";

(async () => {

  const channel = await connect({
    ethProviderUrl: "http://localhost:8545",
    signer: Wallet.createRandom().privateKey,
    nodeUrl: "http://localhost:8080",
  });

  console.log(`Successfully connected channel with public id: ${channel.publicIdentifier}`);

})()
```

Create a state channel on Rinkeby

```
import { connect } from "@connext/client";
import { Wallet } from "ethers";

(async () => {

  const channel = await connect("rinkeby", {
    signer: Wallet.createRandom().privateKey,
  });

  console.log(`Successfully connected channel with public id: ${channel.publicIdentifier}`);

})()
```

## Reference Implementations

### DaiCard

- Live at https://daicard.io
- Code is open source at https://github.com/connext/indra/tree/staging/modules/daicard
