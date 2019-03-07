require('../register/common')

import PaymentHub from '../PaymentHub'
import { Big } from '../util/bigNumber';
import { default as Config } from '../Config'

const config = Config.fromEnv({
  authRealm: 'SpankChain',
  sessionSecret:
    'c2TVc9SZfPjOLp6pTw60J4Pp4I1UWU23PqO3nWYh2tBamQPLYuKdFsTsBdJZ5kn',
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
  adminAddresses: [
    process.env.WALLET_ADDRESS!,
    '0x6e5b92889c3299d9aaf23d59df0bdf0a9ad67e3c',
  ],
  branding: {
    title: 'SpankPay',
    companyName: 'SpankChain',
    backgroundColor: '#ff3b81',
    textColor: '#fff',
  },
  staleChannelDays: 7,
})

const hub = new PaymentHub(config)

async function run() {
  if (process.argv[2] === 'chainsaw') {

    await hub.startChainsaw()

  } else if (process.argv[2] === 'exit-channels') {

    await hub.startUnilateralExitChannels(process.argv.slice(3))

  // If the hub is started with the command "process-tx", the next arg
  // is a transaction hash to process
  // NOTE - this will override ...
  // process.argv[3] -> transaction hash
  } else if (process.argv[2] === 'process-tx') {
    await hub.processTx(process.argv[3])
  } else if (process.argv[2] === 'fix-channels') {
    await hub.fixBrokenChannels()
  } else {

    await hub.start()

  }
}

run().catch(console.error.bind(console))
