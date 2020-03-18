# Client Method Reference

All methods return promises.

## Core Channel Management Methods

### transfer

Makes a simple end-to-end transfer from one user's balance to another.

```typescript
transfer: (TransferParams) =>  Promise<ChannelState>
```

#### Example

```typescript
const payload: TransferParams = {
  recipient: "xpub123abc...", // channel.publicIdentifier of recipient
  amount: "1000", // in Wei
  assetId: "0x0000000000000000000000000000000000000000" // represents ETH
}

await transfer(payload)
```

### deposit

Deposits funds from a user's onchain wallet to a channel.

```typescript
deposit: (DepositParams) => Promise<ChannelState>
```

#### Example

```typescript
// Making a deposit in ETH
const payload: AssetAmount = {
  amount: "1000", // in Wei
  assetId: "0x0000000000000000000000000000000000000000" // i.e. Eth
};

await deposit(payload);
```

### swap

Conducts an in-channel swap from one asset to another.

```typescript
swap: (SwapParams) => Promise<ChannelState>
```

#### Example

```typescript
const payload: SwapParams = {
  amount: "100", // in Wei
  fromAssetId: "0x0000000000000000000000000000000000000000", // ETH
  toAssetId: "0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359" // Dai
}

await swap(payload)
```

### conditionalTransfer

Transfers with conditional logic determined by onchain app smart contract.

```typescript
conditionalTransfer: (ConditionalTransferParameters) => Promise<ConditionalTransferResponse>
```

#### Condition Types

##### Linked Transfer

Generate a secret and allow receiver to asynchronously unlock payment without needing recipient online. Useful for onboarding / airdropping.

- conditionType = "LINKED_TRANSFER"
- params = LinkedTransferParameters

##### Linked Transfer To Recipient

Generates a linked transfer which only the specified recipient can unlock. Useful for normal transfers where liveness is not guaranteed.

- conditionType = "LINKED_TRANSFER_TO_RECIPIENT"
- params = LinkedTransferToRecipientParameters

##### More conditional types are under active development, [reach out](https://discord.gg/yKkzZZm) for specific requests!

#### Example

```typescript
// linked transfer
const linkedParams: LinkedTransferParameters = {
  amount: parseEther("0.1").toString(),
  assetId: "0x0000000000000000000000000000000000000000" // ETH
  conditionType: "LINKED_TRANSFER",
  paymentId: createPaymentId(), // bytes32 hex string
  preImage: createPreImage(),// bytes32 hex string, shared secret
};

await conditionalTransfer(linkedParams);
```

### resolveCondition

Resolves a conditional transfer.

```typescript
resolveCondition: (params: ResolveConditionParameters<string>) => Promise<ResolveConditionResponse>
```

#### Example

```typescript
const resolveParams: ResolveLinkedTransferParameters = {
  amount: parseEther("0.1").toString(),
  assetId: "0x0000000000000000000000000000000000000000" // ETH
  conditionType: "LINKED_TRANSFER",
  paymentId: receivedPaymentId, // bytes32 hex string
  preImage: receivedPreImage // bytes32 hex string, shared secret
};

await resolveCondition(resolveParams);
```

### requestDepositRights

Requests deposit rights to enable multisig transfers to top up channel balance.

```typescript
requestDepositRights: (params: RequestDepositRightsParameters) => Promise<RequestDepositRightsResponse>
```

#### Example

```typescript
const requestParams: RequestDepositRightsParameters = {
  assetId: "0x0000000000000000000000000000000000000000" // ETH
};

await requestDepositRights(requestParams);
```

### rescindDepositRights

Rescinds deposit rights to "reclaim" deposited funds in free balance and allow node to request rights.

```typescript
rescindDepositRights: (params: RescindDepositRightsParameters) => Promise<RescindDepositRightsResponse>
```

#### Example

```typescript
const rescindParams: RescindDepositRightsParameters = {
  assetId: "0x0000000000000000000000000000000000000000" // ETH
};

await rescindDepositRights(rescindParams);
```

### checkDepositRights

Checks the current status of the deposit rights on the channel.

```typescript
checkDepositRights: (params: CheckDepositRightsParameters) => Promise<CheckDepositRightsResponse>
```

#### Example

```typescript
const checkParams: CheckDepositRightsParameters = {
  assetId: "0x0000000000000000000000000000000000000000" // ETH
};

const depositRights = await checkDepositRights(rescindParams);
console.log("depositRights: ", depositRights);
```

### on

