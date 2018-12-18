# Getting Started

Connext is made up of a few discrete repositories that interoperate:

## Indra <a id="contracts"></a>

Indra is the core implementation repository for Connext. Indra contains ready-for-deployment code for our core contracts and the scripts needed to set up your own Hub. Indra is fully available [here](https://github.com/ConnextProject/indra).

Note, Indra currently does not contain source code for the Hub, supporting services and associated infrastructure. Instead, the code needed to set up a Hub is programmatically pulled from our docker repositories when calling the deploy script. This is done partly for ease of use and partly because the our Hub code is still closed source for the time being. More on this below under **Hub**.

To set up your Hub with Indra, check out [Setting up a Hub](setting-up-a-hub.md).

## Contracts

At the core of the platform are our state channel contracts. Our state channel implementation relies on a combination of the research done by a variety of organizations, including [Spankchain](https://github.com/SpankChain/general-state-channels/)**,** [Finality](https://finalitylabs.io)**,** [Althea](https://altheamesh.com/blog/altheas-multihop-payment-channels/)**,** [Magmo](https://magmo.com/) and [CounterFactual](https://counterfactual.com/)**.** The contract repository is fully [open source](https://github.com/ConnextProject/connext-contracts).

The contracts repository should only be used for development purposes. The latest stable version of the contracts which works with Hub and Client will always be kept in Indra. For contributor documentation, check the repository.

## Client <a id="client"></a>

The Connext Client package is a JavaScript interface which is used to communicate with deployed Connext contracts and with other clients. The client package is available through [NPM](https://www.npmjs.com/package/connext). You can learn more about installing and using the Connext Client [here](setting-up-a-hub.md).

Clients are typically integrated into client-side code - either the frontend of your application or directly into the wallet layer. We built and tested the Client package around [Metamask](https://metamask.io), so we would recommend using that if possible. If you are hosting a wallet for your users, the simplest UX is to automatically request to open a channel with your Hub when your users deposit funds into the wallet. In other words, if you are hosting a wallet for your users, you can just use a combination of the Connext Contracts and Client as the wallet itself. This way, you can abstract away the technicalities of channels vs. threads for your users.

Clients contain the following functionality:

1. Opening a channel to any counterparty and depositing funds. Typically, the counterparty field would be locked to your Hub but Clients can be used for direct channels too.
2. Opening a thread to any counterparty provided that a path of channels exists to them. This path is provided by Hubs.
3. Closing a thread and automatically submitting the latest available mutually agreed update.
4. Closing a channel and automatically submitting the latest available mutually agreed update.
5. Handling a dispute.
6. Generating/signing/sending and validating/receiving state updates over HTTPs. The Client takes in the address of the server that is being used to pass messages in the constructor.

As explained in our [Background](https://docs.connext.network/~/drafts/-LMhftcfTvKwQu8-JODn/primary/what-is-connext/background-on-state-channels) section, state channel implementations need a communication layer where users can pass signed state updates to each other. The initial implementation of Connext does this through traditional server-client HTTPS requests. While this is the simplest and most effective mechanism for now, we plan to move to a synchronous message passing layer that doesn't depend on a centralized server as soon as possible.

## Hub <a id="hubs"></a>

Connext Hubs can be thought of as automated implementations of the client package with additional functionality to handle continuous throughput as a company.

Hubs are currently closed source because they still contain some proprietary code from our initial implementation with Spankchain. A cleaned, generalized version will be open sourced _very_ soon \(before DevCon 2018\).

