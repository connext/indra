# Funding your Channel

## Simple Deposits

Using the basic deposit function, `client.deposit()`, will attempt to deposit the amount/asset you specify from the client's signer address.

For this to work, you must first send the user's funds onchain to `client.signerAddress`. In the event that you're depositing a token, you must also send a small amount of Eth for gas.

There is WIP proposal to abstract away the pain of having to pay gas for the second transaction without compromising the security of user funds.

## Advanced: Controlling Deposit Flow

Sometimes, the above deposit mechanism is either not possible or has poor UX. An example of this is if the user is purchasing funds directly into their channel using Wyre or some other fiat->crypto onramp.

In these cases, it may make sense to access the lower level `requestDepositRights` and `rescindDepositRights` functions directly. When a client controls deposit rights in their channel for a given asset, they can deposit that asset into the channel from any source simply by sending funds to the channel multisig contract directly. Note that once the rights have been requested, _all_ transfers of that asset to the multisig are credited to the client’s channel balance. This means that a node will _not_ be able to deposit into a channel until the client explicitly calls `rescindDepositRights`.

checkDepositRights is a convenience method to get the current state of the channel’s deposit rights.

For example:

```typescript
// Transfer an ERC20 token manually
// create Ethers.js contract abstraction
const assetId = "0x..."; // token address
const tokenContract = new Contract(
  assetId,
  erc20Abi,
  ethers.getDefaultProvider("homestead"), // mainnet
);
// request deposit rights
await client.requestDepositRights({ assetId });

// once rights are requested, it's safe to deposit
// this step can be completed by an external service at that point
const tx = await tokenContract.transfer(client.multisigAddress, parseEther("10"));

// wait for tx to confirm
await tx.wait();

// now it's safe to rescind deposit rights
await client.rescindDepositRights({ assetId });
```

Note that depositing this way has some additional security considerations:

1. The transaction **must** be both sent and confirmed after deposit rights are requested but _before_ they are rescinded.
2. Sending funds directly to the multisig contract address without reqeusting deposit rights **will result in the loss of those funds**.

This makes `requestDepositRights` and `rescindDepositRights` only suitable for certain specific usecases where you can deterministically and reliably expect a deposit into the multisig _only_ at a certain time.

## Withdraw Commitments

A core user experience goal of Connext is abstracting away the process of paying gas (transaction fees) as much as possible. For client withdrawals, Connext uses a metatransaction pattern for where users sign commitments and have the node submit them to the blockchain on their behalf. The node may charge for this service using a user's in-channel funds if they choose.

This pattern works because the channel's offchain balance is atomically reduced based on whether a correctly signed commitment can be generated. There is no way for a node to steal a user's funds, but it is possible for the node become unresponsive or otherwise censor the user by not following through on submitting the tx to the blockchain after the commitment is generated.

In these cases, the client implementer needs to recover and submit these commitments themselves whenever convenient. Fortunately, we also backup these commitments in the client's store and they can be retrieved using:

```typescript
client.store.getWithdrawalCommitments(client.multisigAddress);
```
