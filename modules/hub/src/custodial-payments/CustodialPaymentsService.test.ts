import { Config } from '../Config'
import { default as DBEngine, SQL } from '../DBEngine'
import { OnchainTransactionService } from '../OnchainTransactionService'
import { assert, getTestConfig, getTestRegistry, parameterizedTests } from '../testing'
import { getMockWeb3 } from '../testing/mocks'
import { mkAddress } from '../testing/stateUtils'
import { toBN, toWei } from '../util'

import { CustodialPaymentsDao } from './CustodialPaymentsDao'
import { createTestPayment } from './CustodialPaymentsDao.test'
import { CustodialPaymentsService } from './CustodialPaymentsService'

const logLevel = 0
const config = getTestConfig({ logLevel })

describe('CustodialPaymentsService', () => {
  const registry = getTestRegistry({
    Config: config,
    Web3: getMockWeb3(config),
  })
  const db: DBEngine = registry.get('DBEngine')
  const dao: CustodialPaymentsDao = registry.get('CustodialPaymentsDao')
  const service: CustodialPaymentsService = registry.get('CustodialPaymentsService')
  const onchainTxnService: OnchainTransactionService = registry.get('OnchainTransactionService')

  beforeEach(async () => registry.clearDatabase())

  describe('createCustodialWithdrawal', () => {
    service.MIN_WITHDRAWAL_AMOUNT_TOKEN = '3'

    it('works', async () => {
      const tokenAmount = toWei('420')
      const { recipient } = await createTestPayment(
        registry,
        { amountToken: tokenAmount.toString() },
        { amountToken: tokenAmount.toString() },
      )
      assert.containSubset(await dao.getCustodialBalance(recipient), {
        balanceToken: tokenAmount,
        balanceWei: '69',
      })

      const wdAmount = toWei('6')
      const wd = await service.createCustodialWithdrawal({
        amountToken: wdAmount,
        recipient: mkAddress('0x74'),
        user: recipient,
      })

      const sentWei = '48602673147023086'
      assert.containSubset(wd, {
        user: recipient,
        recipient: mkAddress('0x74'),
        exchangeRate: '123.45',
        requestedToken: wdAmount,
        sentWei,
        state: 'new',
      })

      assert.containSubset(await dao.getCustodialBalance(recipient), {
        balanceToken: toWei(420 - 6).toString(),
        balanceWei: '69',
      })

      assert.containSubset((await db.queryOne(SQL`
        select *
        from onchain_transactions_raw
        where id = ${wd.onchainTransactionId}
      `)), {
        to: mkAddress('0x74'),
        value: sentWei,
      })

    })

    parameterizedTests([
      {
        name: 'fails when amount is too small',
        amountToken: '2',
        expectedError: /withdraw <= 3 tokens/,
      },

      {
        name: 'fails when there are no payments',
        amountToken: '5',
        recipient: mkAddress('0x999'),
        expectedError: /withdraw more than their balance/,
      },

      {
        name: 'fails when trying to withdraw more than balance',
        amountToken: '1000000000000',
        expectedError: /withdraw more than their balance/,
      },
    ], async t => {
      const { recipient } = await createTestPayment(registry)
      await assert.isRejected(service.createCustodialWithdrawal({
        user: t.recipient || recipient,
        recipient: mkAddress('0x74'),
        amountToken: toBN(t.amountToken),
      }), t.expectedError)
    })

    parameterizedTests([
      {
        name: 'trigger to ensure balance >= works',
        requestedToken: '1000000',
        expectedError: /reduces balance .* below 0/,
      },

      {
        name: 'trigger to ensure exchange rate is accurate works',
        requestedToken: '10',
        exchangeRate: '2',
        sentWei: '10',
        expectedError: /sent_wei does not match/,
      },

      {
        name: 'trigger to ensure tx value matches wd amount',
        txValue: '20',
        requestedToken: '10',
        expectedError: /withdrawal transaction value does not match withdrawal amount/,
      },

    ], async t => {
      const { recipient } = await createTestPayment(registry)
      const txn = await onchainTxnService.sendTransaction(db, {
        from: recipient,
        to: recipient,
        value: t.txValue || t.requestedToken,
      })
      await assert.isRejected(dao.createCustodialWithdrawal({
        user: recipient,
        recipient,
        requestedToken: toBN(t.requestedToken),
        exchangeRate: t.exchangeRate || '1',
        sentWei: toBN(t.sentWei || t.requestedToken),
        onchainTransactionId: txn.id,
      }), t.expectedError)
    })

  })
})
