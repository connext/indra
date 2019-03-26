import { parameterizedTests } from '../testing'
import { OnchainTransactionService } from '../OnchainTransactionService'
import { SQL } from '../DBEngine'
import { CustodialPaymentsDao } from './CustodialPaymentsDao'
import { createTestPayment } from './CustodialPaymentsDao.test'
import { CustodialPaymentsService } from './CustodialPaymentsService'
import { mkAddress } from '../testing/stateUtils'
import { default as DBEngine } from '../DBEngine'
import { assert, getTestRegistry } from '../testing'
import { Big } from '../util/bigNumber'
import { getMockWeb3 } from '../testing/mocks'

describe('CustodialPaymentsService', () => {
  const registry = getTestRegistry({
    Web3: getMockWeb3(),
  })
  const db: DBEngine = registry.get('DBEngine')
  const dao: CustodialPaymentsDao = registry.get('CustodialPaymentsDao')
  const service: CustodialPaymentsService = registry.get('CustodialPaymentsService')
  const onchainTxnService: OnchainTransactionService = registry.get('OnchainTransactionService')

  beforeEach(() => registry.clearDatabase())

  describe('createCustodialWithdrawal', () => {
    service.MIN_WITHDRAWAL_AMOUNT_TOKEN = '3'

    it('works', async () => {
      const tokenAmount = Big('420').times('1e18')
      const { recipient } = await createTestPayment(
        registry,
        { amountToken: tokenAmount.toFixed() },
        { amountToken: tokenAmount.toFixed() },
      )
      assert.containSubset(await dao.getCustodialBalance(recipient), {
        balanceToken: tokenAmount,
        balanceWei: '69',
      })

      const wdAmount = Big('6').times('1e18')
      const wd = await service.createCustodialWithdrawal({
        user: recipient,
        recipient: mkAddress('0x74'),
        amountToken: wdAmount,
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
        balanceToken: Big(420 - 6).times('1e18'),
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
        amountToken: Big(t.amountToken),
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
        requestedToken: Big(t.requestedToken),
        exchangeRate: Big(t.exchangeRate || '1'),
        sentWei: Big(t.sentWei || t.requestedToken),
        onchainTransactionId: txn.id,
      }), t.expectedError)
    })

  })
})
