
# Limitations & Assumptions

There are a few considerations to be aware of as an implementer.

## Availability

The wallet must acknowledge every state update by cosigning that state. This means in order to update your channel, the user must be online. We've built several different conditional transfer types to help accommodate user availability constraints. 


## Default Conditional Transfers and UX Impacts

### Link

Link transfers let you to create a preloaded link that can be redeemed for a given amount of funds. When you create a link, the amount of the link is deducted from your channel balance and the funds are locked by the node pending the receipt of a secret. Next, a link is generated with that secret. It cannot be regenerated, so don't lose it or you'll lose those funds! This link (and only this link) can be used to unlock those funds.

Link payments are a useful tool for on-boarding new users and/or creating prepaid accounts.


## Autocollateralization

The node uses an autocollateralization mechanism that is triggered by any payment made, whether or not the payment was successful. Nodes determine amount of collateral needed based on user profiles (e.g., in a retail environment the cashier might be assigned a profile that gives them a large amount of collateral so they can receive many payments). Additionally, there are floors and ceilings implemented by node operators to minimize the amount of collateral that is locked in node channels, as well as set a minimum amount of collateral to be maintained in each channel.


## Current Trust Assumptions

While the underlying protocol is completely noncustodial, there are trust assumptions which we want to make explicit. We are actively addressing these assumptions, so expect this section to change over the next few months.

### Updates are censorable

Connext uses [NATS](https://nats.io) - a highly scalable, lightweight, open source, p2p messaging system. NATS lets us have multiple independent copies of state hosted by the client, hub and independent backups. Unfortunately, it still requires that we implement a messaging server (currently hosted by the hub) to work properly. This means that while they're p2p, messages in the centralized v2.0 hub are censorable for now.

The decision to use NATS specifically is a step towards solving this problem. NATS supports [decentralized (mesh) messaging by clustering](https://nats-io.github.io/docs/nats_server/clustering.html) many messaging servers together. This means is that we can ship clustered NATS instances as part of the Connext nodes in our eventual decentralized network, to decentralize our messaging layer in tandem.

### Transfers are censorable

In v2.0 of Connext, every user deposited into channels with the hub and then routes transfers to each other over the hub. This is a bootstrapping technique to create a reliable, easily iterable system while we collect user data and test a variety of different usecases. This also means, however, that our hub could be censored, DDoS'd or shut down, putting our payment service offline (though no user funds would be lost!).The addition of p2p messaging and generalized state is a huge step in towards eventually becoming decenralized, however. We expect to make steady progress towards a decentralized Connext, 2.x, now that we're live.

### Client proxies through hub's interface to access Redlock

By decentralizing user state storage, we introduced complexity related to concurrently updating state. In centralized servers, concurrency is handled by locking/unlocking state on each operation. For our distributed paradigm, we integrated Redis' [distributed locks](https://redis.io/topics/distlock) in the hub. Unfortunately, Redis isn't natively supported in browsers and [Webdis](https://webd.is), the browser-based Redis interface, doesn't support Redlock.

In the interest of shipping efficiently, we built a proxy interface hosted by the hub for the client to lock/unlock their state. In the short to mid term, we expect to reimplement or modify Webdis to use distributed locking as well.
