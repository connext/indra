[![CircleCI](https://circleci.com/gh/ConnextProject/indra-v2/tree/master.svg?style=shield)](https://circleci.com/gh/ConnextProject/indra-v2/tree/master)

# Indra V2
V2 of Connext's State Channel Network.

## Quickstart

* `make start` - Runs a dockerized stack + Daicard with pre-configured URLs
* `bash ops/logs.sh {node,card,database,nats,ethprovider}` - View logs for various components
* `make stop` - Stops the stack
* `make clean` - Rebuilds packages, useful if switching branches or updating package versions
* `make reset` - Deletes the database volume and redeploys contracts onto Ganache

Note: Make sure no other services are running on ports 5432 or 4222 (i.e. local Postgres, local NATS server).