Starts an event listener for channel events. See [Advanced - Event Monitoring](../advanced.md#event-monitoring) for a list of channel events.

```typescript
on: (event: ConnextEvents, (cb: any => any) => void) => void
```

#### Example

```typescript
connext.on("depositStartedEvent", () => {
  console.log("Your deposit has begun");
  this.showDepositStarted();
});
```

### withdraw

Withdraws funds from a channel to a specified onchain recipient.

```typescript
withdraw: (WithdrawParams) => Promise<ChannelState>
```

#### Example

```typescript
const payload: WithdrawParams = {
  recipient: "0xe43...", // optional, defaults to accounts[0]
  amount: "100"
  assetId: "0x0000000000000000000000000000000000000000"
}

await withdraw(payload)
```

## Generalized State Methods

Many of these functions rely on types from the `Node` object within the `@counterfactual/types` package, which is imported as:

```typescript
import { Node as CFCoreTypes } from "@counterfactual/types";
```

### getPaymentProfile

```typescript
getPaymentProfile: () => Promise<PaymentProfile>
```

#### Example

```typescript
await getPaymentProfile();
```

### getAppState

```typescript
getAppState: (appInstanceId: string) => Promise<CFCoreTypes.GetStateResult>
```

#### Example

```typescript
await getAppState("0xabc...");
```

### getFreeBalance

```typescript
getFreeBalance: (assetId: string) => Promise<CFCoreTypes.GetFreeBalanceStateResult>
```

#### Example

```typescript
// to get the ETH free balance in an object indexed by your
// freeBalanceAddress
await getFreeBalance("0x0000000000000000000000000000000000000000");
```

## Low Level Channel API (mapped to CF node)

These methods are used primarily for custom counterfactual applications. Many of these functions rely on types from the `Node` object within the `@counterfactual/types` package, which is imported as:

```typescript
import { Node as CFCoreTypes } from "@counterfactual/types";
```

### proposeInstallApp

```typescript
proposeInstallApp: (params: CFCoreTypes.ProposeInstallParams) => Promise<CFCoreTypes.ProposeInstallResult>
```

#### Example

```typescript
// initial state of your application, must match encoding
const initialState = {
  coinTransfers: [
    {
      amount: new BigNumber(1000),
      to: "xpub....",
    },
    {
      amount: new BigNumber(0),
      to: "xpub...",
    },
  ],
};

const params: CFCoreTypes.ProposeInstallVirtualParams = {
  abiEncodings: { // encodings matching .sol file of app
    actionEncoding: "",
    stateEncoding: ""
  },
  appDefinition: "0xdef..." // create2 address of app
  initialState,
  initiatorDeposit: new BigNumber(1000), // wei units
  initiatorDepositTokenAddress: "0x0000...", // assetId, AddressZero for ethereum
  outcomeType: appInfo.outcomeType, // CFCoreTypes.OutcomeType
  proposedToIdentifier: "0xabc...",
  responderDeposit: new BigNumber(0), // wei units
  responderDepositTokenAddress: "0x0000...", // assetId, AddressZero for ethereum,
  timeout: new BigNumber(0)
};

await proposeInstallApp(params);
```

### installApp

```typescript
installApp: (appInstanceId: string) => Promise<CFCoreTypes.InstallResult>
```

#### Example

```typescript
await installApp("0xabc...");
```

### rejectInstallApp

```typescript
rejectInstallApp: (appInstanceId: string) => Promise<CFCoreTypes.UninstallResult>
```

#### Example

```typescript
await rejectInstallApp("0xabc...");
```

### uninstallApp

```typescript
uninstallApp: (appInstanceId: string) => Promise<CFCoreTypes.UninstallResult>
```

#### Example

```typescript
await uninstallApp("0xabc...");
```

### installVirtualApp

```typescript
installVirtualApp: (appInstanceId: string) => Promise<CFCoreTypes.InstallVirtualResult>
```

#### Example

```typescript
await installVirtualApp("0xabc..");
```

### takeAction

```typescript
takeAction: (appInstanceId: string, action: CFCoreTypes.SolidityValueType) => Promise<CFCoreTypes.TakeActionResult>
```

#### Example

```typescript
// action below is used in resolving linked transfers
const action = {
  preImage: "0xfec..."
};
await takeAction("0xabc...", action);
```

### updateState

```typescript
updateState: (appInstanceId: string, newState: CFCoreTypes.SolidityValueType) => Promise<CFCoreTypes.UpdateStateResult>
```

#### Example

```typescript
await updateState("0xabc...", { preImage: createPreImage() });
```

### getProposedAppInstance

```typescript
getProposedAppInstance: (appInstanceId: string) => Promise<GetProposedAppInstanceResult | undefined>
```

#### Example

```typescript
await getProposedAppInstance("0xabc...");
```
