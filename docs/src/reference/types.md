# @connext/types

## ClientOptions

Object including the options to instantiate the connext client with.

The object contains the following fields:

| Name             | Type                    | Description                                              |
| ---------------- | ----------------------- | -------------------------------------------------------- |
| rpcProviderUrl   | String                  | the Web3 provider URL used by the client                 |
| nodeUrl          | String                  | url of the node                                          |
| mnemonic?        | String                  | (optional) Mnemonic of the signing wallet                |
| externalWallet?  | any                     | (optional) External wallet address                       |
| channelProvider? | ChannelProvider         | (optional) Injected ChannelProvider                      |
| keyGen?          | () => Promise<string[]> | Function passed in by wallets to generate ephemeral keys |
| store?           | object                  | Maps to set/get from CF. Defaults localStorage           |
| logLevel?        | number                  | Depth of logging                                         |
| natsUrl?         | String                  | Initially hardcoded                                      |
| natsClusterId?   | String                  | Initially hardcoded                                      |
| natsToken?       | String                  | Initially hardcoded                                      |

If the optional values are not provided, they will default to the ones that synchronize with the hub's configuration values. However, you must pass at least one signing option (mnemonic, externalWallet, or channelProvider).

### Type aliases

- [BigNumber](#bignumber)
- [CallbackStruct](#callbackstruct)
- [ConditionResolvers](#conditionresolvers)
- [ConditionalExecutors](#conditionalexecutors)
- [InternalClientOptions](#internalclientoptions)
- [ProposalValidator](#proposalvalidator)

### Variables

- [API_TIMEOUT](#api_timeout)
- [BigNumber](#bignumber)
- [MAX_RETRIES](#max_retries)
- [createPaymentId](#createpaymentid)
- [createPreImage](#createPreImage)

### Types

- [baseAppValidation](#baseappvalidation)
- [calculateExchange](#calculateexchange)
- [capitalize](#capitalize)
- [connect](#connect)
- [createLinkedHash](#createlinkedhash)
- [createRandom32ByteHexString](#createrandom32bytehexstring)
- [delay](#delay)
- [falsy](#falsy)
- [freeBalanceAddressFromXpub](#freebalanceaddressfromxpub)
- [insertDefault](#insertdefault)
- [invalid32ByteHexString](#invalid32bytehexstring)
- [invalidAddress](#invalidaddress)
- [invalidXpub](#invalidxpub)
- [isValidAddress](#isvalidaddress)
- [notBigNumber](#notbignumber)
- [notBigNumberish](#notbignumberish)
- [notGreaterThan](#notgreaterthan)
- [notGreaterThanOrEqualTo](#notgreaterthanorequalto)
- [notLessThan](#notlessthan)
- [notLessThanOrEqualTo](#notlessthanorequalto)
- [notNegative](#notnegative)
- [notPositive](#notpositive)
- [objMap](#objmap)
- [objMapPromise](#objmappromise)
- [prettyLog](#prettylog)
- [publicIdentifierToAddress](#publicidentifiertoaddress)
- [replaceBN](#replacebn)
- [validateLinkedTransferApp](#validatelinkedtransferapp)
- [validateSimpleTransferApp](#validatesimpletransferapp)
- [validateSwapApp](#validateswapapp)
- [validateTransferApp](#validatetransferapp)

### Object literals

- [appProposalValidation](#appproposalvalidation)

## Type aliases

### BigNumber

BigNumber: BigNumber

- Defined in [types.ts:15](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/types.ts#L15)

### CallbackStruct

CallbackStruct: object

- Defined in [listener.ts:26](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/listener.ts#L26)

#### Type declaration

### ConditionResolvers

ConditionResolvers: object

- Defined in [controllers/ResolveConditionController.ts:14](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/controllers/ResolveConditionController.ts#L14)

#### Type declaration

### ConditionalExecutors

ConditionalExecutors: object

- Defined in [controllers/ConditionalTransferController.ts:25](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/controllers/ConditionalTransferController.ts#L25)

#### Type declaration

### InternalClientOptions

InternalClientOptions: ClientOptions & object

- Defined in [types.ts:45](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/types.ts#L45)

### ProposalValidator

ProposalValidator: object

- Defined in [validation/appProposals.ts:9](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/validation/appProposals.ts#L9)

#### Type declaration

## Variables

### API_TIMEOUT

API_TIMEOUT: 5000 = 5000

- Defined in [node.ts:21](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/node.ts#L21)

### BigNumber

BigNumber: BigNumber = BigNumber

- Defined in [types.ts:16](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/types.ts#L16)

### MAX_RETRIES

MAX_RETRIES: 20 = 20

- Defined in [controllers/TransferController.ts:21](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/controllers/TransferController.ts#L21)

### createPaymentId

createPaymentId: createRandom32ByteHexString = createRandom32ByteHexString

- Defined in [lib/utils.ts:78](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/lib/utils.ts#L78)

### createPreImage

createPreImage: createRandom32ByteHexString = createRandom32ByteHexString

- Defined in [lib/utils.ts:79](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/lib/utils.ts#L79)

### baseAppValidation

- baseAppValidation(app: AppInstanceInfo, registeredInfo: RegisteredAppDetails, isVirtual: boolean, connext: ConnextInternal): Promise

- Defined in [validation/appProposals.ts:125](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/validation/appProposals.ts#L125)

  #### Parameters

  ##### app: AppInstanceInfo

  ##### registeredInfo: RegisteredAppDetails

  ##### isVirtual: boolean

  ##### connext: ConnextInternal

  #### Returns Promise

### calculateExchange

- calculateExchange(amount: BigNumber, swapRate: string): BigNumber

- Defined in [controllers/SwapController.ts:19](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/controllers/SwapController.ts#L19)

  #### Parameters

  ##### amount: BigNumber

  ##### swapRate: string

  #### Returns BigNumber

### capitalize

- capitalize(str: string): string

- Defined in [lib/utils.ts:10](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/lib/utils.ts#L10)

  #### Parameters

  ##### str: string

  #### Returns string

### connect

- connect(opts: ClientOptions): Promise<ConnextInternal\>

- Defined in [connext.ts:62](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/connext.ts#L62)

  Creates a new client-node connection with node at specified url

  #### Parameters

  ##### opts: ClientOptions

      The options to instantiate the client with. At a minimum, must contain the nodeUrl and a client signing key or mnemonic

  #### Returns Promise<ConnextInternal\>

### createLinkedHash

- createLinkedHash(action: UnidirectionalLinkedTransferAppActionBigNumber): string

- Defined in [lib/utils.ts:65](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/lib/utils.ts#L65)

  #### Parameters

  ##### action: UnidirectionalLinkedTransferAppActionBigNumber

  #### Returns string

### createRandom32ByteHexString

- createRandom32ByteHexString(): string

- Defined in [lib/utils.ts:74](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/lib/utils.ts#L74)

  #### Returns string

### delay

- delay(ms: number): Promise<void\>

- Defined in [lib/utils.ts:51](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/lib/utils.ts#L51)

  #### Parameters

  ##### ms: number

  #### Returns Promise<void\>

### falsy

- falsy(x: string | undefined): boolean

- Defined in [validation/bn.ts:13](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/validation/bn.ts#L13)

  #### Parameters

  ##### x: string | undefined

  #### Returns boolean

### freeBalanceAddressFromXpub

- freeBalanceAddressFromXpub(xpub: string): string

- Defined in [lib/utils.ts:61](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/lib/utils.ts#L61)

  #### Parameters

  ##### xpub: string

  #### Returns string

### insertDefault

- insertDefault(val: string, obj: any, keys: string\[\]): any

- Defined in [lib/utils.ts:39](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/lib/utils.ts#L39)

  #### Parameters

  ##### val: string

  ##### obj: any

  ##### keys: string\[\]

  #### Returns any

### invalid32ByteHexString

- invalid32ByteHexString(value: any): string | undefined

- Defined in [validation/hexStrings.ts:4](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/validation/hexStrings.ts#L4)

  #### Parameters

  ##### value: any

  #### Returns string | undefined

### invalidAddress

- invalidAddress(value: string): string | undefined

- Defined in [validation/addresses.ts:24](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/validation/addresses.ts#L24)

  #### Parameters

  ##### value: string

  #### Returns string | undefined

### invalidXpub

- invalidXpub(value: string): string | undefined

- Defined in [validation/addresses.ts:16](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/validation/addresses.ts#L16)

  #### Parameters

  ##### value: string

  #### Returns string | undefined

### isValidAddress

- isValidAddress(value: any): boolean

- Defined in [validation/addresses.ts:4](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/validation/addresses.ts#L4)

  #### Parameters

  ##### value: any

  #### Returns boolean

### notBigNumber

- notBigNumber(value: any): string | undefined

- Defined in [validation/bn.ts:15](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/validation/bn.ts#L15)

  #### Parameters

  ##### value: any

  #### Returns string | undefined

### notBigNumberish

- notBigNumberish(value: any): string | undefined

- Defined in [validation/bn.ts:21](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/validation/bn.ts#L21)

  #### Parameters

  ##### value: any

  #### Returns string | undefined

### notGreaterThan

- notGreaterThan(value: any, ceil: BigNumberish): string | undefined

- Defined in [validation/bn.ts:31](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/validation/bn.ts#L31)

  #### Parameters

  ##### value: any

  ##### ceil: BigNumberish

  #### Returns string | undefined

### notGreaterThanOrEqualTo

- notGreaterThanOrEqualTo(value: any, ceil: BigNumberish): string | undefined

- Defined in [validation/bn.ts:40](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/validation/bn.ts#L40)

  #### Parameters

  ##### value: any

  ##### ceil: BigNumberish

  #### Returns string | undefined

### notLessThan

- notLessThan(value: any, floor: BigNumberish): string | undefined

- Defined in [validation/bn.ts:50](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/validation/bn.ts#L50)

  #### Parameters

  ##### value: any

  ##### floor: BigNumberish

  #### Returns string | undefined

### notLessThanOrEqualTo

- notLessThanOrEqualTo(value: any, floor: BigNumberish): string | undefined

- Defined in [validation/bn.ts:59](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/validation/bn.ts#L59)

  #### Parameters

  ##### value: any

  ##### floor: BigNumberish

  #### Returns string | undefined

### notNegative

- notNegative(value: any): string | undefined

- Defined in [validation/bn.ts:72](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/validation/bn.ts#L72)

  #### Parameters

  ##### value: any

  #### Returns string | undefined

### notPositive

- notPositive(value: any): string | undefined

- Defined in [validation/bn.ts:68](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/validation/bn.ts#L68)

  #### Parameters

  ##### value: any

  #### Returns string | undefined

### objMap

- objMap<T, F, R>(obj: T, func: function): object

- Defined in [lib/utils.ts:13](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/lib/utils.ts#L13)

  #### Type parameters

  - #### T

  - #### F: keyof T

  - #### R

  #### Parameters

  ##### obj: T

  ##### func: function

      *   *   (val: T\[F\], field: F): R

          *   #### Parameters

              ##### val: T\[F\]

              ##### field: F


              #### Returns R

#### Returns object

### objMapPromise

- objMapPromise<T, F, R>(obj: T, func: function): Promise

- Defined in [lib/utils.ts:26](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/lib/utils.ts#L26)

  #### Type parameters

  - #### T

  - #### F: keyof T

  - #### R

  #### Parameters

  ##### obj: T

  ##### func: function

      *   *   (val: T\[F\], field: F): Promise<R\>

          *   #### Parameters

              ##### val: T\[F\]

              ##### field: F


              #### Returns Promise<R\>

#### Returns Promise<object\>

### prettyLog

- prettyLog(app: AppInstanceInfo): string

- Defined in [validation/appProposals.ts:116](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/validation/appProposals.ts#L116)

  #### Parameters

  ##### app: AppInstanceInfo

  #### Returns string

### publicIdentifierToAddress

- publicIdentifierToAddress(publicIdentifier: string): string

- Defined in [lib/utils.ts:57](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/lib/utils.ts#L57)

  #### Parameters

  ##### publicIdentifier: string

  #### Returns string

### replaceBN

- replaceBN(key: string, value: any): any

- Defined in [lib/utils.ts:6](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/lib/utils.ts#L6)

  #### Parameters

  ##### key: string

  ##### value: any

  #### Returns any

### validateLinkedTransferApp

- validateLinkedTransferApp(app: AppInstanceInfo, registeredInfo: RegisteredAppDetails, isVirtual: boolean, connext: ConnextInternal): Promise

- Defined in [validation/appProposals.ts:100](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/validation/appProposals.ts#L100)

  #### Parameters

  ##### app: AppInstanceInfo

  ##### registeredInfo: RegisteredAppDetails

  ##### isVirtual: boolean

  ##### connext: ConnextInternal

  #### Returns Promise

### validateSimpleTransferApp

- validateSimpleTransferApp(app: AppInstanceInfo, registeredInfo: RegisteredAppDetails, isVirtual: boolean, connext: ConnextInternal): Promise

- Defined in [validation/appProposals.ts:68](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/validation/appProposals.ts#L68)

  #### Parameters

  ##### app: AppInstanceInfo

  ##### registeredInfo: RegisteredAppDetails

  ##### isVirtual: boolean

  ##### connext: ConnextInternal

  #### Returns Promise

### validateSwapApp

- validateSwapApp(app: AppInstanceInfo, registeredInfo: RegisteredAppDetails, isVirtual: boolean, connext: ConnextInternal): Promise

- Defined in [validation/appProposals.ts:18](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/validation/appProposals.ts#L18)

  #### Parameters

  ##### app: AppInstanceInfo

  ##### registeredInfo: RegisteredAppDetails

  ##### isVirtual: boolean

  ##### connext: ConnextInternal

  #### Returns Promise

### validateTransferApp

- validateTransferApp(app: AppInstanceInfo, registeredInfo: RegisteredAppDetails, isVirtual: boolean, connext: ConnextInternal): Promise

- Defined in [validation/appProposals.ts:37](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/validation/appProposals.ts#L37)

  #### Parameters

  ##### app: AppInstanceInfo

  ##### registeredInfo: RegisteredAppDetails

  ##### isVirtual: boolean

  ##### connext: ConnextInternal

  #### Returns Promise

## Object literals

### appProposalValidation

appProposalValidation: object

- Defined in [validation/appProposals.ts:109](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/validation/appProposals.ts#L109)

### SimpleTransferApp

SimpleTransferApp: validateSimpleTransferApp = validateSimpleTransferApp

- Defined in [validation/appProposals.ts:110](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/validation/appProposals.ts#L110)

### SimpleTwoPartySwapApp

SimpleTwoPartySwapApp: validateSwapApp = validateSwapApp

- Defined in [validation/appProposals.ts:111](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/validation/appProposals.ts#L111)

### UnidirectionalLinkedTransferApp

UnidirectionalLinkedTransferApp: validateLinkedTransferApp = validateLinkedTransferApp

- Defined in [validation/appProposals.ts:112](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/validation/appProposals.ts#L112)

### UnidirectionalTransferApp

UnidirectionalTransferApp: validateTransferApp = validateTransferApp

- Defined in [validation/appProposals.ts:113](https://github.com/ConnextProject/indra/blob/f3563466/modules/client/src/validation/appProposals.ts#L113)
