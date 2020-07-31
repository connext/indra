# Indra Node

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

### Interacting with Local Indra

#### Onchain Funding

If you're using the local dev-mode blockchain, you can load the default node account into your wallet to directly access funds on a local chain running at `http://localhost:8545`

There are also some command line options:

```bash
# Send ETH from node to provided recipient
bash ops/fund.sh <RECIPIENT_ADDRESS> <ETH_AMOUNT_TO_SEND>

# Drip ERC20 to provided account
# if you don't specify an eth provider, http://localhost:8545 is used as the
# default
bash ops/drip.sh <RECIPIENT_PRIVATE_KEY> <ETH_PROVIDER_URL>
```

#### Local Daicard

To interact with the stack using a browser UI, run:

```bash
make start-daicard
```

This will start the Daicard UI at `http://localhost:3000` with an integrated client connected to a locally running indra node.

Try visiting the Daicard, find your address (top left) & copy it to your clipboard, and then run the following to send a bit of test-ETH to your account:

```bash
bash ops/fund.sh <RECIPIENT_ADDRESS>
```

Daicard should detect this transfer & automatically deposit these funds into your channel.

Note: Each Daicard stores account info in localStorage so if you want to play with two different Daicard accounts at the same time (eg to experiment with sending payments back and forth), open one of them in an incognito window or in a different browser.

As you play with the Daicard, you can monitor the node's logs with `bash ops/logs.sh node` or substitute "node" with any other service of the Indra stack (see all services with `make dls`).

#### Useful Commands

- `make`: Builds everything that has changed since the last build
- `make all`: Builds all images, including any extras or prod mode bundles.
- `make start`: Builds anything out of date & then starts the app
- `make stop`: Stop the app once it's been started
- `make restart`: Stop the app & start it again, rebuilding anything that's out of date
- `make clean`: Stops the app & deletes all build artifacts eg transpiled typescript
- `make reset`: Stops the app & removes all persistent data eg database data
- `make dls`: Show all running services (groups of containers) plus list all running containers.
- `bash ops/db.sh`: Opens a console attached to the running app's database. You can also run `bash ops/db.sh '\d+'` to run a single PostgreSQL query (eg `\d+` to list table details).
- `bash ops/logs.sh node`: Monitor the node's logs. You can also monitor logs for the database, webserver, 1337, etc. by changing the first argument

#### Running Tests

- `make test-cf`: run unit tests for core protocol logic (cf-core).
- `make test-contracts`: run unit tests for Ethereum smart contracts.
- `make test-client`: run unit tests for the channel client.
- `make test-node`: run unit tests for the node server.
- `make start && make test-daicard`: run integration tests for the Daicard UI.
- `make start && make test-integration`: run client-node integration test suite.
- `make start && make watch-ui`: Open a test-optimized browser & use cypress to run automated e2e tests. Tests will be re-run any time test files change.
- `make start && make watch-integration`: start a test watcher that will re-run integration tests whenever test code changes (great to use while debugging).

## Production Deployment

Lets say you want to deploy an Indra payment node to `https://indra.example.com` (we'll call this url `$DOMAINNAME`)

First step: get a server via AWS or DigitalOcean or hardware at home. For best results, use the most recent LTS version of Ubuntu & make sure it has at least 32GB of disk space. If using DigitalOcean, make sure you toggle on the VPC network when instantiating a droplet. Note this new server's IP address (we'll call it `$SERVER_IP`). Make sure it's able to connect to the internet via ports 80, 443, 4221, and 4222 (no action required on DigitalOcean, Security Group config needs to be setup properly on AWS).

Set up DNS so that `$DOMAINNAME` points to this server's IP address. If you're using CloudFlare name servers, turn on CloudFlare's built-in SSL support & make sure it's set to "Full (strict)".

Next: Clone the repo and cd into it.

```
git clone git@github.com:connext/indra.git
cd indra
```

Every Indra node needs access to a hot wallet, you should generate a fresh mnemonic for your node's wallet that isn't used anywhere else. You can generate a new mnemonic from a node console with ethers by doing something like this: `require('ethers').Wallet.createRandom()`. Alternatively, you can generate one [here](https://iancoleman.io/bip39/).

Save this mnemonic somewhere safe, copy it to your clipboard, and then run:

```bash
SSH_KEY=$HOME/.ssh/id_rsa bash ops/setup-ubuntu.sh $SERVER_IP
```

(`$HOME/.ssh/id_rsa` is the default `SSH_KEY`, if this is what you're using then no need to supply it)

If this is a fresh Ubuntu server from DigitalOcean or AWS then the above script should:

- configure an "ubuntu" user and disable root login (if enabled)
- give an additional ssh public key login access if key specified by the `PUB_KEY` env var is available (defaults to `$HOME/.ssh/autodeployer.pub`)
- install docker & make & other dependencies
- upgrade everything to the latest version
- save your mnemonic in a docker secret called `indra_mnemonic`
- reboot

Note: this script is idempotent aka you can run it over and over again w/out causing any problems. In fact, re-running it every month or so will help keep things up-to-date (you can skip inputting the mnemonic on subsequent runs).

If you already have a server with docker & make installed, there's another helper script you can use to easily load your mnemonic: `bash ops/save-secret.sh`. Run this on your prod server & copy/paste in your mnemonic.

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
export INDRA_CHAIN_PROVIDERS='{\"4\":\"https://eth-rinkeby.alchemyapi.io/v2/abc123\"}'
```

Upload the prod env vars to the indra server. If you're using a custom address book, upload that too:

```bash
scp .env new-indra:~/indra/
scp address-book.json new-indra:~/indra/
```

Login to your prod server then run the following to launch your Indra node:

```bash
cd indra
git checkout master # staging is the default branch. It's cutting edge but maybe buggy.
make restart-prod
```

The above will download & run docker images associated with the commit/tag you have checked out. If you want to launch a specific version of indra, checkout that version's tag & restart:

```bash
git checkout indra-6.0.8 && make restart-prod
```

Before you are able to start sending payments, you will have to make sure to properly collateralize your node. The signer address is available as `accounts[0]` off of your mnemonic and can also be found by querying the `/config` endpoint under `signerAddress`. Node's should have collateral in all supported tokens, as well as sufficient eth to pay for all transactions from the wallet to the channels. By default, the supported token addresses will include ETH and the `Token` address from the network context of your node (available in `address-book.json`).
