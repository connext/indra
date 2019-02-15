# Indra

Everything you need to set up a Connext payment channel hub.

## Contents
 - [To deploy using Docker](#to-deploy-using-docker)
 - [To deploy locally](#to-deploy-locally)
 - [Repo executive summary](#repo-executive-summary)
 - [Local development](#local-development)
 - [Deploying to production](#deploying-to-production)
 - [How to interact with Hub](#how-to-interact-with-hub)
 - [Debugging & Troubleshooting](#debugging)

## To deploy using Docker

`npm start`

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
```
* `npm install` - Install dependencies.
* `npm start` - Runs the local dev server at `http://localhost:3000`.
* Set up Metamask to use one of the following accounts:

Address: 0xFB482f8f779fd96A857f1486471524808B97452D

Private Key: 09cd8192c4ad4dd3b023a8ef381a24d29266ebd4af88ecdac92ec874e1c2fed8 (hub's account, contains tokens)

Address: 0x2DA565caa7037Eb198393181089e92181ef5Fb53

Private Key: 54dec5a04356ed96fc469803f3e45b901c69c5d5fd93a34fbf3568cd4c6efadd

## Repo Executive Summary

You can run this project locally in dev-mode with `npm start` (or `npm restart`). Stop it with `npm stop`

The above start command will build anything needed for you but you can also build stuff manually with `make`.

Once everything builds & starts up, play with the app at `http://localhost` (the wallet module takes the longest to wake up, monitor it with `npm run logs wallet`)

You can wipe all persistent data and restart the app with a fresh db using `npm run reset`

You can run Indra in production-mode with `npm run prod` (or `npm restart prod`).

This repo is split into modules. Each module, ie `name`, in general, has source code in `modules/name/src` that the build/deploy tools in `modules/name/ops` use to build stuff that's output to either `modules/name/build` or `modules/name/dist`.

At runtime, most modules are run in their own docker container(s). These docker containers are built according to dockerfiles found in `modules/name/ops/*.dockerfile` and, on startup, run the scripts found in `modules/name/ops/*.entry.sh`

See all running containers with: `docker service ls`.

You can see the logs for some container with: `npm run logs name`. Where "name" would be `hub` for the docker container `connext_hub`.
The ethprovider has two sets of logs: `npm run logs ethprovider` will show migration logs and `npm run logs ganache` will show output from ganache.

Once the app is running, you can execute db commands with `bash ops/db.sh '\d+'` or open a db console with just `bash ops/db.sh`

If you encounter any problems, check out the debugging guide at the bottom of this doc. For any unanswered questions, reach out on our Discord channel & we'll be happy to help.

Discord: https://discord.gg/SmMSFf

## Local Development

**Prerequisites**

- Make (required, probably already installed)
- [Docker](https://www.docker.com/) (required)
- [Node.js](https://nodejs.org/en/)

`npm start` <- This will take care of building everything & will launch a Connext hub in development-mode, available from your browser at `localhost`

Beware: the first time this is run it will take a long time but have no fear: subsequent builds will go much more quickly.

A couple sets of `node_modules` will be installed when running `npm start` and this might strain your network connection. Occasionally, packages will get half downloaded & then the connection is lost resulting in "unexpected EOF" or "file not found" errors. Generally, trying again is likely all you need to proceed. If you see the same error more than once then some half-downloaded file is likely jamming up the works. Run `make deep-clean` to scrub any `node_modules` & lock files & caches that might be causing trouble. Then, give `npm start` another try & things will hopefully be good to go.

There are a handful of watcher flags at the top of `ops/deploy.dev.sh` that are off by default. The wallet aka UI will always be watched as it's served by a webpack-dev-server. If you expect to be actively developing any other modules, you can turn on watchers for those too. Careful, turning on all the watchers will increase the start-up time and drain your computer's battery more quickly.

## Deploying to Production

Tweak, check, tweak, check, commit. Time to deploy?

### First, setup CircleCI Environment Variables

**Once per CircleCI account or organization**: Run `ssh-keygen -t rsa -b 4096 -C "circleci" -m pem -f .ssh/circleci` to generate a new ssh key pair. Load the private key (`.ssh/circleci`) into CircleCI -> Settings -> Permissions -> SSH Permissions.

Go to CircleCI -> Settings -> Build Settings -> Environment Variables

 - `DOCKER_USER` & `DOCKER_PASSWORD`: Login credentials for someone with push access to the docker repository specified by the `repository` vars at the top of the Makefile & `ops/deploy.prod.sh`.
 - `STAGING_URL` & `PRODUCTION_URL`: The URL from which the Indra application will be served.

If `STAGING_URL=staging.bohendo.com` then
 - DNS needs to be properly configured so that `staging.bohendo.com` will resolve to the IP address of your staging server
 - The admin should have ssh access via `ssh dev@$STAGING_URL` after completing the next step.
 - The application will be accessible from `https://staging.bohendo.com` after deploying.

### Second, setup the production server

**Once per server**: `bash ops/setup-ubuntu.sh $SERVER_IP`. For best results, run this script with a `$SERVER_IP` that points to a fresh Ubuntu VM.

We need to be able to ssh into either `root@$SERVER_IP` or `dev@$SERVER_IP`. If root, this script will setup a dev user and disable root login for security.

The setup script expects to find CircleCI's public key in `~/.ssh/circleci.pub`.

This script will also load your hub's private key into a docker secret stored on the server. You'll have to copy/paste it into the terminal, I usually load my mnemonic into metamask and then export the private key from there.

### Second, deploy the contracts

To deploy the ChannelManager Contract:

```
# build everything you need for contract deployment with:
make ethprovider

# the spaces at the beginning of these commands will prevent them
# (& their secrets) from being stored in your shell's history
  export MNEMONIC="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"
  export ETH_PROVIDER="https://rinkeby.infura.io/abc123xzy"

./node_modules/.bin/truffle migrate --network=rinkebyLive
```

The above will output the address your ChannelManager contract was deployed to.

Add this new contract address & the token address & the account[0] you used in the migrations to the address book at `modules/contracts/ops/addresses.json`, the env vars in `modules/wallet/ops/prod.env`, and to the env vars on top of `ops/deploy.prod.sh`. TODO: Automate this.

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

Pushing to any branch other than master will trigger a deployment to the $STAGING server specified by CircleCI. Pushing or merging into master will deploy to the $PRODUCTION server.

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

