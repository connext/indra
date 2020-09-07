# How To Integrate With a NodeJS Server

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

Internally, we derive a `signingAddress` from a provided private key & funds at this Ethereum address will be used when calling `deposit()`. Alternatively, to protect the private key, you can wrap it in a ChannelSigner interface & inject that. See [reference](../reference/utils.html#channelsigner) for more info.

4. You need to consider where you're going to store your state.

The simplest option is save it as a file. Alternatively, to increase performance you can save it to a postgres database. The [`@connext/store`](../reference/store.md) reference has more info about the options available.

## Example Code

Create a state channel on a local testnet (Run `make start-headless` in indra first). Save channel state to a simple file.

```
import { connect } from "@connext/client";
import { getFileStore } from "@connext/store";
import { Wallet } from "ethers";

(async () => {

  const channel = await connect({
    ethProviderUrl: "http://localhost:8545",
    signer: Wallet.createRandom().privateKey,
    nodeUrl: "http://localhost:8080",
    store: getFileStore(),
  });

  console.log(`Successfully connected channel with public id: ${channel.publicIdentifier}`);

})()
```

Create a state channel on Rinkeby & save state to a postgres database.

```
import { connect } from "@connext/client";
import { getPostgresStore } from "@connext/store";
import { Wallet } from "ethers";

(async () => {

  const channel = await connect("rinkeby", {
    signer: Wallet.createRandom().privateKey,
    store: getPostgresStore(`postgres://user:password@host:port/database`),
  });

  console.log(`Successfully connected channel with public id: ${channel.publicIdentifier}`);

})()
```

## Advanced Configuration

The node is configured through environment variables. The easiest way to modify environment variables is to use a `.env` file in the root of the repo. Any variables in the `.env` are injected into the node at runtime. The list of supported environment variables is [here](../reference/node.md).

### Adding Custom Tokens

To add a custom token that the node provides collateral for, modify the node's environment variable `INDRA_SUPPORTED_TOKENS`. The varible is a JSON string with the following type signature:

```typescript
type SupportedTokens = {
  [chainId: string]: string[];
};
```

This allows you to add multiple tokens per `chainId` that the node supports in its `INDRA_CHAIN_PROVIDERS` config. For example:

```sh
# .env
export INDRA_SUPPORTED_TOKENS='{"4":["0x4E72770760c011647D4873f60A3CF6cDeA896CD8","0x514910771af9ca656af840dff83e8264ecf986ca"],"5":["0x514910771af9ca656af840dff83e8264ecf986ca"]}'
```

Note: ETH and the `Token` in the `address-book.json` are always supported by default.

### Adding Custom Swaps

To allow the node to swap tokens in-channel, configure the environment variable `INDRA_ALLOWED_SWAPS`. The variable is a JSON string with the following type signature:

```typescript
type AllowedSwaps = {
  from: string;
  to: string;
  fromChainId: string;
  toChainId: string;
  priceOracleType: PriceOracleTypes;
}[];

const PriceOracleTypes: {
  UNISWAP: "UNISWAP";
  HARDCODED: "HARDCODED";
  ACCEPT_CLIENT_RATE: "ACCEPT_CLIENT_RATE";
};
```

Note that `fromChainId` and `toChainId` must be the same because the in-channel swap occurs on the same chain.

## Reference Implementations

### TipDai

- Coming soon to twitter account @TipDai
- Browse the code at https://gitlab.com/bohendo/tipdai
