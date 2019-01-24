# Indra

Everything you need to set up a Connext payment channel hub.

# Important New Repo Information!

We are working on rebuilding our one-step process Docker environment. However, we have been running into lots of intermittent issues so in the meantime, please follow the below directions to get up and running with the new setup:

### Prerequisites
* PostgreSQL running locally: `brew install postgres` for Mac (TODO: add other platform information).
* Redis running locally: `brew install redis` for Mac (TODO: add other platform information).

Run the following steps in order. For each section, use a separate terminal window. Closing the terminal window will stop the process.

### Ganache
Run the following from `modules/hub`.
* `bash development/ganache-reset` - Migrates the contracts.
* `bash development/ganache-run` - Runs Ganache (if you put a number after the `ganache-run` command you can set the blocktime).

### Hub
Run the following from `modules/hub`.
* `bash development/hub-reset` - Resets the hub's database.
* `bash development/hub-run` - Runs hub and chainsaw.

### Wallet
Run the following from `modules/wallet`.
* `npm start` - Runs the local dev server at `http://localhost:3000`.
* Set up Metamask to use the following account:

Address: 0xFB482f8f779fd96A857f1486471524808B97452D

Private Key: 09cd8192c4ad4dd3b023a8ef381a24d29266ebd4af88ecdac92ec874e1c2fed8

The rest of the information in this Readme is potentially unstable or not working.
============================================================================

## Contents

