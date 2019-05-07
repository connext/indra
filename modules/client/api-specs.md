
## High level API overview

```
import Connext from 'connext';

// connext is a ConnextInstance
// config is an optional ConnextOptions
const connext = new Connext(config)

// client is a ConnextClient
const client = connext.connect(hubUrl)
```

`connext` is set up with a (maybe randomly generated) signer and is able to validate & sign channel states. It is not configured to talk to any particular hub or interact w any particular channel.

It is something that a wallet can set up once and then inject into multiple web apps. Once injected, the web app will likely want to connect the injected connext client to their app's hub. This will be accomplished with the `connect` method to yield a `ConnextClient`

Interfaces:

```
interface ConnextOptions {
  mnemonic?: string
  privateKey?: string
  password?: string
  address?: string
  web3?: Web3
  loadState?: () => Promise<string | null>
  saveState?: (state: string) => Promise<any>
}

interface ConnextInstance {
  utils: {
    channelNumericFields: string[]
    assetToWei: (BN, string) => [BN, BN]
    createChannelStateHash: (channelState) => string
    generateSecret: () => string
    getExchangeRates: (ConnextState) => ExchangeRates
    hasPendingOps: (ChannelState<any>) => bool
    maxBN: (BN, BN) => BN
    minBN: (BN, BN) => BN
    toWeiBig: (number|string|BN) => BN
    toWeiString: (number|string|BN) => string
    weiToAsset: (BN, string) => BN
  }
  convert: {
    Args: (To, Reason, UpdateArgTypes[Reason]) => UpdateArgTypes<To>[Reason]
    ChannelRow: (To, ChannelRow<any>) => ChannelRow<To>
    ChannelState: (To, ChannelState<any>) => ChannelState<To>
    ChannelStateUpdateRow: (To, ChannelStateUpdateRow<any>) => ChannelStateUpdateRow<To>
    Deposit: (To, DepositArgs<any>) => DepositArgs<To>
    Exchange: (To, ExchangeArgs<any>) => ExchangeArgs<To>
    Fields: (NumericTypeName, NumericTypeName, string[], any) => any
    Payment: (To, PaymentArgs<any>) => PaymentArgs<To>
    ThreadState: (To, ThreadState<any>) => ThreadState<To>
    Withdrawal: (To, Withdrawal<any>) => Withdrawal<To>
    WithdrawalParameters: (To, WithdrawalParameters<any>) => WithdrawalParameters<To>
  }
  StateGenerator: StateGenerator
  Valiator: Valiator
  Poller: Poller
  connect: (string) => ConnextClient
}

interface ConnextClient {
  # static props, derived from the connected hub's config
  contractAddress: string
  ethNetworkId: string
  hubAddress: string
  hubUrl: string
  tokenAddress: string

  # Some props are inherited from the ConnextInstance
  Poller: ConnextInstance.Poller
  StateGenerator: ConnextInstance.StateGenerator
  Valiator: ConnextInstance.Valiator
  convert: ConnextInstance.convert
  utils: ConnextInstance.utils

  # core channel management methods
  buy: (PartialPurchaseRequest) =>  Promise<string>
  deposit: (Payment) => Promise<void>
  exchange: (srting, string) => Promise<void>
  on: ('onStateChange', (newState) => void) => void
  recipientNeedsCollateral: (string, Payment) => Promise<string|null>
  redeem: (string) => Promise<string>
  requestCollateral: () => Promise<void>
  start: () => void
  stop: () => void
  withdraw: (WithdrawalParameters) => Promise<void>
}
```


## Dump of all properties/methods/types used in the hub or daicard

### Static properties

 - contractAddress
 - ethNetworkId
 - hubAddress
 - tokenAddress

### Core Methods/Classes

 - StateGenerator
 - Validator
 - buy
 - deposit
 - exchange
 - getConnextClient
 - on: ('onStateChange', (newState) => void) => void
 - recipientNeedsCollateral
 - redeem
 - requestCollateral
 - start
 - stop
 - withdraw

### Utilities

 - Big: (string|number) => Big
 - Poller
 - assetToWei
 - createChannelStateHash
 - generateSecret()
 - getExchangeRates
 - hasPendingOps
 - isBN
 - maxBN
 - minBN
 - toWeiBig
 - toWeiString
 - weiToAsset

### Type Conversions

 - channelNumericFields
 - convertArgs
 - convertChannelRow
 - convertChannelState
 - convertChannelStateUpdateRow
 - convertDeposit
 - convertExchange
 - convertFields
 - convertPayment
 - convertThreadState
 - convertWithdrawal
 - convertWithdrawalParameters

### Types

 - ExchangeRates
 - Address
 - ArgsTypes
 - Big
 - ChannelManagerChannelDetails
 - ChannelRow
 - ChannelRowBN
 - ChannelState
 - ChannelStateBN
 - ChannelStateUpdate
 - ChannelStateUpdateRow
 - ChannelStateUpdateRowBN
 - ChannelUpdateReason
 - ConfirmPendingArgs
 - CreateCustodialWithdrawalOptionsBN
 - Currency
 - CurrencyConvertable
 - CurrencyType
 - CustodialBalanceRowBN
 - CustodialPaymentsRow
 - CustodialWithdrawalRowBN
 - DepositArgs
 - DisputeStatus
 - EmptyChannelArgs
 - ExchangeArgs
 - InvalidationArgs
 - Omit
 - OptimisticPurchasePaymentRow
 - OptimisticPurchasePaymentRowBN
 - Payment
 - PaymentArgs
 - PaymentBN
 - PurchasePayment
 - PurchasePaymentRow
 - PurchasePaymentSummary
 - PurchaseRowWithPayments
 - Sync
 - SyncResult
 - ThreadRow
 - ThreadRowBN
 - ThreadState
 - ThreadStateBN
 - ThreadStateUpdate
 - ThreadStateUpdateRow
 - ThreadStatus
 - UnsignedChannelState
 - UpdateRequest
 - UpdateRequestBN
 - WithdrawalArgs
 - WithdrawalParametersBN
