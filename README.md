# Indra

Everything you need to set up a Connext payment channel hub.

## Contents
 - [To deploy using Docker](#to-deploy-using-docker)
 - [To deploy locally](#to-deploy-locally)
 - [Deploying to production](#deploying-to-production)
 - [How to interact with Hub](#how-to-interact-with-hub)
 - [Debugging & Troubleshooting](#debugging)

For local development, you can either deploy the app in docker containers, or deploy it locally. See the next two sections for details.

If you encounter any problems, check out the [debugging guide](#debugging) at the bottom of this doc. For any unanswered questions, open an [issue](https://github.com/ConnextProject/indra/issues/new) or reach out on our Discord channel & we'll be happy to help.

Discord Invitation: https://discord.gg/SmMSFf

## To deploy using Docker

**Prerequisites**

- `make`: (probably already installed) Install w `brew install make` or `apt install make` or similar.
- `jq`: (probably not installed yet) Install w `brew install jq` or `apt install jq` or similar.
- [`docker`](https://www.docker.com/)
- [`node` and `npm`](https://nodejs.org/en/)

To build & deploy in dev-mode, run the following:

```
git clone https://github.com/ConnextProject/indra.git
cd indra
npm start
```

Beware! The first time this is run it will take a very long time (> 10 minutes usually)  but have no fear: downloads will be cached & most build steps won't ever need to be repeated again so subsequent `npm start` runs will go much more quickly. Get this started asap & browse the rest of the README while the first build/deploy completes.

Once all the pieces are awake, the app will be available at `http://localhost:3000`.

Useful scripts:
 - `npm start`: Builds everything & then starts the app
 - `npm run dls`: Show all running services (groups of containers) plus list all running containers.
 - `npm run db`: Opens a console attached to the running app's database. You can also run `npm run db '\d+'` to run a single PostgreSQL query (eg `\d+` to list table details) and then exit.
 - `npm run logs hub`: Monitor the hub's logs. Similar commands can be run to monitor logs for the `proxy`, `chainsaw`, `ethprovider` (for migrations output), `ganache` (for log of rpc calls to ganache), `database`, `redis`, etc.
 - `npm stop`: Stop the app once it's been started
 - `npm restart`: Stop the app & start it again, rebuilding anything that's out of date
 - `npm run reset`: Stops the app & removes all persistent data (eg database & chaindata)
 - `npm run clean`: Stops the app & deletes all build artifacts. Downloaded data (eg `node_modules`) isn't removed.
 - `npm run deep-clean`: Stops the app & deletes all build artifacts & deletes downloaded data.
 - `npm run prod`: Start the app in production-mode

There are a couple watcher flags at the top of `ops/deploy.dev.sh` that are off by default. If you expect to be actively developing the hub or chainsaw, you can turn on watchers for those and they'll be dynamically rebuild/redeployed on source-code changed without needing to restart the app. Careful, turning on all the watchers will increase the start-up.

Test suites:
 - `npm run test-client`: client unit tests
 - `npm run test-contracts`: contract unit tests
 - `npm run test-hub`: hub unit tests
 - `npm run test-e2e`: starts the app in production mode and then runs cypress integration tests
 - `npm run test-all`: Run all test suites

## To deploy locally

### Prerequisite
* PostgreSQL running locally: `brew install postgres` for Mac. [See here for Linux](https://github.com/ConnextProject/indra/blob/master/docs/LINUX_POSTGRES.md).
* Redis running locally: `brew install redis` for Mac. `sudo apt-get install redis` for Linux.
* Yarn: `brew install yarn` for Mac. `sudo apt-get install yarn` for Linux.

Before starting, make sure your PostgreSQL and Redis services are running:
`brew services start redis`, `brew services start postgresql` on mac.

Run the following steps in order. For each section, use a separate terminal window. Closing the terminal window will stop the process.

### Ganache
Run the following from `modules/hub`.
* `yarn install` - Install dependencies.
* `bash development/ganache-reset` - Migrates the contracts.
* `bash development/ganache-run` - Runs Ganache (if you put a number after the `ganache-run` command you can set the blocktime).

### Hub
Run the following from `modules/hub`.
* `createdb sc-hub` - Creates the hub's database (if it already exists, skip this step).
* `bash development/hub-reset` - Resets the hub's database.
* `bash development/hub-run` - Runs hub and chainsaw.

### Wallet
Run the following from `modules/wallet`. 

* Add the following to a file called `.env` inside `modules/wallet`. Do not commit this file to Git:
```
REACT_APP_DEV=false
REACT_APP_HUB_URL=http://localhost:8080
REACT_APP_ETHPROVIDER_URL=http://localhost:8545
REACT_APP_HUB_WALLET_ADDRESS=0xfb482f8f779fd96a857f1486471524808b97452d
REACT_APP_CHANNEL_MANAGER_ADDRESS=0xa8c50098f6e144bf5bae32bdd1ed722e977a0a42
REACT_APP_TOKEN_ADDRESS=0xd01c08c7180eae392265d8c7df311cf5a93f1b73
REACT_APP_WITHDRAWAL_MINIMUM=10000000000000
```
* `npm install` - Install dependencies.
* `npm start` - Runs the local dev server at `http://localhost:3000`.
* Set up Metamask to use one of the following accounts:

Address: 0xFB482f8f779fd96A857f1486471524808B97452D

Private Key: 09cd8192c4ad4dd3b023a8ef381a24d29266ebd4af88ecdac92ec874e1c2fed8 (hub's account, contains tokens)

Address: 0x2DA565caa7037Eb198393181089e92181ef5Fb53

Private Key: 54dec5a04356ed96fc469803f3e45b901c69c5d5fd93a34fbf3568cd4c6efadd

## Deploying to Production

Tweak, check, tweak, check, commit. Time to deploy?

### First, setup CircleCI Environment Variables

**Once per CircleCI account or organization**

Run `ssh-keygen -t rsa -b 4096 -C "circleci" -m pem -f .ssh/circleci` to generate a new ssh key pair. Load the private key (`.ssh/circleci`) into CircleCI -> Settings -> Permissions -> SSH Permissions.

Go to CircleCI -> Settings -> Build Settings -> Environment Variables

 - `DOCKER_USER` & `DOCKER_PASSWORD`: Login credentials for someone with push access to the docker repository specified by the `repository` vars at the top of the Makefile & `ops/deploy.prod.sh`.
 - `STAGING_URL` & `RINKEBY_URL` & `MAINNET_URL`: The URLs from which the Indra application will be served.
 - `AWS_ACCESS_KEY_ID` & `AWS_SECRET_ACCESS_KEY`: (Optional) To enable database backup to remote AWS S3 storage

If `STAGING_URL=staging.example.com` then
 - DNS needs to be properly configured so that `staging.example.com` will resolve to the IP address of your staging server
 - The admin should have ssh access via `ssh root@$STAGING_URL` or `ssh ubuntu@$STAGING_URL` after completing the next step.
 - The application will be accessible from `https://staging.example.com` after deploying.

### Second, setup the production server

**Once per server**

First, copy your hub's private key to your clipboard (I usually load my mnemonic into metamask and then export the private key).

Then, run the following script (for best results, run it with a `$SERVER_IP` that points to a fresh Ubuntu VM):

`bash ops/setup-ubuntu.sh $SERVER_IP`

To run the setup script, we need to be able to use the above ssh key to access either `root@$SERVER_IP` or `ubuntu@$SERVER_IP`. If root, this script will setup the ubuntu user and disable root login for security.

This setup script expects to find the private key for ssh access to the server in `~/.ssh/connext-aws` & CircleCI's public key in `~/.ssh/circleci.pub`.

By default, this script will load your hub's rinkeby private key into a docker secret stored on the server. To setup a server for another network (eg mainnet) add a network arg to the end, eg: `bash ops/setup-ubuntu.sh $SERVER_IP mainnet`

You can remove the server's private key like this:

(Make sure that this server doesn't have a hub running on it before removing it's key)

```
ssh -t -i ~/.ssh/connext-aws ubuntu@$SERVER_IP docker secret rm hub_key_mainnet
```

And add a new private key like this:

```
ssh -t -i ~/.ssh/connext-aws ubuntu@$SERVER_IP bash indra/ops/load-secret.sh hub_key_mainnet
```

### Second, deploy the contracts

To deploy the ChannelManager contract & dependencies to Rinkeby:

```
bash ops/deploy.contracts.sh rinkeby
```

This script will prompt you to paste in the hub wallet's private key if one called `hub_key_rinkeby` hasn't already been saved to the secret store, this address will be used to deploy contracts. See saved secrets with `docker secret ls`.

The contract deployment script will save the addresses of your deployed contracts in `modules/contracts/ops/address-book.json`. This file is automatically generated and you probably won't need to mess with it. One exception: if you want to redeploy some contract(s), then delete their addresses from the address book & re-run the above deployment script.

We have committed the address book that the Connext team is using to launch the Dai Card & will be tracking these changes via git. If you want to deploy an independent hub then, after running the above contract deployment script, copy the modified address book to the project root: `cp modules/contracts/ops/address-book.js address-book.json`.

An address book in the project root will be ignored by git and will take priority over the one in the contracts module.

You can upload a custom address book to your prod server's project root like this:

`scp -i ~/.ssh/connext-aws address-book.json ubuntu@$SERVER_IP:~/indra/`

### Third, activate the CI pipeline

```
git push
```

This will trigger the CI pipeline that will run all test suites and, if none fail, deploy this app to production.

Pushing to any branch other than master will trigger a deployment to the server at `$STAGING_URL` specified by CircleCI. Pushing or merging into master will deploy to the servers at `$RINKEBY_URL` and `$MAINNET_URL.

If you haven't set up CircleCI yet or need to deploy a hotfix immediately, you can run the following:

```
# push docker images tagged :latest to docker hub
make push

# make sure that the indra repo is available on the prod server
ssh -i ~/.ssh/connext-aws ubuntu@SERVER_IP bash -c 'git clone https://github.com/ConnextProject/indra.git || true'

# make sure that the remote repo is up-to-date with master
ssh -i ~/.ssh/connext-aws ubuntu@SERVER_IP bash -c 'cd indra && git fetch && git reset --hard origin/master'

# Having a mode != "live" will deploy :latest images rather than ones tagged w an explicit version
ssh -i ~/.ssh/connext-aws ubuntu@SERVER_IP bash -c 'cd indra && MODE=hotfix ops/restart.sh prod'
```

Beware, CircleCI manages the env vars previously mentioned. If you don't deploy via CircleCI, then you need to manage these env vars manually by adding them to the server's `~/.bashrc`. Check out the server's current env vars with: `ssh -i ~/.ssh/connext-aws ubuntu@SERVER_IP env` and make sure it looks good before doing a manual deployment.

### Ongoing: Dealing w stuff in production

Monitor the prod hub's logs with

```
ssh -i ~/.ssh/connext-aws ubuntu@SERVER_IP bash indra/ops/logs.sh hub
```

The ChannelManager contract needs collateral to keep doing it's thing. Make sure the hub's wallet has enough funds before deploying. Funds can be moved from the hub's wallet to the contract manually via:

```
ssh -i ~/.ssh/connext-aws ubuntu@SERVER_IP bash indra/ops/collateralize.sh 3.14 eth
# To move Eth, or to move tokens:
ssh -i ~/.ssh/connext-aws ubuntu@SERVER_IP bash indra/ops/collateralize.sh 1000 token
```

## How to interact with an Indra hub

A prod-mode indra hub exposes the following API ([source](https://github.com/ConnextProject/indra/blob/master/modules/proxy/prod.conf#L53)):

 - `/api/hub` is the prefix for the hub's api
 - `/api/hub/config` returns the hub's config for example
 - `/api/eth` connects to the hub's eth provider
 - `/api/dashboard` connects to a server that gives the admin dashboard it's info
 - `/dashboard/` serves html/css/js for the dashboard client
 - anything else, redirects the user to a daicard client

### ..from a [dai card](https://github.com/ConnextProject/card)

Dai card in production runs a proxy with endpoints:

 - `/api/rinkeby/hub` -> `https://rinkeby.hub.connext.network/api/hub`
 - `/api/rinkeby/eth` -> `https://rinkeby.hub.connext.network/api/eth`
 - `/api/mainnet/hub` -> `https://hub.connext.network/api/hub`
 - `/api/mainnet/eth` -> `https://hub.connext.network/api/eth`
 - anything else: serves the daicard html/css/js files

### Hub API

 1. AuthApiService
  - GET /auth/status: returns success and address if a valid auth token is provided
  - POST /auth/challenge: returns a challenge nonce
  - POST /auth/response: 
    - nonce: returned by /auth/challenge
    - address
    - origin
    - signature

 2. ChannelsApiService
  - POST /channel/:user/request-deposit: 
    - depositWei
    - depositToken
    - lastChanTx
    - lastThreadUpdateId
  - GET /channel/:user/sync
    - params
      - lastChanTx
      - lastThreadUpdateId

TODO: Complete this section

## Debugging

If you encounter problems while the app is running, the first thing to do is check the logs of each component:

 - `bash ops/logs.sh chainsaw` (The source code in the hub module powers both the hub and the chainsaw)
 - `bash ops/logs.sh dashboard` (The node server powering the dashboard)
 - `bash ops/logs.sh dashboard_client` (The webpack dev server that hot-reloads the dashboard UI)
 - `bash ops/logs.sh database`
 - `bash ops/logs.sh ethprovider` (The migrations-runner aka contract deployer)
 - `bash ops/logs.sh ganache` (The dev-mode ethprovider. Runs as a child process inside the ethprovider and outputs logs to `modules/contracts/ops/ganache.log`)
 - `bash ops/logs.sh proxy`

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

If you noticed this error in the hub or chainsaw, for example, you can reinstall dependencies by running `make reset-hub && npm start`.

This happen when you run `npm install` manually and then try to deploy the app using docker. Some dependencies (eg scrypt) have pieces in C that need to be compiled. If they get compiled for your local machine, they won't work in docker & vice versa.

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

One other sanity check is to run `docker service ls` and make sure that you see an ethprovider service that has port 8545 exposed.

You can also run `docker exec -it indra_ethprovider.1.<containerId> bash` to start a shell inside the docker container. Even if there are networking issues between the container & host, you can still ping localhost:8545 here to see if ganache is listening & run `ps` to see if it's even alive.

Ganache should dump its logs onto your host and you can print/follow them with: `tail -f modules/contracts/ops/ganache.log` as another way to make sure it's alive. Try deleting this file then running `npm restart` to see if it gets recreated & if so, check to see if there is anything suspicious there

## Have you tried turning it off and back on again?

Restarting: the debugger's most useful tool.

Some problems will be fixed by just restarting the app so try this first: `npm restart` (takes about 60 seconds if nothing needs to be rebuilt)

If this doesn't work, try resetting all persistent data (database + the ethprovider's chain data) and starting the app again: `npm run reset && npm start` (This takes about 90 seconds). After doing this, you'll likely need to reset your MetaMask account to get your tx nonces synced up correctly.

If that doesn't work either, try rebuilding everything with `npm run rebuild && npm start`. (Takes about 7 minutes to complete)

`make purge && npm start` is the most aggressive option because it completely resets the app as if you deleted the repo and recloned it. This should be an option of last resort because it usually takes more than 10 minutes to reinstall all the dependencies & rebuild everything. Review the above trouble shooting tips first and, if nothing helps, then give this a shot.
