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

## Contract Deployment

Before deploying the contracts, make sure you have a funded mnemonic on the chain of your choice. This account will be used to deploy contracts, and will have 100% of the CXT tokens deployed minted to it.

Once the account is properly funded with the chains native asset, run the following:

```bash
> git checkout -b "add-your-chain" # checkout a new branch
> make all # build all images
> bash ops/deploy.sh <CHAIN_PROVIDER_URL> # deploy local artifacts
```

and follow the on screen prompts.

Once the deployment is complete, you should see changes to your local `address-book.json`. These will include the newly deployed contract addresses for your chain. Commit these changes to your branch.

## E2E Local Testing

To test out the changes on a local node pointed at a remote chain, you will need to run the e2e bot test.

Before starting your local node, you must configure your environment to have a funded node mnemonic, as well as the proper chain providers (see [note](./deploy-indra.md) on chain provider formatting):

```bash
# Add the following to your .env
INDRA_CHAIN_PROVIDERS='{"<CHAIN_ID>":"<PROVIDER_URL>"}'

# Set the node mnemonic to be a mnemonic with a funded acccounts[0] on your chain
# Ideally, this would be the mnemonic you deployed the contracts with.
> bash ops/save-secret.sh
# NOTE: if the docker secret already exists, run:
# docker secret rm indra_mnemonic
```

Once you have updated the environment, build all local images and start the node. Note that you may need to make some changes to the `ops/proxy/entry.sh` file:

```bash
# NOTE: Make sure you have commented out the ethprovider waiting in the proxy
#       entry script, lines 44-48, if the chain cannot accept localhost requests

# Build all images
> make all

# Start a local node pointed at the remote chain
> make start

# Monitor node logs
> bash ops/logs.sh node
```

Then run the bot tests against the local node by running the following:

```bash
> export INDRA_CHAIN_URL="<CHAIN_PROVIDER_URL>"
> export MNEMONIC="<MNEMONIC>" # to fund created bots, can be node or deployer mnemonic
> bash ops/test/e2e.sh <CHAIN_ID>

# or without exporting:
> INDRA_CHAIN_URL=<CHAIN_PROVIDER_URL> MNEMONIC=<MNEMONIC> bash ops/test/e2e.sh <CHAIN_ID>
```

If the values for the environment variables are not set, the default dev values will be used. NOTE: depending on your chain congestion, these tests may timeout.

Once the tests pass, submit the changes as a PR for review.

### Node Updates

If you would like to add these changes to a deployed node, make sure to edit the `INDRA_CHAIN_PROVIDERS` and `INDRA_CONTRACT_ADDRESSES` environment variables.

If you are using the default `make start-prod` or `make restart-prod` scripts, you can change the `INDRA_CHAIN_PROVIDERS` in your root `.env` and edit the `INDRA_CONTRACT_ADDRESSES` variable by changing the root `address-book.json` to include your newly deployed chain. Once those changes are made, running `make restart-prod` will incorporate the chain into the running node.

Before restarting the node, make sure there is sufficient collateral at the nodes signer address in the new token and native asset. If you deployed the contracts using the node mnemonic and you are using the deployed token, the node should already own the entire token supply.
