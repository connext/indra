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

`yarn start` <- This will take care of building everything & will launch a Connext hub in development-mode

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
