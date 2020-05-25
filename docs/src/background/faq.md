
# FAQ

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
Plasma is a framework for scaling Ethereum capacity by using hierarchical sidechains with mechanisms to ensure economic finality. Plasma helps Ethereum scale *out* (i.e. allowing for more parallel processing) rather than scaling *up* (i.e. allowing for more transactions per block). 

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
One of the most difficult challenges of channelized networks is ensuring that there is enough *capacity* (or collateral) in a given channel to receive transactions without interrupting the flow of updates. 

Let's consider a simple transfer usecase in a hub and spoke system: if Alice wants to pay Bob 1 Eth through the Hub, Alice would first pay the Hub 1 Eth in her channel conditionally based on if the Hub would pay 1 Eth to Bob in his channel. To successfully complete this transfer, the Hub would need to *already* have had 1 Eth in Bob's channel, which it could only have done if it knew beforehand that Bob would be the receiver of funds.

It turns out, this is largely a data science problem related to user behavior. Our goal with running a singular public node ourselves is to prioritize usability - by collecting data and coming up with a rebalancing/recollateralization protocol beforehand, we can improve the efficiency of collateral allocation for decentralized nodes in the future.

### Doesn't that mean you're centralized?
Yes! This version of Connext is centralized. We fully acknowledge that this is the case and have been transparent about it from first deployment. 

V2.x of Connext will enable support for transactions routed over multiple nodes, and will make it much simpler for any organization or individual to run their own node. At that point, we expect the network to become more and more decentralized.

Note that centralization here is completely different from being custodial. While we are currently the only entity routing and processing packets, this *does not* mean that we hold user funds in any way. The primary risk here is censorship of transactions themselves. Also note that our node implementation is fully open source, so anyone can come run their own node if they wanted to - in fact, many companies already do!
