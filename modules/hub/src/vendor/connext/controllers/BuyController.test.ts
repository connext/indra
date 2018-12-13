import { MockConnextInternal, patch, MockStore } from '../testing/mocks'
import { assert, mkAddress } from '../testing/index'
import { PaymentArgs } from '@src/types'
// @ts-ignore
global.fetch = require('node-fetch-polyfill');

describe('BuyController: unit tests', () => {
  const user = mkAddress('0xUUU')
  let connext: MockConnextInternal
  const mockStore = new MockStore()

  beforeEach(async () => {
    connext = new MockConnextInternal()
    await connext.start()
  })

  it('should work', async () => {
    mockStore.setChannel({
      user,
      balanceWei: [0, 0],
      balanceToken: [10, 10],
    })
    connext = new MockConnextInternal({ user, store: mockStore.createStore() })
    await connext.start()
    await connext.buyController.buy({
      meta: {},
      payments: [
        {
          amount: { amountToken: '1', amountWei: '0' },
          type: 'PT_CHANNEL',
          meta: {},
          recipient: '$$HUB$$',
        },
      ],
    })

    await new Promise(res => setTimeout(res, 20))
    connext.mockHub.assertReceivedUpdate({
      reason: 'Payment',
      args: {
        amountToken: '1',
        amountWei: '0',
        recipient: 'hub',
      } as PaymentArgs,
      sigUser: true,
      sigHub: false,
    })
  })

  afterEach(async () => {
    await connext.stop()
  })
})

/*
// TODO different casing
const performerAddress = '0xc257274276a4e539741ca11b590b9447b26a8051'
const HUB_ADDRESS = process.env.HUB_ADDRESS!

async function buy(bc: BuyController, amount: string, inChannel = false) {
  await bc.buy({payments: [{
    type: inChannel ? 'FEE' as any : 'PRINCIPAL' as any,
    receiver: inChannel ? process.env.HUB_ADDRESS! : performerAddress,
    amount: {
      type: CurrencyType.BEI,
      amount,
    },
  }]})
}

describe('isInChannelPayment', () => {
  it('should determine if a SpankpayPayment is in channel', () => {
    expect(
      isInChannelPayment({
        receiver: HUB_ADDRESS
      } as any)
    ).equals(true)
  })

  it('should determine if a SpankpayPayment is a thread payment', () => {
    expect(
      isInChannelPayment({
        receiver: performerAddress
      } as any)
    ).equals(false)
  })
})

describe('BuyController', () => {
  let bc: BuyController


  let mockStore: MockStore
  let connext: Connext
  let web3: Web3
  let logger: MockLogger

  let address: string
  let store: WorkerStore
  let provider: any

  beforeEach(async () => {
    const providerOpts = new ProviderOptions(store).approving() as any
    provider = clientProvider(providerOpts)

    web3 = new Web3(provider)
    logger = new MockLogger()
    connext = createConnext(web3)
    mockStore = new MockStore()

    address = await mockStore.setInitialWallet()
  })

  afterEach(async () => await provider.stop())

  it('should throw when attempting to buy more than channel balance', async () => {
    mockStore.setInitialChannel({
      ...ZERO_STATE,
      user: address,
      balanceTokenUser: '10'
    })

    const store = mockStore.createStore()


    bc = new BuyController(store, logger as any, connext)

    let updateHub = sinon.mock()
    let getThreadsByParties = sinon.mock()
    getThreadsByParties.resolves(null)

    connext.updateHub = updateHub
    connext.getThreadByParties = getThreadsByParties

    let err: Error|null = null

    expect(updateHub.callCount).equals(0)

    await buy(bc, '15')
      .catch((e) => {
        console.error('got error\n\n\\n\n\n', e)
        err = e
      })
    expect(!!err).equals(true)
    expect(err!.message).equals(LOW_BALANCE_ERROR)
  })

  it('should throw if there is another operation in progress')

  it('should sign each payment in a purchase')

  it('should work for in channel purchases')

  it('should work for thread payments')

  it('should open a new thread if current one is not large enough')

  it('should use current thread if it is large enough for the tip')

  it('should generate the correct purchaseThreadState based on the purchases')
})
*/
