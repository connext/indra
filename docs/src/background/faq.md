# FAQ

## Interacting with Indra

### What's wrong with Indra?

If you encounter problems while the app is running, the first thing to do is check the logs of each component:

`make dls`: which services are running? Any services that aren't running (labeled has having `0/1` replicas) are worth investigating further.

If the node isn't running for example, check it's logs with: `bash ops/logs.sh node`.

If a fix isn't obvious, then ask us for help on [Discord](https://discord.gg/SmMSFf) & make sure to provide the output from `make dls` and the logs of any services that aren't running.

### Have you tried turning it off and back on again?

Restarting: the debugger's most valuable tool.

Some problems will be fixed by just restarting the app so try this first: `make restart`

If this doesn't work, try resetting all persistent data (database + the ethprovider's chain data) and starting the app again: `make reset && make start`. After doing this, you'll likely need to reset your MetaMask account to get your tx nonces synced up correctly.

If that still doesn't work either, try rebuilding everything with `make clean && make start`.

### `The container name "/indra_buidler" is already in use`

Full error message:

```bash
docker: Error response from daemon: Conflict. The container name "/indra_buidler" is already in use by container "6d37b932d8047e16f4a8fdf58780fe6974e6beef58bf4cc5e48d00d3e94a67c3". You have to remove (or rename) that container to be able to reuse that name.
```

You probably started to build something and then stopped it with ctrl-c. It only looks like the build stopped: the builder process is still hanging out in the background wrapping up what it was working on. If you wait for a few seconds, this problem will usually go away as the builder finishes & exits.

To speed things up, run `make stop` to tell the builder to hurry up and finish.

### Improperly installed dependencies

You'll notice this by an error that looks like this in some module's logs:

```node
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

```bash
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

```bash
$ cd modules/node && npm run migration:generate foo

> indra-node@4.0.12 migration:generate /home/username/Documents/connext/indra/modules/node
> typeorm migration:generate -d migrations -n  "foo"

Migration /home/username/Documents/connext/indra/modules/node/migrations/1581311685857-foo.ts has been generated successfully.
```

Note: if entity files have _not_ changed since the last db migration, the above will print something like "No changes detected" & not generate anything.

Once the migrations are generated, you should skim them & make sure the auto-generated code is sane & doing what you expect it to do. If it looks good, import it & add it to the migrations array in `modules/node/src/database/database.service.ts`.

## General

### What Connext is:

- A scalability solution for EVM-compatible blockchains.
- A software company that builds open source technology infrastructure for Ethereum applications.
- A non-custodial batching or "compression" layer on top of Ethereum which retains the security and self-sovereignty qualities of the base blockchain.

### What Connext is not:

- A custodial wallet or custody solution of any sort.
- An exchange or other financial service provider.
- A blockchain of its own.

**Connext DOES NOT in any way take custody of user funds. We don't even run the code, you do.**

### What problems does Connext solve?

Connext makes it possible to build scalable decentralized applications on the Ethereum blockchain.

The Ethereum blockchain already enables trust-minimized transactions between peers, but these transactions have high fees and slow confirmation times. This makes the Ethereum blockchain very suitable as a settlement layer, but not usable for day-to-day usecases. Connext reduces the number of transactions that need to be put onto Ethereum without changing the core decentralization and trust-minimization properties of Ethereum itself.

### Does Connext have a token or native currency? Will Connext do an ICO/IEO?

No, Connext does not currently have its own native token. There are no plans for Connext to ever do an ICO/IEO.

Connext transactions can be made in any Ethereum ERC20 token.

### How does Connext compare to other state channels solutions?

Connext is live on the Ethereum mainnet, is supported by a growing number of wallets/applications/stakeholders as the industry standard, and focuses largely on use cases related to conditional transfers.

Connext is also very easy to use as compared to other solutions! Check out [Quick Start Basics](../quickstart/basics.md) to learn more.

### How does Connext compare to Plasma/sidechains?

Plasma is a framework for scaling Ethereum capacity by using hierarchical sidechains with mechanisms to ensure economic finality. Plasma helps Ethereum scale _out_ (i.e. allowing for more parallel processing) rather than scaling _up_ (i.e. allowing for more transactions per block).

This means that plasma scales transactions around a specific ecosystem, rather than being massively horizontally scalable across the entirety of the Ethereum network (and other chains). Think of the difference between the transactional activity related to Uber vs the transactional activity related to Visa/Mastercard.

Plasma and Connext are mutually beneficial. Wallets that implement Connext at scale may need plasma-like solutions for seamless end user experience. Plasma chains, meanwhile, will need Connext to allow for interoperability and to allow users to utilize funds locked on the plasma chain without waiting for long exit timeouts.

### Are there fees?

Connext itself does not collect any fees from the network. Nodes providing packet routing and storage services within the network may collect fees if they choose to do so.

### How does Connext sustain itself?

For now, Connext is backed by VCs and grants from the Ethereum Foundation. Long term, the Connext team expects to monetize through selling ancillary services for reducing the operating costs of running nodes.

### Is there a whitepaper?

No. A protocol specification for Connext v2.0 can be found in the [Counterfactual framework documentation](https://specs.counterfactual.com/en/latest/).

## State Channels

### What happens if two parties disagree about an offchain transaction?

In Connext, each state update must be signed by all channel parties and contain an update nonce. In the event that a disagreement occurs, either party can resolve the dispute on the blockchain by submitting their highest-nonce update to the channel dispute resolution contract.

Arbitrator contracts contain instructions on how a transaction should be resolved, based on the contents of the state update and/or external factors such as time or onchain events.

### Why do you host a single node for v2.0?

One of the most difficult challenges of channelized networks is ensuring that there is enough _capacity_ (or collateral) in a given channel to receive transactions without interrupting the flow of updates.

Let's consider a simple transfer usecase in a hub and spoke system: if Alice wants to pay Bob 1 Eth through the Hub, Alice would first pay the Hub 1 Eth in her channel conditionally based on if the Hub would pay 1 Eth to Bob in his channel. To successfully complete this transfer, the Hub would need to _already_ have had 1 Eth in Bob's channel, which it could only have done if it knew beforehand that Bob would be the receiver of funds.

It turns out, this is largely a data science problem related to user behavior. Our goal with running a singular public node ourselves is to prioritize usability - by collecting data and coming up with a rebalancing/recollateralization protocol beforehand, we can improve the efficiency of collateral allocation for decentralized nodes in the future.

### Doesn't that mean you're centralized?

Yes! This version of Connext is centralized. We fully acknowledge that this is the case and have been transparent about it from first deployment.

V2.x of Connext will enable support for transactions routed over multiple nodes, and will make it much simpler for any organization or individual to run their own node. At that point, we expect the network to become more and more decentralized.

Note that centralization here is completely different from being custodial. While we are currently the only entity routing and processing packets, this _does not_ mean that we hold user funds in any way. The primary risk here is censorship of transactions themselves. Also note that our node implementation is fully open source, so anyone can come run their own node if they wanted to - in fact, many companies already do!
