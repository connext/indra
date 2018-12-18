# FAQ

## What is the status of Connext?

Connext is [_live_ in production](https://medium.com/connext/our-first-hub-is-live-on-mainnet-b5660486635e). 

You can set up your own Hub by following the instructions at [Getting Started](../getting-started/). If you have any questions, feel free to reach out to the team directly on [our discord](https://discord.gg/KFqnvuM).

## What is a state channel?

A state channel is a method of cheaply and rapidly conducting transactions off the blockchain, while still maintaining the security advantages of the underlying chain. 

If you'd like to brush up on the basics, we've put together a web series of digestible explanations:

1. [Blockchains for Babies](https://medium.com/connext/blockchains-for-babies-14e3b0bf3c36)
2. State Channels for Babies Parts [One](https://medium.com/connext/state-channels-for-babies-c39a8001d9af) and [Two](https://medium.com/connext/state-channels-for-babies-part-2-76ad4538b98a)

For a more technically oriented discussion, check out our [State Channel Background](background-on-state-channels.md). 

## How does Connext compare to other state channel solutions?

Our implementation of peer-to-peer transactions is significantly cheaper than other solutions on the market, especially for recurring/repeated payments. This means less operational overhead for you.

We are also focused specifically on applications rather than payment processing, so we can offer an unparalleled developer experience.

For a more detailed description, see [here](background-on-state-channels.md#what-makes-connexts-implementation-different-from-other-state-channels).

## How does Connext compare to Plasma/sidechains?

Plasma is a [proposed framework](http://plasma.io/) for scaling Ethereum capacity by using hierarchical sidechains. While it offers significant speed and latency improvements over Ethereum itself, it cannot offer the near-zero latency and near-free transaction costs that Connext can. Moreover, Connext can be complementary to Plasma sidechains much as it is to Ethereum itself. For a more in-depth explanation of the differences, see [here](background-on-state-channels.md#state-channels-vs-plasma).

## Are there fees?

Our implementation [Indra](https://github.com/ConnextProject/indra), our [client](../client-docs-2.0.md), and [contracts](https://github.com/ConnextProject/connext-client) are open source and free to use! 

## Is there a whitepaper?

Not at the moment. We're seeing such a pressing need for Layer 2 scaling solutions that our time is best spent putting our ideas into action.

## Is there a token?

No. At present, we don't see any way to integrate a token into such low level infrastructure without either generating friction or creating usability barriers. Our goal is to be as permissionless as possible.

## How do I get started?

See our [Getting Started](../getting-started/getting-started.md) guide, and reach out to support@connext.network with any questions!

