# Node

## Configuration

### Environment Variables

The following environment variables are used by the node:

| Variable Name                           | Type        | Description                                                                                                 | Example                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INDRA_ADMIN_TOKEN`                     | String      | Token for administrative functions.                                                                         | cxt1234                                                                                                                                                                                                                                                                                                                                                                 |
| `INDRA_CHAIN_PROVIDERS`                 | JSON String | Mapping of chainId to ethProviderUrl                                                                        | '{"1":"https://mainnet.infura.io/v3/TOKEN","4":"https://rinkeby.infura.io/v3/TOKEN"}'                                                                                                                                                                                                                                                                                   |
| `INDRA_CONTRACT_ADDRESSES`              | JSON String | Contract information, keyed by chainId                                                                      | '{ "1337": { "ChallengeRegistry": { "address": "0x8CdaF0CD259887258Bc13a92C0a6dA92698644C0", "creationCodeHash": "0x42eba77f58ecb5c1352e9a62df1eed73aa1a89890ff73be1939f884f62d88c46", "runtimeCodeHash": "0xc38bff65185807f2babc2ae1334b0bdcf5fe0192ae041e3033b2084c61f80950", "txHash": "0x89f705aefdffa59061d97488e4507a7af4a4751462e100b8ed3fb1f5cc2238af" }, ...}' |
| `INDRA_DEFAULT_REBALANCE_PROFILE_ETH`   | JSON String | Rebalance Profile to use by default                                                                         | '{"collateralizeThreshold":"500000000000","target":"1500000000000","reclaimThreshold":"10000000000000"}'                                                                                                                                                                                                                                                                |
| `INDRA_DEFAULT_REBALANCE_PROFILE_TOKEN` | JSON String | Rebalance Profile to use by default (real units)                                                            | '{"collateralizeThreshold":"500000000000","target":"1500000000000","reclaimThreshold":"10000000000000"}                                                                                                                                                                                                                                                                 |
| `INDRA_LOG_LEVEL`                       | Number      | Log level - 1 = Error, 4 = Debug                                                                            | 3                                                                                                                                                                                                                                                                                                                                                                       |
| `INDRA_ALLOWED_SWAPS`                   | JSON String | Configuration for array of allowed swaps object. Price oracle types: HARDCODED, UNISWAP, ACCEPT_CLIENT_RATE | '\[{"from":"0x0000000000000000000000000000000000000000","to":"0x13274Fe19C0178208bCbee397af8167A7be27f6f","fromChainId":"1337","toChainId":"1337","priceOracleType":"ACCEPT_CLIENT_RATE"}\]'                                                                                                                                                                            |
| `INDRA_SUPPORTED_TOKENS`                | JSON String | Mapping of chainId to array of supported tokens                                                             | '{"1337":\["0x13274Fe19C0178208bCbee397af8167A7be27f6f"\]}'                                                                                                                                                                                                                                                                                                             |
| `INDRA_MNEMONIC_FILE`                   |
| `INDRA_NATS_JWT_SIGNER_PRIVATE_KEY`     |
| `INDRA_NATS_JWT_SIGNER_PUBLIC_KEY`      |
| `INDRA_NATS_SERVERS`                    |
| `INDRA_NATS_WS_ENDPOINT`                |
| `INDRA_PG_DATABASE`                     |
| `INDRA_PG_HOST`                         |
| `INDRA_PG_PASSWORD_FILE`                |
| `INDRA_PG_PORT`                         |
| `INDRA_PG_USERNAME`                     |
| `INDRA_PORT`                            |
| `INDRA_REDIS_URL`                       |
|                                         |
