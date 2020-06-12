# @connext/client

All methods return promises.

## Management Methods

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
  assetId: "0x0000000000000000000000000000000000000000", // represents ETH
};

await transfer(payload);
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
  assetId: "0x0000000000000000000000000000000000000000", // i.e. Eth
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
  toAssetId: "0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359", // Dai
};

await swap(payload);
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

##### Linked Transfer To Recipient

Generates a linked transfer which only the specified recipient can unlock. Useful for normal transfers where liveness is not guaranteed.

- conditionType = "LINKED_TRANSFER_TO_RECIPIENT"
- params = LinkedTransferToRecipientParameters

```typescript
// linked transfer
const linkedParams: LinkedTransferToRecipientParameters = {
  amount: parseEther("0.1").toString(),
  assetId: "0x0000000000000000000000000000000000000000" // ETH
  conditionType: "LINKED_TRANSFER",
  paymentId: createPaymentId(), // bytes32 hex string
  preImage: createPreImage(),// bytes32 hex string, shared secret
  recipient: "xpub..." // recipient public identifier
};

await conditionalTransfer(linkedParams);
```

##### Fast Signed Transfer

Creates a persistent transfer app that reduces latency for micropayment use cases. Each transfer must specify a `signer` Ethereum address who can resolve the transfer with a signature on the payload, which consists of the `paymentId` hashed with arbitrary data.

```ts
export type FastSignedTransferParameters<T = string> = {
  conditionType: typeof FAST_SIGNED_TRANSFER;
  recipient: string;
  amount: T;
  assetId?: string;
  paymentId: string;
  maxAllocation?: T; // max amount to allocate to this app. if not specified, it will use the full channel balance
  signer: string;
  meta?: object;
};

export type FastSignedTransferResponse = {
  transferAppInstanceId: string; // app instance Id for installed application
};

// generate random payment ID
const paymentId = hexlify(randomBytes(32));
const { transferAppInstanceId } = (await client.conditionalTransfer({
  amount: parseEther("0.01").toString(),
  conditionType: FAST_SIGNED_TRANSFER,
  paymentId: ,
  recipient: "xpub...",
  signer: "0xAAA0000000000000000000000000000000000000",
  assetId: AddressZero,
  meta: { foo: "bar" },
} as FastSignedTransferParameters)) as FastSignedTransferResponse;
```

##### More conditional types are under active development, [reach out](https://discord.gg/yKkzZZm) for specific requests!

### resolveCondition

Resolves a conditional transfer.

```typescript
resolveCondition: (params: ResolveConditionParameters<string>) => Promise<ResolveConditionResponse>
```

#### Condition Types

##### Linked Transfer / Linked Transfer To Recipient

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

##### Fast Signed Transfer

```typescript
export type ResolveFastSignedTransferParameters = {
  conditionType: typeof FAST_SIGNED_TRANSFER;
  paymentId: string;
  data: string;
  signature: string;
};

export type ResolveFastSignedTransferResponse<T = string> = {
  appId: string;
  sender: string;
  paymentId: string;
  amount: T;
  assetId: string;
  signer: string;
  meta?: object;
};

// fast signed transfer has already been created
const withdrawerSigningKey = new SigningKey(signerWallet.privateKey);
const digest = solidityKeccak256(["bytes32", "bytes32"], [data, paymentId]);
const signature = joinSignature(withdrawerSigningKey.signDigest(digest));

const res: ResolveFastSignedTransferResponse = await clientB.resolveCondition({
  conditionType: FAST_SIGNED_TRANSFER,
  paymentId,
  signature,
  data,
} as ResolveFastSignedTransferParameters);
```

### requestDepositRights

Requests deposit rights to enable multisig transfers to top up channel balance.

```typescript
requestDepositRights: (params: RequestDepositRightsParameters) => Promise<RequestDepositRightsResponse>
```

#### Example

```typescript
const requestParams: RequestDepositRightsParameters = {
  assetId: "0x0000000000000000000000000000000000000000", // ETH
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
  assetId: "0x0000000000000000000000000000000000000000", // ETH
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
  assetId: "0x0000000000000000000000000000000000000000", // ETH
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
getAppState: (appInstanceId: string) => Promise<GetStateResult>
```

#### Example

```typescript
await getAppState("0xabc...");
```

### getFreeBalance

```typescript
getFreeBalance: (assetId: string) => Promise<GetFreeBalanceStateResult>
```

#### Example

```typescript
// to get the ETH free balance in an object indexed by your
// freeBalanceAddress
await getFreeBalance("0x0000000000000000000000000000000000000000");
```

## Low Level Channel API (mapped to CF node)

### proposeInstallApp

```typescript
proposeInstallApp: (params: ProposeInstallParams) => Promise<ProposeInstallResult>
```

#### Example

```typescript
// initial state of your application, must match encoding
const initialState = {
  coinTransfers: [
    {
      amount: BigNumber.from(1000),
      to: "xpub....",
    },
    {
      amount: BigNumber.from(0),
      to: "xpub...",
    },
  ],
};

const params: ProposeInstallVirtualParams = {
  abiEncodings: { // encodings matching .sol file of app
    actionEncoding: "",
    stateEncoding: ""
  },
  appDefinition: "0xdef..." // create2 address of app
  initialState,
  initiatorDeposit: BigNumber.from(1000), // wei units
  initiatorDepositTokenAddress: "0x0000...", // assetId, AddressZero for ethereum
  intermediaryIdentifier: "xpub...", // xpub of intermediary node, returned from config endpoint
  outcomeType: appInfo.outcomeType, // OutcomeType
  proposedToIdentifier: "0xabc...",
  responderDeposit: BigNumber.from(0), // wei units
  responderDepositTokenAddress: "0x0000...", // assetId, AddressZero for ethereum,
  timeout: BigNumber.from(0)
};

await proposeInstallApp(params);
```

### installApp

```typescript
installApp: (appInstanceId: string) => Promise<InstallResult>
```

#### Example

```typescript
await installApp("0xabc...");
```

### rejectInstallApp

```typescript
rejectInstallApp: (appInstanceId: string) => Promise<UninstallResult>
```

#### Example

```typescript
await rejectInstallApp("0xabc...");
```

### uninstallApp

```typescript
uninstallApp: (appInstanceId: string) => Promise<UninstallResult>
```

#### Example

```typescript
await uninstallApp("0xabc...");
```

### installVirtualApp

```typescript
installVirtualApp: (appInstanceId: string) => Promise<InstallVirtualResult>
```

#### Example

```typescript
await installVirtualApp("0xabc..");
```

### takeAction

```typescript
takeAction: (appInstanceId: string, action: SolidityValueType) => Promise<TakeActionResult>
```

#### Example

```typescript
// action below is used in resolving linked transfers
const action = {
  preImage: "0xfec...",
};
await takeAction("0xabc...", action);
```

### updateState

```typescript
updateState: (appInstanceId: string, newState: SolidityValueType) => Promise<UpdateStateResult>
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
