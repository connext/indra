# How To Integrate With Another Chain

## Prerequisites

To integrate with connext your chain must have:

- evm compatability
- `ABIEncoderV2` support
- `EC_RECOVER` support
- `keccak256` support
- same math quirks as solidity (i.e. must underflow and overflow in the same way if your contract is NOT using safe math)
- blocktime/timestamp support (important during channel adjudication and for any time dependent apps)
- solidity v6 support

If your contracts meet some, but not all, of the requirements contact the Connext team for more detailed integration steps.

## Integration

### Contract Deployment

Before deploying the contracts, make sure you have a funded mnemonic on the chain of your choice. This account will be used to deploy contracts, and will have 100% of the tokens deployed minted to it.

Once the account is properly funded, run the following:

```bash
> git checkout -b "add-your-chain" # checkout a new branch
> make # build all images
> bash ops/deploy.sh "<CHAIN_PROVIDER_URL>" # deploy local artifacts
```

and follow the on screen prompts.

### Node Updates

Once the contracts are deployed, you should have a change in the `address-book.json` including the addresses for all latest contracts. Commit these changes to your branch.

To add support for the new chain in the node, you must update the `INDRA_CONTRACT_ADDRESSES` and `INDRA_CHAIN_PROVIDERS` environment variable. If you are running using the `make` or `start-prod` scripts, the address book changes should be automatically propagated. Otherwise, update the values accordingly. Make sure to read the notes in the [node deployment guide](./deploy-indra.md) for updating the node environment.

Before restarting the node, make sure there is sufficient collateral at the nodes signer address in the new token and native asset. If you deployed the contracts using the node mnemonic and you are using the deployed token, the node should already own the entire token supply.

### Testing

To test out the changes on a local node pointed at a remote chain, you will need to run the bot tests.

First, fire up your local node by updating the mnemonic and chain providers in your local `.env` file:

```bash
# make sure root .env has INDRA_CHAIN_PROVIDERS env var properly set
> bash ops/save-secret.sh # set funded node mnemonic for chain
# make sure you have commented out the ethprovider waiting in the proxy
# then run:
> make start # start local node pointed at remote chain
```

Then run the bot tests by running the following:

```bash
> export INDRA_CHAIN_URL="<CHAIN_PROVIDER_URL>"
> export MNEMONIC="<BOT_FUNDER_MNEMONIC>" # mnemonic to fund bots (can be nodes)
> make bot # build the bot dist
> bash ops/test/e2e.sh <CHAIN_ID>

# or
INDRA_CHAIN_URL=<CHAIN_PROVIDER_URL> bash ops/test/e2e.sh <CHAIN_ID>
```

If the values for the environment variables are not exported, the default dev values will be used. NOTE: depending on your chain congestion, these tests may timeout.

Once the tests pass, submit the changes as a PR for review.
