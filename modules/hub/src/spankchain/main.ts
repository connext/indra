require('../register/common')

import PaymentHub from '../PaymentHub'

const hub = new PaymentHub({
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
  authRealm: 'SpankChain',
  channelManagerAddress: process.env.CHANNEL_MANAGER_ADDRESS!,
  ethRpcUrl: process.env.ETH_RPC_URL!,
  databaseUrl: process.env.DATABASE_URL!,
  port: 8080,
  recipientAddress: process.env.WALLET_ADDRESS!,
  redisUrl: process.env.REDIS_URL!,
  sessionSecret:
    'c2TVc9SZfPjOLp6pTw60J4Pp4I1UWU23PqO3nWYh2tBamQPLYuKdFsTsBdJZ5kn',
  hotWalletAddress: process.env.HOT_WALLET_ADDRESS!,
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
  ledgerChannelChallenge: 3600,
  serviceUserKey: process.env.SERVICE_USER_KEY,
  tokenContractAddress: process.env.TOKEN_CONTRACT_ADDRESS!,
  hotWalletMinBalanceEth: '6.9',
})

async function run() {
  if (process.argv[2] === 'chainsaw') {
    await hub.startChainsaw()
  } else if (process.argv[2] === 'correlate-deposits') {
    await hub.startDepositCorrelate()
  } else {
    await hub.start()
  }
}

run().catch(console.error.bind(console))