- [Repo Executive Summary](#Repo-Executive-Summary)
- [How to get started developing](#How-to-get-started-developing)
    - [Prerequisites](#Prerequisites)
    - [TL;DR](#TL;DR)
    - [Details](#Details)
    - [How to interact with Hub](#How-to-interact-with-Hub)
 - [Debugging](#Debugging)
     - [Ethprovider or Ganache not working](#Ethprovider-or-Ganache-not-working)
     - [Hub errors on start](#Hub-errors-on-start)
     - [Locked DB](#Locked-DB)
     - [502 Bad Gateway](#502-Bad-Gateway)

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

## How to get started developing

### Prerequisites

- Make (required, probably already installed)
- [Docker](https://www.docker.com/) (required)
- [Node.js](https://nodejs.org/en/)

### TL;DR

**Note**: We have migrated away from using `yarn` due to [yarn issue 2629](https://github.com/yarnpkg/yarn/issues/2629), an unsolved bug in yarn that results in installations randomly failing.

**Local development is easy**

`npm start` <- This will take care of building everything & will launch a Connext hub in development-mode, available from your browser at `localhost`

Beware: the first time this is run it will take a long time but have no fear: subsequent builds will go much more quickly.

A couple sets of `node_modules` will be installed when running `npm start` and this might strain your network connection. Occasionally, packages will get half downloaded & then the connection is lost resulting in "unexpected EOF" or "file not found" errors. Generally, trying again is likely all you need to proceed. If you see the same error more than once then some half-downloaded file is likely jamming up the works. Run `make deep-clean` to scrub any `node_modules` & lock files & caches that might be causing trouble. Then, give `npm start` another try & things will hopefully be good to go.

There are a handful of watcher flags at the top of `ops/deploy.dev.sh` that are off by default. The wallet aka UI will always be watched as it's served by a webpack-dev-server. If you expect to be actively developing any other modules, you can turn on watchers for those too. Careful, turning on all the watchers will increase the start-up time and drain your computer's battery more quickly.

**To deploy to production: First, deploy the contract & docker images**

Before running make deploy, check the `modules/wallet/ops/prod.env` file as this will contain your wallet's prod-mode env vars. (TODO: build this dynamically from the env vars in `ops/deploy.prod.sh`) If these vars look good, then run:

`make deploy` <- this will build the project's docker images and push them to docker hub.

When pushing images to dockerhub, it's assumed that your account's username (obtained by running the `whoami` shell command) is also your docker hub username and that you've already run `docker login`. If these usernames are different, change the `registry` variable at the top of the Makefile before running `make deploy`.

To deploy the ChannelManager Contract:

```
make contract-artifacts
# the space at the beginning of the command below will prevent this
# command (& the mnemoic) from being stored in your shell's history
  MNEMONIC="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat" INFURA_KEY="abc123xyz" ./node_modules/.bin/truffle migrate --network ropsten
```

**Then, deploy your payment hub**

If you're deploying to a server on AWS or Digital Ocean, ssh into that server and make sure all of `git`, `make` and `docker` are installed on the machine you're deploying to. To deploy the payment hub, run:

```
git clone https://github.com/ConnextProject/indra.git
cp indra
DOMAINNAME=example.com bash ops/deploy.prod.sh
```

The `DOMAINNAME=example.com` prefix sets an env var that allows correct configuration of an https connection from which the wallet UI can be served securely. Make sure that your production server is reachable at the domain name you specify. You can also add this env var to your server's `~/.bashrc` if you don't want to specify the domain name during every deployment.

Assuming the docker images have been built & pushed to a registry, `bash ops/deploy.prod.sh` will pull & deploy them in an environment suitable for production.

Again, it runs `whoami` to get the current username & tries to use that as the registry name to pull docker images from. If your docker hub username is different, then update the registry var at the top of the `deploy.prod.sh` script before deploying.

If your hub is already deployed & you want to redeploy to apply changes you've made, all you need to do is checkout the branch you want to deploy (and pull if necessary) then run `bash ops/restart.sh prod`.

### Details

Behind the scenes, `npm start` will run `make` and then `bash ops/deploy.dev.sh`

`make` does the following:

1. Build the builder. This project relies on various build tools like c compilers & python & a specific version of nodejs. Rather than making you, the developer, figure out how to make nvm play nice with npm, we'll use Docker to build the build environment for you. Based on the builder Dockerfile in the top-level ops folder.

2. Install dependencies. For example, to install stuff needed by the contracts module, we take the `modules/contracts` dir and mount it into a builder container. This container runs `npm install` which usually requires compiling some crazy c modules. When it's done, the container exits and a freshly built `node_modules` is left behind in the directory that was mounted..

3. Build stuff. Like it step 2, we stick the dir we're interested in into the builder docker container & build what's needed.

`bash ops/deploy.dev.sh` starts 7 containers:

 1. Proxy: an nginx server that sits in front of both the hub & the wallet. Useful for preventing CORS problems.

 2. Wallet: A webpack-dev-server that watches & serves data from the wallet module.

 3. Hub: Manages your payment channel.

 4. Chainsaw: Watches for interesting blockchain events & processes them as needed

 5. Ethprovider: Runs contract migrations & starts a ganache testnet

 6. Database: Runs db migrations then starts the database

 7. Redis: Depended on by the hub & chainsaw

### How to interact with Hub

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


## Debugging

### `The container name "/connext_buidler" is already in use`

Full error message:

```
docker: Error response from daemon: Conflict. The container name "/connext_buidler" is already in use by container "6d37b932d8047e16f4a8fdf58780fe6974e6beef58bf4cc5e48d00d3e94a67c3". You have to remove (or rename) that container to be able to reuse that name.
```

You probably started to build something and then stopped it with ctrl-c. It only looks like the build stopped: the builder process is still hanging out in the background wrapping up what it was working on. If you wait for a few seconds, this problem will sometimes just go away as the builder finishes & exits.

To speed things up, run `make stop` to tell the builder to hurry up & finish and then wait for the builder to exit.


### Ethprovider or Ganache not working

```
#!/bin/bash
url=$ETH_PROVIDER; [[ $url ]] || url=http://localhost:8545
echo "Sending $1 query to provider: $url"
curl -H "Content-Type: application/json" -X POST --data '{"id":31415,"jsonrpc":"2.0","method":"'$1'","params":'$2'}' $url
```

This lets us do a simple `curleth net_version '[]'` as a sanity check to make sure the ethprovider is alive & listening. If not, curl gives more useful errors that direct you towards investigating either metamask or ganache.

One other sanity check is to run `docker service ls` and make sure that you see an ethprovider service that has port 8545 exposed.

You can also run `docker exec -it connext_ethprovider.1.<containerId> bash` to start a shell inside the docker container. Even if there are networking issues between the container & host, you can still ping localhost:8545 here to see if ganache is alive & run `ps` to see if it's even running.

Ganache should dump its logs onto your host and you can print/follow them with: `tail -f modules/contracts/ops/ganache.log` as another way to make sure it's alive. Try deleting this file then running `npm restart` to see if it gets recreated & if so, check to see if there is anything suspicious there

### Hub errors on start

We've seen some non-deterministic errors on `npm start` where some part of the startup process errors out and the Hub doesn't launch properly. We're still trying to track down the cause, but here's what's worked for community members after seeing an error:

- Running `npm start` again
- Rebuild everything then restart: `make clean && npm start`
- Remove build artifacts & persistent data storage and restart: `make purge && npm start`

### Locked DB

We've seen the database get locked on startup. Sometimes, this manifests as `502 Bad Gateway` when you try to load the wallet UX. The cause is unclear at the moment (for some reason the db didn't shut down properly last time), but running `bash ops/unlock-db.sh` followed by `yarn restart` should fix the problem.

### 502 Bad Gateway

This is a pretty common error--it's either due to a locked DB 
(see [Locked DB](#Locker-DB)) or slow startup. 

To debug: run `yarn logs database`, and see if the DB is locked. If so, unlock it. If it's not locked, run `yarn logs wallet` to see if the wallet front-end has compiled. Most likely, the wallet is just taking a long time to compile and it's manifesting as a 502 error.

