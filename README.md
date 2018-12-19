# indra

Everything you need to set up a Connext payment channel hub.

## How to use this repository

The `master` branch contains deployment scripts in the `./ops` directory. Check out ChannelManager.sol in the contracts module to see the core smart contract powering this platform.

### Starting the hub

#### Prerequisites

- Make (required, probably already installed)
- [Docker](https://www.docker.com/) (required)
- [Node.js](https://nodejs.org/en/) + [Yarn](https://yarnpkg.com/lang/en/docs/install/#mac-stable) (recommended)

### tl;dr

**First, deploy the contract & docker images**

`make deploy` <- this will build the project's docker images and push them to docker hub

To deploy the ChannelManager Contract:

```
cd modules/contracts && yarn install
# the space at the beginning of the command below will prevent this
# command (& the mnemoic) from being stored in your shell's history
  MNEMONIC="candy maple cake sugar pudding cream honey rich smooth crumble sweet treat" INFURA_KEY="abc123xyz" ./node_modules/.bin/truffle migrate --network ropsten -from 3 --to 3
```

**Then, deploy your payment hub**

`yarn start` <- This will take care of building everything & will launch a Connext hub in development-mode

`bash ops/deploy.prod.sh` <- Assuming the docker images have been built & pushed to a registry, this will pull & deploy them

#### Details

Behind the scenes, `yarn start` will run `make` and then `bash ops/deploy.dev.sh`

`make` does the following:

1. Build the builder. This project relies on various build tools like c compilers & python & a specific version of nodejs. Rather than making you, the developer, figure out how to make nvm play nice with yarn, we'll use Docker to build the build environment for you. Based on the builder Dockerfile in the top-level ops.

2. Install dependencies. For example, to install stuff needed by the contracts module, we take the `modules/contracts` dir and stick it into a builder container. This container runs `yarn install` which usually requires compiling some crazy c stuff. When it's done, the container exits and we're left with freshly build `node_modules`.

3. Build stuff. Like it step 2, we stick the dir we're interested in into the builder docker container & build what's needed

`bash ops/deploy.dev.sh` starts 4 containers:

1. Redis: the least interesting.

2. Database: Runs db migrations then starts the database

3. Ethprovider: Runs contract migrations & starts a ganache testnet

4. Hub: manages your payment channel

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
