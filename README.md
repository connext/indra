# Indra

Everything you need to set up a Connext payment channel hub.

## Contents
 - [To deploy using Docker](#to-deploy-using-docker)
 - [To deploy locally](#to-deploy-locally)
 - [Deploying to production](#deploying-to-production)
 - [How to interact with Hub](#how-to-interact-with-hub)
 - [Debugging & Troubleshooting](#debugging)

For local development, you can either deploy the app in docker containers, or deploy it locally. See the next two sections for details.

If you encounter any problems, check out the [debugging guide](#debugging) at the bottom of this doc. For any unanswered questions, open an [issue](https://github.com/ConnextProject/indra/issues/new) or  reach out on our Discord channel & we'll be happy to help.

Discord Invitation: https://discord.gg/SmMSFf

## To deploy using Docker

**Prerequisites**

- `make`: (probably already installed) Install w `brew install make` or `apt install make` or similar.
- `jq`: (probably not installed yet) Install w `brew install jq` or `apt install jq` or similar.
- [`docker`](https://www.docker.com/)
- [`node` and `npm`](https://nodejs.org/en/)

To build & deploy in dev-mode, clone the repository and then run: `npm start`

Once all the pieces are awake, the app will be available at `http://localhost:3001`. (The wallet takes a long time to wake up, monitor it's progress with `npm run logs wallet`)

Beware: the first time this is run it will take a long time but have no fear: downloads will be cached & many build steps won't need to be repeated so subsequent builds will go much more quickly.

Useful scripts:
 - `npm start`: Builds everything & then starts the app
 - `npm run dls`: Show all running services (groups of containers) plus list all running containers.
 - `npm run db`: Opens a console attached to the running app's database. You can also run `npm run db '\d+'` to run a single PostgreSQL query (eg `\d+` to list table details) and then exit.
 - `npm run logs wallet`: Monitor the wallet's logs. Similar commands can be run to monitor logs for the `proxy`, `hub`, `chainsaw`, `ethprovider` (for migrations output), `ganache` (for log of rpc calls to ganache), `database`, or `redis`.
 - `npm stop`: Stop the app once it's been started
 - `npm restart`: Stop the app & start it again, rebuilding anything that's out of date
 - `npm run reset`: Stops the app & removes all persistent data (eg database & chaindata)
 - `npm run clean`: Stops the app & deletes all build artifacts. Downloaded data (eg `node_modules`) isn't removed.
 - `npm run deep-clean`: Stops the app & deletes all build artifacts & deletes downloaded data.
 - `npm run prod`: Start the app in production-mode

There are a handful of watcher flags at the top of `ops/deploy.dev.sh` that are off by default. The wallet aka UI will always be watched as it's served by a webpack-dev-server. If you expect to be actively developing any other modules, you can turn on watchers for those too and they'll be dynamically rebuild/redeployed on source-code changed without needing to restart the app. Careful, turning on all the watchers will increase the start-up time and drain your computer's battery more quickly.

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
 - `STAGING_URL` & `PRODUCTION_URL`: The URL from which the Indra application will be served.
 - `AWS_ACCESS_KEY_ID` & `AWS_SECRET_ACCESS_KEY`: (Optional) To enable database backup to remote AWS S3 storage

If `STAGING_URL=staging.bohendo.com` then
 - DNS needs to be properly configured so that `staging.bohendo.com` will resolve to the IP address of your staging server
 - The admin should have ssh access via `ssh dev@$STAGING_URL` after completing the next step.
 - The application will be accessible from `https://staging.bohendo.com` after deploying.

### Second, setup the production server

**Once per server**

First, copy your hub's private key to your clipboard. Then, run the following script (for best results, run it with a `$SERVER_IP` that points to a fresh Ubuntu VM):

`bash ops/setup-ubuntu.sh $SERVER_IP`. 

This setup script expects to find CircleCI's public key in `~/.ssh/circleci.pub`.

To run the setup script, we need to be able to ssh into either `root@$SERVER_IP` or `dev@$SERVER_IP`. If root, this script will setup the dev user and disable root login for security.

This script will also load your hub's private key into a docker secret stored on the server. You'll have to copy/paste it into the terminal, I usually load my mnemonic into metamask and then export the private key from there.

### Second, deploy the contracts

To deploy the ChannelManager Contract:

```
bash ops/deploy.contracts.sh rinkeby
```

The above will output the addresses your deployed contracts to `modules/contracts/ops/address-book.json`. This file is automatically generated and you probably won't need to mess with it. One exception: if you want to redeploy some contract(s), then delete their addresses from the address book & re-run the above deployment script.

We have committed the addresses that the Connext team is using to launch the Dai Card to source control. If you want to deploy your own hub, then after running the above contract deployment script, copy the address book to the project root: `cp modules/contracts/ops/address-book.js address-book.json`. This address book will be ignored by git so you won't be bothered by this file being constantly out of date. The address book in the project root will take priority over the one in the contracts module.

### Third, give it one final test

```
make test-all
```

The above command will build everything that's needed to run the full test suite and then run 3 sets of unit tests for (the client, contracts, and hub) plus a set of integration tests on the production-mode deployment.

If all tests are green, we're good to go

### Lastly, activate the CI pipeline

```
git push
```

This will trigger the CI pipeline that will run all test suites and, if none fail, deploy this app to production.

Pushing to any branch other than master will trigger a deployment to the server at `$STAGING_URL` specified by CircleCI. Pushing or merging into master will deploy to the server at `$PRODUCTION_URL`.

## How to interact with the Hub

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

### `The container name "/connext_buidler" is already in use`

Full error message:

```
docker: Error response from daemon: Conflict. The container name "/connext_buidler" is already in use by container "6d37b932d8047e16f4a8fdf58780fe6974e6beef58bf4cc5e48d00d3e94a67c3". You have to remove (or rename) that container to be able to reuse that name.
```

You probably started to build something and then stopped it with ctrl-c. It only looks like the build stopped: the builder process is still hanging out in the background wrapping up what it was working on. If you wait for a few seconds, this problem will usually go away as the builder finishes & exits.

To speed things up, run `make stop` to tell the builder to hurry up & finish and then pause until the builder is done & has exited.

### Hub errors on start

We've seen some non-deterministic errors on `npm start` where some part of the startup process errors out and the Hub doesn't launch properly. Here are ways to restart the app, in increasing orders of aggressiveness:

- Restart the app: `npm restart`
- Delete all persistent data (ie database & testnet chain data) and restart: `make reset && npm start`
- Rebuild everything and restart: `make clean && npm start`
- Reinstall dependencies and rebuild everything and restart: `make deep-clean && npm start`
- Remove package-locks and reinstall everything and delete persistent data and rebuild everything and restart: `make purge && npm start`

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

You can also run `docker exec -it connext_ethprovider.1.<containerId> bash` to start a shell inside the docker container. Even if there are networking issues between the container & host, you can still ping localhost:8545 here to see if ganache is listening & run `ps` to see if it's even alive.

Ganache should dump its logs onto your host and you can print/follow them with: `tail -f modules/contracts/ops/ganache.log` as another way to make sure it's alive. Try deleting this file then running `npm restart` to see if it gets recreated & if so, check to see if there is anything suspicious there

### Locked DB

We've seen the database get locked on startup when it crashes without exiting properly. Usually, this happens as a result of errors in the database migrations, this is especially common if db migrations have been updated recently.

Running `bash ops/unlock-db.sh` will unlock the database. Sometimes, this is all you need to do & things will start working.

Sometimes, if the database is corrupt, you'll want to run `make reset && npm start` to wipe out the old data and start the app again fresh. Note: `make reset` will only wipe out dev-mode data, so if you encounter this problem in production.. We're in for a tough time.

### 502 Bad Gateway

This is a pretty common error--it's either due to a locked DB 
(see above) or slow startup. 

To debug: run `npm run logs database`, and see if the DB is locked. If so, unlock it. If it's not locked, run `npm run logs wallet` to see if the wallet front-end has compiled. Most likely, the wallet is just taking a long time to compile and it's manifesting as a 502 error.

