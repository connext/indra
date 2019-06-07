# Indra

Everything you need to set up a Connext payment channel hub.

## Contents
 - [To deploy using Docker](#to-deploy-using-docker)
 - [Deploying to production](#deploying-to-production)
 - [How to interact with the Hub](#how-to-interact-with-hub)
 - [Debugging & Troubleshooting](#debugging)

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

Beware! The first time this is run it will take a very long time (potentially as long as 10 minutes) but have no fear: downloads will be cached & most build steps won't ever need to be repeated again so subsequent `npm start` runs will go much more quickly. Get this started asap & browse the rest of the README while the first build/deploy completes.

Once all the pieces are awake, the hub will be available at `http://localhost:3000`.

### Useful scripts
 - `npm start`: Builds everything & then starts the app
 - `npm stop`: Stop the app once it's been started
 - `npm restart`: Stop the app & start it again, rebuilding anything that's out of date
 - `npm run clean`: Stops the app & deletes all build artifacts. Downloaded data (eg `node_modules`) isn't removed.
 - `npm run reset`: Stops the app & removes all persistent data (eg database & chaindata)
 - `npm run start-prod`: Start the app in production-mode
 - `npm run dls`: Show all running services (groups of containers) plus list all running containers.
 - `npm run db`: Opens a console attached to the running app's database. You can also run `npm run db '\d+'` to run a single PostgreSQL query (eg `\d+` to list table details) and then exit.
 - `npm run logs hub`: Monitor the hub's logs. Similar commands can be run to monitor logs for the `proxy`, `chainsaw`, `ethprovider` (for migrations output), `ganache` (for log of rpc calls to ganache), `database`, `redis`, etc.

(Many `npm run` commands are also available via `make` eg you can run `make start` or `make clean` instead of the `npm run` equivalents.)

### Running Unit Tests
 - `npm run test-all`
 - `npm run test-client`
 - `npm run test-contracts`
 - `npm run test-hub`

### To run e2e tests against the daicard
 1. Run `npm start` in Indra
 2. `git clone https://github.com/ConnextProject/card.git && cd card && make start`
 3. From the card repo, run `make start-test` to watch the tests run in a browser or just `make test` to run the e2e tests headlessly

### Watching compilation/tests during development

To activate watchers, run one of:
 - `make watch-client`
 - `make watch-hub`

Running one of these commands will recompile and test the client or hub any time a change is detected in `modules/client/src` or `modules/hub/src` respectively. These watchers will persist in the terminal they're started from and can be stopped at any point with ctrl-c.

You *could* watch the client and the hub and start the app all at once but this will use lots of CPU. It's recommended that you only run a watcher for the module you're actively developing against and then start the app when you're done making changes and are ready to run e2e tests.

## Deploying to Production

Tweak, check, tweak, check, commit. Time to deploy!

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

### Third, deploy the contracts

**Once per smart contract**

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

### Fourth, deploy a new version of the connext client

(This step can be skipped if we've only made changes to the hub & not the client)

To publish a new version of the client:

```
bash ops/deploy-client.sh
```

This script will prompt you for a new version number. Heuristics:
 - Is this minor bug fix? Then increment the minor version eg `1.0.0` -> `1.0.1`
 - Did you add a new, backwards-compatible feature? Then increment the middle version eg `1.0.0` -> `1.1.0`
 - Did you add a new, backwards-incompatible feature? Then increment the major version eg `1.0.0` -> `2.0.0`

Once you specify the version, it will automatically:
 - update `modules/client/package.json` with the new version
 - run npm publish
 - update `modules/hub/package.json` to import the newly published version of the connext library
 - create & push a new git commit
 - create & push a new git tag

### Lastly, deploy a new Indra hub

There is a long-lived staging branch that is the intermediate step between Indra development and production. All merges and PRs should be made from a feature branch onto staging. The master branch is dealt with automatically so you shouldn't need to manually commit or merge to master unless you're updating the readme or something that doesn't affect any of the actual source code.

Updating origin/staging will kick off the first round of CI and, if all tests pass, it will deploy the changes to the `$STAGING_URL` configured by your circle ci env.

```
git checkout staging && git mege feature-branch # alternatively, do a code review & merge via a GitHub PR
```

Once the staging branch's CI runs and deploys, check out your staging env. Does everything look good? Seem ready to deploy to production?

To deploy a new Indra hub to production, run:

```
bash ops/deploy-indra.sh
```

This script will prompt you for a new version number. See the previous step for versioning heuristics. Once you specify the version, it will automatically:
 - merge staging into master
 - update the project root's `package.json` with the version you provided & amend this change to the merge commit
 - push this commit to origin/master
 - create & push a new git tag

Pushing to origin/master will trigger another CI run that will deploy a new Indra hub to production if no tests fail.

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
 - `/api/hub/subscribe` connects to the hub's websocket server for real-time exchange rate & gas price updates
 - `/api/eth` connects to the hub's eth provider
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
