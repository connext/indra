# How To Deploy an Indra Node

Lets say you want to deploy an Indra payment node to `https://indra.example.com` (we'll call this url `$DOMAINNAME`)

First step: get a server via AWS or DigitalOcean or hardware at home. For best results, use the most recent LTS version of Ubuntu & make sure it has at least 32GB of disk space. If using DigitalOcean, make sure you toggle on the VPC network when instantiating a droplet. Note this new server's IP address (we'll call it `$SERVER_IP`). Make sure it's able to connect to the internet via ports 80, 443, 4221, and 4222 (no action required on DigitalOcean, Security Group config needs to be setup properly on AWS).

Set up DNS so that `$DOMAINNAME` points to this server's IP address. If you're using CloudFlare name servers, turn on CloudFlare's built-in SSL support & make sure it's set to "Full (strict)".

We won't need to ssh into this server right away, most of the setup will be done locally. Start by cloning the repo to your local machine if you haven't already and `cd` into it.

```
git clone git@github.com:connext/indra.git
cd indra
```

Every Indra node needs access to a hot wallet, you should generate a fresh mnemonic for your node's wallet that isn't used anywhere else. You can generate a new mnemonic from a node console with ethers by doing something like this: `require('ethers').Wallet.createRandom()`. Alternatively, you can generate one [here](https://iancoleman.io/bip39/).

Save this mnemonic somewhere safe and copy it to your clipboard. From your local machine, run:

```bash
SSH_KEY=$HOME/.ssh/id_rsa bash ops/setup-ubuntu.sh $SERVER_IP
```

(`$HOME/.ssh/id_rsa` is the default `SSH_KEY`, if this is the key you'll use to access `$SERVER_IP` then you don't need to supply it explicitly)

If this is a fresh Ubuntu server from DigitalOcean or AWS then the `ops/setup-ubuntu.sh` script should ssh into your server using the specified ssh key and go through the following steps:

- create & configure an "ubuntu" user and disable root login (if root login was enabled to begin with)
- give an additional ssh public key login access if key specified by the `PUB_KEY` env var is available (defaults to `$HOME/.ssh/autodeployer.pub`)
- install docker & make & other dependencies
- upgrade everything to the latest version
- save your mnemonic in a docker secret called `indra_mnemonic`
- reboot

Note: this script is idempotent aka you can run it over and over again w/out causing any problems. In fact, re-running it every month or so will help keep things up-to-date (you can skip inputting the mnemonic on subsequent runs).

For convenience's sake, we recommend adding an entry to your ssh config to easily access this server. Add something that looks like the following to `$HOME/.ssh/config`:

```bash
Host new-indra
  Hostname $SERVER_IP
  User ubuntu
  IdentityFile ~/.ssh/id_rsa
  ServerAliveInterval 120
```

Now you can login to this server with just `ssh new-indra`.

We need to add a couple env vars before logging in and launching our indra node. We'll be pulling from the public default prod-mode env vars in your local cloned repo & updating a couple as needed.

```bash
cp prod.env .env
```

Ensure you've added correct values for two important env vars: `INDRA_DOMAINNAME` and `INDRA_CHAIN_PROVIDERS`.

The `INDRA_CHAIN_PROVIDERS` env var is a tricky one, there is no default provided as it's value depends entirely on which chains you want to support (if this env var is not provided, a local testnet will be started up & Indra will use this). The format is very specific: it must be valid JSON where the key is a chain id (eg `"4"`) and the value is that chain's provider url (eg `"https://eth-rinkeby.alchemyapi.io/v2/abc123"`). The double quotes within this env var must be preserved, this is accomplished most reliably by both single-quoting the env var value and escaping the double quotes with back slashes. When you're done, you should have a line in your `.env` file that looks something like this:

```bash
export INDRA_CHAIN_PROVIDERS='{"4":"https://eth-rinkeby.alchemyapi.io/v2/abc123"}'
```

Upload the prod env vars to the indra server. If you're using a custom address book, upload that too:

```bash
scp .env new-indra:~/indra/
scp address-book.json new-indra:~/indra/
```

Now, it's finally time to login to your prod server using `ssh new-indra` (or whichever host you've specified in your ssh config file).

Once you've ssh'd into your new server, run the following to launch your Indra node:

```bash
cd indra
git checkout master # staging is the default branch. It's cutting edge but maybe buggy.
make restart-prod
```

The above will download & run docker images associated with the commit/tag you have checked out. If you want to launch a specific version of indra, checkout that version's tag & restart:

```bash
git checkout indra-7.3.8 && make restart-prod
```

Before you are able to start sending payments, you will have to make sure to properly collateralize your node. The signer address is available as `accounts[0]` off of your mnemonic and can also be found by querying the `/config` endpoint under `signerAddress`. Node's should have collateral in all supported tokens, as well as sufficient eth to pay for all transactions from the wallet to the channels. By default, the supported token addresses will include ETH and the `Token` address from the network context of your node (available in `address-book.json`).
