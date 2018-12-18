# Setting up a Hub

## **Preparation**

First, make sure you have the following installed:

* [Docker](https://docs.docker.com/docker-for-mac/install/)
* [PostgreSQL](https://www.postgresql.org/download/)
* [Ganache Desktop](https://truffleframework.com/ganache) or [Ganache CLI](https://github.com/trufflesuite/ganache-cli)

Everything that you need to set up a Hub is available from our [Indra](https://github.com/ConnextProject/Indra) repository.

Clone Indra and `npm install`.

## Local Deployment

Initialize Ganache CLI or Ganache Desktop with the following mnemonic and settings:

`$ ganache-cli -m "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat" -i 4447 -b 3`

If you want to make things difficult for yourself, you can use a random seed. In that case, follow the instructions under **Testnet Deployment** for how to update your deployment scripts.

Then, compile and deploy contracts:

```text
$ truffle compile
$ truffle migrate --reset --network=development
```

Clean up any old docker containers.

```text
$ docker system prune -af
```

Then run the deployment script. This may take some time.

```text
$ npm run start-hub
```

Congratulations! You just set up a Connext Hub. Check `localhost:3000` to test if it spun up correctly.

## Testnet Deployment

Start your Geth node and then compile/migrate the contracts.

Open up `kernel/deploy.prod.sh` and replace the default values for `CONTRACT_ADDRESS`, `ETH_NETWORK_ID`, and `HUB_ACCOUNT` with the corresponding values for your specific deployment. Use `accounts[0]` for Hub's address.

After editing the deploy script, spinning up the Hub is the same process as for a local deployment: 

```text
$ docker system prune -af
$ npm run start-hub
```

## Mainnet Deployment

\[Coming soon\]

## Troubleshooting

You can view the logs for the Hub's docker containers with:

```text
npm run logs-hub 
```

```text
$ npm run logs-chainsaw
```

`npm run db` will let you access the postgres instance.

If you can't see the logs, try running the following:

```text
$ docker service ps --no-trunc connext_hub
```

```text
$ docker service ps --no-trunc connext_chainsaw
```

**Linux users:** Docker does not enable `host.docker.internal` unlike for Mac/PC. This means that chainsaw and your Hub are not able to connect to your blockchain. We're aware of the problem and trying to come up with a workaround. If you have any ideas, open an issue in the [repository](https://github.com/ConnextProject/indra).

