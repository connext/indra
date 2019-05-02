require('../register/common')

import PaymentHub from '../PaymentHub'
import { big } from '../Connext';
import { default as Config } from '../Config'
const {
  Big
} = big

const config = Config.fromEnv({
  authRealm: 'SpankChain',
  sessionSecret:
    'c2TVc9SZfPjOLp6pTw60J4Pp4I1UWU23PqO3nWYh2tBamQPLYuKdFsTsBdJZ5kn',
  port: 8080,
  authDomainWhitelist: [], // whitelist check is being skipped. All domains are allowed now
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
  const subcommands = {
    'hub': args => hub.start(),
    'chainsaw': args => hub.startChainsaw(),
    'exit-channels': args => hub.startUnilateralExitChannels(args),
    'process-tx': args => hub.processTx(args[0]),
    'fix-channels': args => hub.fixBrokenChannels(),
    'burn-booty': args => hub.hubBurnBooty(+args[0]),
    'collateralize': args => hub.collateralizeChannel(args[0], Big(args[1]))
  }

  const cmd = process.argv[2] || 'hub'
  const handler = subcommands[cmd]
  if (!handler) {
    console.error('Unknown subcommand: ' + cmd)
    console.error('Known subcommands: ' + Object.keys(subcommands).join(', '))
    return
  }

  await handler(process.argv.slice(3))

}

run().then(
  () => process.exit(0),
  err => {
    console.error(err)
    process.exit(1)
  },
)
