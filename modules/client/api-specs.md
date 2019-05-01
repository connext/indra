
## Static properties

 - contractAddress
 - ethNetworkId
 - hubAddress
 - tokenAddress

## Core Methods/Classes

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

## Utilities

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

## Type Conversions

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

## Types

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
