# How To Integrate With Another Chain

## Prerequisites

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

To add support for the new chain in the node, you must update the `INDRA_CONTRACT_ADDRESSES` and `INDRA_CHAIN_PROVIDER` environment variables. If you are running using the `make` or `start-prod` scripts, the address book changes should be automatically propagated. Otherwise, update the values accordingly. Make sure to read the notes in the [node deployment guide](./deploy-indra.md) for updating the node environment.

Before restarting the node, make sure there is sufficient collateral at the nodes signer address in the new token and native asset. If you deployed the contracts using the node mnemonic and you are using the deployed token, the node should already own the entire token supply.

### Testing

To test out the changes, run the following in your local terminal window:

INDRA_CHAIN_URL=<CHAIN_PROVIDER_URL> bash ops/test/e2e.sh <CHAIN_ID>
