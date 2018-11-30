#!/usr/bin/env ts-node
/*
This tool will create withdrawals for all the custodially held funds, then
wait for all pending transactions to confirm.

It will save incremental state (in 'pending-withdrawals.json'), so it is safe
to stop and re-start at any point (althoug, note: the "pending payouts" will
change with each run, as they are pulled in live each time).

To run the tool:

  1. Make sure all environment variables are set appropriately (hint: run this
     from an existing API pod)

  2. Run the tool::

      $ ./connext-migration-disbursement-tool.ts
      Pending payouts:
      address						eth	eth (failed)
      0x0d157ce4366a39df7e41ad0019cf78d2a026a02e	0.004	
      0x12d6622deCe394b54999Fbd73D108123806f6a11	0.2	
      0x22d6622deCe394b54999Fbd73D108123806f6a12	1.135	
      0x32d6622deCe394b54999Fbd73D108123806f6a13	0.364	
      0x42d6622deCe394b54999Fbd73D108123806f6a14	0.191	
      0x69d6622deCe394b54999Fbd73D108123806f6a10	0.01	
      0x72d6622deCe394b54999Fbd73D108123806f6a17	0.06	
      0x783111ea0a46518bc14fe45b38f5d34b280d5046	0.06606561	
      0x82d6622deCe394b54999Fbd73D108123806f6a18	0.014	
      0x92d6622deCe394b54999Fbd73D108123806f6a19	0.162	
      0xaeedf5f2ee1c05b7e70a0c63e13391eaa3ea61e4	0.001	
      0xbb1699d16368ebc13bdc29e6a1aad50a21be45eb	0.00001701	
      0xBB1699d16368EBC13BDc29e6A1aaD50A21BE45EB	0.231	
      0xd39f078c10323e5de01d624c1c1d88fcfc25a561	0.01	
      0xeea077b94eea6bfe4232d103c756fabff6880293	0.011	
      0xf79d73650d972217cc4a87168a9f4d8443672ceb	0.007	
                                Total (rounded):	2.4660826	0.0000000

      Waiting for all withdrawals to be confirmed...
      0x02914306ba1835ef9a3f99b954d2b411f295a6609f7bc65c9a804ad35d7e4d50: US$0 -> 0x0108d76118d97b88aa40167064cb242fa391effb: PENDING
      Re-checking in 10 seconds...

Production deployment plan:

1. Put site into maintenance mode (possibly not _strictly_ necessary)
2. Merge this branch into master, deploy
3. When deployed, connect to one of the production pods
4. Run the script, as per instructions above

At the time of this writing, there are ~60 performers who need payouts.

All performers can be considered paid when:

1. The tool is run and there are no "pending payouts"
2. All listed withdrawals have a status of CONFIRMED

*/

require('./src/register/common')

import * as fs from 'fs'
import DBEngine from './src/DBEngine'
import {Client, QueryResult} from 'pg'
import PaymentHub from './src/PaymentHub'
import { PostgresWithdrawalsDao } from './src/dao/WithdrawalsDao'
import WithdrawalsService from './src/WithdrawalsService'
import { withdrawalToJson } from './src/domain/Withdrawal'

const hub = new PaymentHub({
  ethRpcUrl: process.env.ETH_RPC_URL!,
  databaseUrl: process.env.DATABASE_URL!,
  redisUrl: process.env.REDIS_URL!,
  channelManagerAddress: process.env.CHANNEL_MANAGER_ADDRESS!,
  authRealm: 'SpankChain',
  sessionSecret: 'c2TVc9SZfPjOLp6pTw60J4Pp4I1UWU23PqO3nWYh2tBamQPLYuKdFsTsBdJZ5kn',
  port: 8080,
  authDomainWhitelist: [
    'localhost',
    'vynos-staging.spankdev.com',
    'vynos-dev.spankdev.com',
    'vynos.spankchain.com',
    'vynos-connext.spankdev.com',
    'hub-staging.spankdev.com',
    'hub.spankchain.com',
    'hub-connext.spankdev.com',
  ],
  recipientAddress: process.env.WALLET_ADDRESS!,
  hotWalletAddress: process.env.HOT_WALLET_ADDRESS!,
  adminAddresses: [process.env.WALLET_ADDRESS!],
  branding: {
    title: 'SpankPay',
    companyName: 'SpankChain',
    backgroundColor: '#ff3b81',
    textColor: '#fff',
  },
  staleChannelDays: 7,
  ledgerChannelChallenge: 3600,
  serviceUserKey: process.env.SERVICE_USER_KEY,
  tokenContractAddress: process.env.TOKEN_CONTRACT_ADDRESS!,
  hotWalletMinBalanceEth: '0.69',
})

