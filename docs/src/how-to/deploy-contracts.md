# Deploying Contracts

If you're using Mainnet or Rinkeby, contracts have already been deployed for everyone to use. You'll find addresses for all the contracts powering our state channel platform here: `modules/contracts/address-book.json`.

If you want to use custom contracts or a new network though, you'll have to deploy them yourself.

For example: to deploy to Goerli testnet, you'll first need to retrieve the mnemonic for an account that has enough funds to pay the gas fees. Copy that mnemonic to your clipboard & then run:

```bash
make contracts
```

then

```bash
bash ops/deploy-contracts.sh https://goerli.infura.io/abc123
```

This will update the address-book to include new addresses for either the new contracts or new network you're deploying to.

If you want to share these updates with everyone, then commit the new address-book & submit a PR. If these updates are specific to your situation/organization then add a copy of the updated address-book to the project root:

```bash
cp modules/contracts/address-book.json ./address-book.json
```

An address-book in the project root will take precedence over one in the contracts module. It's also added to the git-ignore so you can pull updates to the rest of the code without worrying about your addresses getting overwritten. If you're deploying an Indra node to prod, then keep this custom address-book safe, we'll need to give it to the prod-server too.

```bash
bash ops/deploy.contracts.sh https://rinkeby.infura.io/abc123
```

One exception: if you want to redeploy some contract(s), then delete their addresses from the address book & re-run the above deployment script.

If you're integrating a new chain to the indra repository see [this guide](https://docs.connext.network/en/latest/how-to/deploy-indra.html) for more information.
