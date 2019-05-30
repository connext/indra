import * as eth from 'ethers'

/* tslint:disable */// importing register/common needs to happen first
import '../register/common'
import { default as Config } from '../Config'
/* tslint:enable */
import PaymentHub from '../PaymentHub'
import { Logger } from '../util'

const config = Config.fromEnv()
const log = new Logger('Main', config.logLevel)
const hub = new PaymentHub(config)

async function run(): Promise<void> {
  const subcommands = {
    'burn-booty': (args: string[]): Promise<void> => hub.hubBurnBooty(+args[0]),
    'chainsaw': (args: string[]): Promise<any> => hub.startChainsaw(),
    'collateralize': (args: string[]): Promise<void> =>
      hub.collateralizeChannel(args[0], eth.utils.bigNumberify(args[1])),
    'exit-channels': (args: string[]): Promise<void> => hub.startUnilateralExitChannels(args),
    'exit-stale-channels': (args: string[]): Promise<void> =>
      hub.exitStaleChannels(args[0], args[1]), // days, maxDisputes?
    'fix-channels': (args: string[]): Promise<void> => hub.fixBrokenChannels(),
    'hub': (args: string[]): Promise<any> => hub.start(),
    'process-tx': (args: string[]): Promise<void> => hub.processTx(args[0]),
  }

  const cmd = process.argv[2] || 'hub'
  const handler = subcommands[cmd]
  if (!handler) {
    log.error(`Unknown subcommand: ${cmd}`)
    log.error(`Known subcommands: ${Object.keys(subcommands).join(', ')}`)
    return
  }

  await handler(process.argv.slice(3))
}

run().then(
  () => process.exit(0),
  (err: Error) => {
    log.error(err.message)
    process.exit(1)
  },
)
