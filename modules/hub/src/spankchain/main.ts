import * as eth from 'ethers'

import { default as Config } from '../Config'
import PaymentHub from '../PaymentHub'
import '../register/common'

const config = Config.fromEnv({
  adminAddresses: [ process.env.WALLET_ADDRESS!, '0x6e5b92889c3299d9aaf23d59df0bdf0a9ad67e3c' ],
  authDomainWhitelist: [], // whitelist check is being skipped. All domains are allowed now
  authRealm: 'SpankChain',
  branding: {
    backgroundColor: '#ff3b81',
    companyName: 'SpankChain',
    textColor: '#fff',
    title: 'SpankPay',
  },
  port: 8080,
  recipientAddress: process.env.WALLET_ADDRESS!,
  sessionSecret: 'c2TVc9SZfPjOLp6pTw60J4Pp4I1UWU23PqO3nWYh2tBamQPLYuKdFsTsBdJZ5kn',
  staleChannelDays: 7,
})

const hub = new PaymentHub(config)

async function run(): Promise<void> {
  const subcommands = {
    'burn-booty': (args: string[]): Promise<void> => hub.hubBurnBooty(+args[0]),
    'chainsaw': (args: string[]): Promise<any> => hub.startChainsaw(),
    'collateralize': (args: string[]): Promise<void> =>
      hub.collateralizeChannel(args[0], eth.utils.bigNumberify(args[1])),
    'exit-channels': (args: string[]): Promise<void> => hub.startUnilateralExitChannels(args),
    'fix-channels': (args: string[]): Promise<void> => hub.fixBrokenChannels(),
    'hub': (args: string[]): Promise<any> => hub.start(),
    'process-tx': (args: string[]): Promise<void> => hub.processTx(args[0]),
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
  (err: Error) => {
    console.error(err)
    process.exit(1)
  },
)
