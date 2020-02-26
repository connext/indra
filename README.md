[![](https://github.com/ConnextProject/indra/workflows/CD%20Master/badge.svg)](https://github.com/ConnextProject/indra/actions)
[![](https://github.com/ConnextProject/indra/workflows/CD%20Staging/badge.svg)](https://github.com/ConnextProject/indra/actions)

[![Discord](https://img.shields.io/discord/454734546869551114)](https://discord.gg/m93Sqf4)
[![Twitter Follow](https://img.shields.io/twitter/follow/ConnextNetwork?style=social)](https://twitter.com/ConnextNetwork)

# Indra

Connext's counterfactually-instantiated generalized state-channel platform. To learn more about this project, check out our [docs](https://docs.connext.network).

## Contents

 - TBD

For any unanswered questions, open a [new issue](https://github.com/ConnextProject/indra/issues/new) or reach out on our [Discord channel](https://discord.gg/SmMSFf) & we'll be happy to help.

## Launch Indra in developer mode

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
```

That's all! But beware: the first time `make start` is run, it will take a very long time (maybe 10 minutes, depends on your internet speed) but have no fear: downloads will be cached & most build steps won't ever need to be repeated again so subsequent `make start` runs will go much more quickly. Get this started asap & browse the rest of the README while the first `make start` runs.

By default, Indra will launch using a local blockchain (ganache) but you can also run a local Indra stack against a public chain such as Rinkeby. To do so, build everything and then run the start-script directly with a custom `INDRA_ETH_PROVIDER` environment variable:

```bash
make # build everything
INDRA_ETH_PROVIDER="https://rinkeby.infura.io/abc123" bash ops/start-dev.sh
```

### Interacting with your Local Node

Once the Indra stack is awake, you can interact with the node via the UI reference implementation: The Daicard, available at http://localhost:3000.

Try visiting the Daicard, find your address (top left) & copy it to your clipboard, and then run the following to send a bit of test-ETH to your account:

```bash
bash ops/fund.sh <PASTE>
```

Daicard should detect this transfer & automatically deposit these funds into your channel.

If you're using the local dev-mode blockchain that Indra uses by default, the classic truffle mnemonic is used as a source of funds:

`candy maple cake sugar pudding cream honey rich smooth crumble sweet treat`

If you use metamask, you can load this mnemonic into your wallet to directly access funds on this local blockchain.

Note: Each Daicard stores account info in localStorage so if you want to play with two different Daicard accounts at the same time (eg to experiment with sending payments back and forth), open one of them in an incognito window or in a different browser.

As you play with the Daicard, you can monitor the node's logs with `bash ops/logs.sh node` or substitute "node" with any other service of the Indra stack (see all services with `make dls`).

### Useful Commands

- `make`: Builds everything that has changed since the last build
- `make start`: Builds anything out of date & then starts the app
- `make stop`: Stop the app once it's been started
- `make restart`: Stop the app & start it again, rebuilding anything that's out of date
- `make clean`: Stops the app & deletes all build artifacts eg transpiled typescript
- `make reset`: Stops the app & removes all persistent data eg database data
- `make dls`: Show all running services (groups of containers) plus list all running containers.
- `bash ops/db.sh`: Opens a console attached to the running app's database. You can also run `bash ops/db.sh '\d+'` to run a single PostgreSQL query (eg `\d+` to list table details).
- `bash ops/logs.sh node`: Monitor the node's logs.

### Running Tests

- `make test-cf`: run unit tests for core protocol logic (cf-core).
- `make test-contracts`: run unit tests for Ethereum smart contracts.
- `make test-client`: run unit tests for the channel client.
- `make test-node`: run unit tests for the node server.
- `make start && make test-daicard`: run integration tests for the Daicard UI.
- `make start && make test-integration`: run client-node integration test suite.
- `make start && make watch-ui`: Open a test-optimized browser & use cypress to run automated e2e tests. Tests will be re-run any time test files change.
- `make start && make watch-integration`: start a test watcher that will re-run integration tests whenever test code changes (great to use while debugging).

## Deploying Contracts

If you're using Mainnet or Rinkeby, contracts have already been deployed for everyone to use. You'll find addresses for all the contracts powering our state channel platform here: `modules/contracts/address-book.json`.

If you want to use custom contracts or a new network though, you'll have to deploy them yourself.

For example: to deploy to Goerli testnet, you'll first need to retrieve the mnemonic for an account that has enough funds to pay the gas fees. Copy that mnemonic to your clipboard & then run:

```bash
ETH_PROVIDER="https://goerli.infura.io/abc123" bash ops/deploy-contracts.sh
```

This will update the address-book to include new addresses for either the new contracts or new network you're deploying to.

If you want to share these updates with everyone, then commit the new address-book & submit a PR. If these updates are specific to your situation/organization then add a copy of the updated address-book to the project root:

```bash
cp modules/contracts/address-book.json ./address-book.json
```

An address-book in the project root will take precedence over one in the contracts module. It's also added to the git-ignore so you can pull updates to the rest of the code without worrying about your addresses getting overwritten. If you're deploying an Indra node to prod, then keep this custom address-book safe, we'll need to give it to the prod-server too.

```
bash ops/deploy.contracts.sh https://rinkeby.infura.io/abc123
```

One exception: if you want to redeploy some contract(s), then delete their addresses from the address book & re-run the above deployment script.




## Deploy an Indra node to production

Lets say you want to deploy an Indra payment node to `https://indra.example.com` (we'll call this url `$DOMAINNAME`)

First step: get a server via AWS or DigitalOcean or whichever cloud provider is your favorite. For best results, use the most recent LTS version of Ubuntu. Note this new server's IP address (we'll call it `$SERVER_IP`). Make sure it's able to connect to the internet via ports 80, 443, 4222, and 4223 (no action required on DigitalOcean, Security Group config needs to be setup properly on AWS).

Set up DNS so that `$DOMAINNAME` points to this server's IP address.

Every Indra node needs access to a hot wallet, you should generate a fresh mnemonic for your node's wallet that isn't used anywhere else. You can generate a new mnemonic from a node console with ethers by doing something like this: `require('ethers').Wallet.createRandom()`.

Save this mnemonic somewhere safe, copy it to your clipboard, and then run:

```bash
SSH_KEY=$HOME/.ssh/id_rsa bash ops/setup-ubuntu.sh $SERVER_IP
```

If this is a fresh Ubuntu server from DigitalOcean or AWS then the above script should:
 - configure an "ubuntu" user and disable root login (if enabled)
 - give an additional ssh public key login access if provided (useful for CD/auto-deployment)
 - install docker & make & other dependencies
 - upgrade everything to the latest version
 - save your mnemonic in a docker secret called `indra_mnemonic
 - reboot

Note: this script is idempotent aka you can run it over and over again w/out causing any problems. In fact, re-running it every month or so will help keep things up-to-date (you can skip inputting the mnemonic on subsequent runs).

For convenience sake, we recommend adding an entry to your ssh config to easily access this server. Add something that looks like the following to `$HOME/.ssh/config`:

```bash
Host new-indra
  Hostname $SERVER_IP
  User ubuntu
  IdentityFile ~/.ssh/id_rsa
  ServerAliveInterval 120
```

Now you can login to this server with just `ssh new-indra`. Once the server wakes up again after rebooting at the end of `ops/setup-ubuntu`, login to finish setup.

First step: clone & the git repo on your prod server:

```bash
ssh new-indra git clone https://github.com/ConnextProject/indra.git
```

If you're using a custom address book, upload it to your prod server:

```bash
scp address-book.json new-indra:~/indra/
```

We need to add a couple env vars before launching our indra node. `~/.bashrc` is a good place to add them as they'll be loaded automatically every time you login to the server.

Open `~/.bashrc` on your prod server in a text editor and add these required env vars:

```bash
export INDRA_DOMAINNAME="$DOMAINNAME"
export INDRA_ETH_PROVIDER="https://eth-rinkeby.alchemyapi.io/jsonrpc/abc123"
```

Optionally, add any of the following env vars to enable extra features:

```bash
export INDRA_MODE="release" # "release": deploy latest release (more stable), "staging": run code at current commit (easier to hotfix)
export INDRA_EMAIL="noreply@gmail.com" # To recieve alerts if https certs fail to auto-renew
export INDRA_AWS_ACCESS_KEY_ID="" # creds to access AWS S3 storage, db will send perodic backups here if provided.
export INDRA_AWS_SECRET_ACCESS_KEY="" # see above, both of these must be provided for remote db backups
export INDRA_LOGDNA_KEY="abc123" # if provided, all node logs will be sent to LogDNA for further analysis
export INDRA_ADMIN_TOKEN="cxt1234" # To control access to admin functions on the dashboard.
```

Once your env vars are setup, load them into your current session (`source ~/.bashrc`) and we're ready to roll.

Login to your prod server then run the following to launch your Indra node:

```bash
cd indra
make restart-prod
```

The above will download & run docker images associated with the commit/release you have checked out. If you want to launch a specific version of indra, checkout that version's tag & restart:

```bash
git checkout indra-4.1.0 && make restart-prod
```

## FAQ

### What's wrong with Indra?

If you encounter problems while the app is running, the first thing to do is check the logs of each component:

`make dls`: which services are running? Any services that aren't running (labeled has having `0/1` replicas) are worth investigating further.

If the node isn't running for example, check it's logs with: `bash ops/logs.sh node`.

If a fix isn't obvious, then ask us for help on [Discord](https://discord.gg/SmMSFf) & make sure to provide the output from `make dls` and the logs of any services that aren't running.

### Have you tried turning it off and back on again?

Restarting: the debugger's most valuable tool.

Some problems will be fixed by just restarting the app so try this first: `make restart`

If this doesn't work, try resetting all persistent data (database + the ethprovider's chain data) and starting the app again: `make reset && npm start`. After doing this, you'll likely need to reset your MetaMask account to get your tx nonces synced up correctly.

If that still doesn't work either, try rebuilding everything with `make clean && make start`.

### `The container name "/indra_buidler" is already in use`

Full error message:

```
docker: Error response from daemon: Conflict. The container name "/indra_buidler" is already in use by container "6d37b932d8047e16f4a8fdf58780fe6974e6beef58bf4cc5e48d00d3e94a67c3". You have to remove (or rename) that container to be able to reuse that name.
```

You probably started to build something and then stopped it with ctrl-c. It only looks like the build stopped: the builder process is still hanging out in the background wrapping up what it was working on. If you wait for a few seconds, this problem will usually go away as the builder finishes & exits.

To speed things up, run `make stop` to tell the builder to hurry up and finish.

### Improperly installed dependencies

You'll notice this by an error that looks like this in some module's logs:

```
2019-03-04T15:13:46.213763000Z internal/modules/cjs/loader.js:718
2019-03-04T15:13:46.213801600Z   return process.dlopen(module, path.toNamespacedPath(filename));
2019-03-04T15:13:46.213822300Z                  ^
2019-03-04T15:13:46.213842600Z
2019-03-04T15:13:46.213862700Z Error: Error loading shared library /root/node_modules/scrypt/build/Release/scrypt.node: Exec format error
2019-03-04T15:13:46.213882900Z     at Object.Module._extensions..node (internal/modules/cjs/loader.js:718:18)
2019-03-04T15:13:46.213903000Z     at Module.load (internal/modules/cjs/loader.js:599:32)
2019-03-04T15:13:46.213923100Z     at tryModuleLoad (internal/modules/cjs/loader.js:538:12)
2019-03-04T15:13:46.213943100Z     at Function.Module._load (internal/modules/cjs/loader.js:530:3)
2019-03-04T15:13:46.213963100Z     at Module.require (internal/modules/cjs/loader.js:637:17)
2019-03-04T15:13:46.213983100Z     at require (internal/modules/cjs/helpers.js:22:18)
2019-03-04T15:13:46.214003200Z     at Object.<anonymous> (/root/node_modules/scrypt/index.js:3:20)
2019-03-04T15:13:46.214023700Z     at Module._compile (internal/modules/cjs/loader.js:689:30)
```

If you notice this kind of error in the node logs, for example, you can reinstall dependencies by running `make clean && make start` (this will take a few minutes).

This happen when you run `npm install` manually and then try to deploy the app using docker. Some dependencies (eg scrypt) have pieces in C that need to be compiled. If they get compiled for your local machine, they won't work in docker & vice versa.

In general, if you manually run `npm install` or add any new dependencies, you'll need to rebuild and restart (`make && make restart`) before the Indra stack will start up properly again.

### Ethprovider or Ganache not working

```
cat -> curleth.sh <<EOF
#!/bin/bash
url=$ETH_PROVIDER; [[ $url ]] || url=http://localhost:8545
echo "Sending $1 query to provider: $url"
curl -H "Content-Type: application/json" -X POST --data '{"id":31415,"jsonrpc":"2.0","method":"'$1'","params":'$2'}' $url
EOF
```

This lets us do a simple `bash curleth.sh net_version '[]'` as a sanity check to make sure the ethprovider is alive & listening. If not, curl might give more useful errors that direct you towards investigating either metamask or ganache.

One other sanity check is to run `make dls` and make sure that you see an ethprovider service that has port 8545 exposed (PORTS should look like: `*:8545->8545/tcp`).

You can also run `docker exec -it indra_ethprovider.1.<containerId> bash` to start a shell inside the docker container. Even if there are networking issues between the container & host, you can still ping http://localhost:8545 here to see if ganache is listening & run `ps` to see if it's even alive.

### How to generate node db migrations

Typeorm is cool, if we update db entity files then typeorm can automatically generate SQL db migrations from the entity changes.

Start up the stack in a clean state (eg `make clean && make reset && make start`) then something like the following should work to generate migrations called "foo":

```
$ cd modules/node && npm run migration:generate foo

> indra-node@4.0.12 migration:generate /home/username/Documents/connext/indra/modules/node
> typeorm migration:generate -d migrations -n  "foo"

Migration /home/username/Documents/connext/indra/modules/node/migrations/1581311685857-foo.ts has been generated successfully.
```

Note: if entity files have *not* changed since the last db migration, the above will print something like "No changes detected" & not generate anything.

Once the migrations are generated, you should skim them & make sure the auto-generated code is sane & doing what you expect it to do. If it looks good, import it & add it to the migrations array in `modules/node/src/database/database.service.ts`.
