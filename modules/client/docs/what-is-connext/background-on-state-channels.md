# State Channel Background

## Background Reading

For general knowledge, you can read up on state channels at [LearnChannels](https://www.learnchannels.org/), a community effort that has compiled accessible information on state channels. Read on for Connext-specific explanations!

## What are state channel hubs?

State channel hubs extend the idea of state channels to facilitate two-party interactions among individuals who have not opened channels with each other. 

**First**, users open channels with their application's Connext Hub \(instead of with each other\) and lock their operating funds. 

**Then**, they send signed updates directly to the payee, just like with a normal state channel, by opening a communication "thread". 

**Finally**, when they are done transacting with the payee, they close the thread, which automatically turns the thread's transfers into two signed state updates: one from the payer to the hub and the second from the hub to the payee. As a result, users' balances are updated appropriately even though they've never opened a channel with each other.

Users can open new threads with subsequent counterparties, limited only by the amount of funds they have available. Because this entire process occurs through Connext Hubs rather than on the underlying blockchain, users do not pay any transaction fees or wait for blockchain confirmations until they close their state channel with the hub. At that point, their state history \(i.e., all of the user's transactions\) is compiled down into one final transaction on the blockchain. Like with simple state channels, state channel hub smart contracts act as arbitrators, so that neither users nor the hub have to trust each other at all.

These interactions, while seemingly complex, can be abstracted away through UX; for example, opening a channel could be represented as a "Deposit Funds" button and opening a thread could be wrapped in a "Pay User" button.

## What makes Connext's implementation different from other state channels?

There are a few significant differences between our implementation and other approaches. 

Our implementation of multihop transactions \(i.e., transactions between users who haven't opened a channel with each other\) relies on threads rather than hashed timelock contracts \(HTLCs\).

HTLCs rely on a contract that produces a hash when a payee receives funds from a payer, such that the payee can use that hash to unlock her funds. Because any receipt of funds triggers the creation of a new hash, this idea can be extended to allow a sequence of payments; with the right conditionality, payments can be securely routed through a series of users.

In our view, this approach has a few practical problems:

**First**, for all payments between two parties, HTLCs require hashlocks to be resolved and routes to be found. This results in higher work and bandwidth requirements for nodes in the network.

**Second**, the completion of payments via a routed network using HTLCs is probabilistic, depending on \(1\) the availability \("liveness"\) of users and \(2\) the quantity of funds held by those users. To forward payments through the network, users must be live and must have locked funds in a greater quantity than the payment they are forwarding. This makes the network geared towards dedicated payment processors who will forward transactions in exchange for fees.

As described above, Connext Hubs resolve P2P transactions into two separate transactions between \(1\) the payer and the hub, and \(2\) the payee and the hub. Rather than routing transactions through a network of peers, our transactions remain fully private between the payer, payee, and Hub. 

The main practical difference distinguishing threads from HTLCs is that intermediaries \(hubs\) are not required to "witness" balance updates between any two parties since they are only concerned with the initial and final balances resulting from the transaction. 

This has a few implications. We are able to relax liveness restrictions and apply them only in dispute cases. As a result, UX is less reliant on user availability.

Because our hubs will initially be application-specific and rely on threads rather than HTLCs, they offer:

1.  Less operational overhead than networks aimed at payment processing, because we don't incur the computational cost of resolving hashlocks. Parties simply open a thread and pass state updates back and forth. This is significantly more efficient than repeatedly resolving a series of hashlocks.
2. A better developer experience tailored to the needs of applications rather than payment processors.
3. Complete confidence that your users' transactions will be completed. Unlike with HTLCs, transactions are not probabilistic.
4. Transactions that are private between your Hub, the payer, and the payee.

HTLCs are likely more efficient for one-off payments between two unique parties \(e.g., an infrequent transaction like buying clothes\), while threads are better for more dedicated payments around a specific use case \(e.g., payments in a specific application--think paying for your coffee with an app each morning\).

The relative efficiency of our implementation means that it requires less bandwidth; our Hub model offers a simpler, easier, cheaper, and more application-focused solution than other approaches.

## Our Contract

ChannelManager.sol can be largely broken down into two classes of functions. The first operates as something that resembles an Ethereum multisignature wallet. The contract accepts funds from counterparties and then locks them there, requiring a signature from both parties, a "state update" \(settlement instructions\) and a "nonce" \(incrementing integer to figure out which state is the newest one\) in order to release funds. 

The second set of functions handles disputes. For well constructed, one-to-one state channels, disputes primarily occur because either \(1\) a party was unavailable or pretending to be unavailable, or \(2\) a party submitted an incorrect state when closing the channel - also known as a "replay attack". \(2\) is typically resolved by ensuring that, when a channel closes, a "challenge" timer is started within which either party can submit a newer, higher nonced, state update. This ensures that, if both parties are available, the latest mutually agreed upon update will always be used. \(1\) can be resolved with a long enough dispute timer, or with secondary mechanisms to inform a user that their channel is closing.

In our construction, we allow for threads to be opened across multiple channels, which then resolve down into traditional channel updates when communication in the thread is completed.