let container = hub.container
let db = container.resolve<DBEngine<Client>>('DBEngine')
let wdDao = container.resolve<PostgresWithdrawalsDao>('WithdrawalsDao')
let web3 = container.resolve<any>('Web3')

function safeWrite(outf: string, data: string) {
  fs.writeFileSync(outf + '.temp', data)
  fs.renameSync(outf + '.temp', outf)
}

function withTransaction(db: DBEngine<Client>, cb: any): Promise<any> {
  return new Promise((res, rej) => {
    db.exec(async client => {
      await client.query('BEGIN')
      try {
        await cb(client)
      } catch (e) {
        await client.query('ROLLBACK')
        rej(e)
      }
      await client.query('COMMIT')
      res()
    })
  })
}

async function updateWdStatus(wd: any): Promise<any> {
  const newObj = await wdDao.byId(wd.id)
  if (!newObj) {
    return
  }

  return withdrawalToJson(newObj)
}

async function run () {

  let res = await db.query(`
   with query as (
  select
    receiver,
    (sum(p.amountwei) filter (where withdrawal_id is null))  / 1e18 as eth_to_be_sent,
    (sum(p.amountwei) filter (where wd.status = 'FAILED')) / 1e18 as eth_in_failed_payments
  from payments as p
  left join withdrawals as wd on wd.id = p.withdrawal_id
  group by 1
  order by 1
)
select *
from query
where COALESCE(eth_to_be_sent, eth_in_failed_payments) IS NOT NULL AND receiver != '0x0000000000000000000000000000000000000000';
  `)
  console.log('Pending payouts:')
  console.log('address\t\t\t\t\t\teth\teth (failed)')
  let totals = { eth: 0, failed: 0 }
  for (let row of res.rows) {
    console.log(`${row.receiver}\t${(row.eth_to_be_sent || '').replace(/(\.[0-9]+?)0*$/, '$1')}\t${(row.eth_in_failed_payments || '').replace(/(\.[0-9]+?)0*$/, '$1')}`)
    totals.eth += +(row.eth_to_be_sent || 0)
    totals.failed += +(row.eth_in_failed_payments || 0)
  }
  console.log(`                          Total (rounded):\t${totals.eth.toFixed(7)}\t${totals.failed.toFixed(7)}`)

  let pendingWithdrawals: Array<any> = (
    fs.existsSync('pending-withdrawals.json') ?
      JSON.parse(fs.readFileSync('pending-withdrawals.json', 'utf-8')) :
      []
  )
  let savePendingWithdrawals = () => safeWrite('pending-withdrawals.json', JSON.stringify(pendingWithdrawals))

  let wdService = container.resolve<WithdrawalsService>('WithdrawalsService')
  for (let row of res.rows) {
    if (!row.eth_to_be_sent) {
      continue
    }

    let claim = await wdService.withdrawUsd(row.receiver)
    let wd = withdrawalToJson(claim)
    console.log('Withdrawal for', row.receiver, ':', wd)
    pendingWithdrawals.push(wd)
    savePendingWithdrawals()
  }

  while (true) {
    console.log('Waiting for all withdrawals to be confirmed...')
    let allFinished = true
    for (let wd of pendingWithdrawals) {
      let last = wd
      if (wd.status != 'CONFIRMED' && wd.status != 'FAILED') {
        let updatedWd = await updateWdStatus(wd)
        if (updatedWd) {
          pendingWithdrawals = pendingWithdrawals.map(w => w == wd? updatedWd : w)
          savePendingWithdrawals()
          wd = updatedWd
        }
        if (wd.status != 'CONFIRMED' && wd.status != 'FAILED')
          allFinished = false
      }
      let suffix = last !== wd ? ` -> ${wd.status}` : ''
      console.log(`${wd.txhash}: US$${wd.amountUsd} -> ${wd.recipient}: ${last.status}${suffix}`)
    }

    if (allFinished)
      break
    console.log('Re-checking in 10 seconds...\n\n')
    await new Promise(res => setTimeout(res, 10000))
  }

}

run().catch(err => {
  console.error(err)
  process.exit(1)
}).then(() => {
  console.log('Done!')
  process.exit(0)
})
