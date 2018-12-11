import { toBN } from '../helpers/bn'
import { ExchangeArgsBN } from '../types'
import { SyncResult } from '../types'
import { getThreadState } from '.'
import { UnsignedThreadState } from '../types'
import { ExchangeArgs } from '../types'
import { ChannelStateUpdate } from '../types'
import { IHubAPIClient } from '../Connext'
import Web3 = require('web3')
import { ConnextClientOptions } from '../Connext'
import { ConnextInternal } from '../Connext'
import { mkAddress, getChannelState, getChannelStateUpdate } from '.'
import { ChannelRow, ThreadRow, UnsignedChannelState, PurchasePaymentHubResponse, WithdrawalArgsBN, Payment } from '../types'
import { ExchangeRates } from '../state/ConnextState/ExchangeRates'

export class MockConnextInternal extends ConnextInternal {
  constructor(opts: Partial<ConnextClientOptions>) {
    super({
      user: mkAddress('0x123'),
      contractAddress: mkAddress('0xccc'),
      web3: new Web3(),
      hub: new MockHub(),
      ...opts,
    } as any)

    after(() => this.stop)
  }
}

export class MockHub implements IHubAPIClient {
  async getChannel(): Promise<ChannelRow> {
    return { id: 0, state: getChannelState('full'), status: 'CS_OPEN' }
  }

  async getChannelStateAtNonce(): Promise<ChannelStateUpdate> {
    return {
      args: {} as ExchangeArgs,
      reason: 'Exchange',
      state: getChannelState('full'),
    }
  }

  async getThreadInitialStates(): Promise<UnsignedThreadState[]> {
    return [getThreadState('full')]
  }

  async getIncomingThreads(): Promise<ThreadRow[]> {
    return [{ id: 1, state: getThreadState('full') }]
  }

  async getThreadByParties(): Promise<ThreadRow> {
    return { id: 1, state: getThreadState('full') }
  }

  async sync(): Promise<SyncResult[]> {
    return [{ state: getChannelStateUpdate('Payment'), type: 'channel' }]
  }

  async buy(): Promise<any> {
    return true
  }

  async requestDeposit(): Promise<SyncResult> {
    return {
      type: 'channel',
      state: getChannelStateUpdate('Payment'),
    }
  }

  async requestWithdrawal(withdrawal: Payment, recipient: string): Promise<WithdrawalArgsBN> {
    return {
      exchangeRate: '5',
      tokensToSell: toBN(withdrawal.amountToken),
      weiToSell: toBN(0),
      recipient,
      withdrawalWeiUser: toBN(withdrawal.amountWei),
      withdrawalTokenUser: toBN(0),
      withdrawalWeiHub: toBN(0),
      withdrawalTokenHub: toBN(0),
      depositWeiHub: toBN(0),
      depositTokenHub: toBN(0),
      additionalWeiHubToUser: toBN(0),
      additionalTokenHubToUser: toBN(0),
      timeout: +(Date.now() / 1000 + 60).toFixed(),
    }
  }

  async requestExchange(): Promise<ExchangeArgsBN> {
    return {
      exchangeRate: '1.69',
      tokensToSell: toBN(0),
      weiToSell: toBN(69),
    }
  }

  async getExchangerRates(): Promise<ExchangeRates> {
    return {
      'USD': '169.69',
    }
  }

  async requestCollateral(): Promise<UnsignedChannelState> {
    return getChannelState('unsigned')
  }

  async doPurchase(): Promise<PurchasePaymentHubResponse> {
    return {
      purchaseId: '1',
      updates: {
        type: 'channel',
        state: getChannelStateUpdate('Payment'),
      },
    }
  }

  async updateHub(): Promise<SyncResult[]> {
    return [
      {
        type: 'channel',
        state: getChannelStateUpdate('Payment'),
      },
    ]
  }
}
