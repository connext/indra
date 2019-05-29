import { Registry } from './Container'
import { toWei } from './util'
import camelize from './util/camelize'

// required / expected environment variables
// only variables in this array will be camelized
const ENV_VARS = [
  'ADMIN_ADDRESSES',
  'BEI_MIN_COLLATERALIZATION',
  'BEI_MAX_COLLATERALIZATION',
  'CHANNEL_BEI_DEPOSIT', // set in CI on prod
  'CHANNEL_BEI_LIMIT', // set in CI on prod
  'CHANNEL_MANAGER_ADDRESS',
  'DATABASE_URL', // set in *.entry.sh from CI
  'ETH_NETWORK_ID', // set in CI on prod
  'ETH_RPC_URL', // set in CI on prod
  'FORCE_SSL',
  'HOT_WALLET_ADDRESS', // set in deploy script
  'HOT_WALLET_MIN_BALANCE',
  'HUB_PUBLIC_URL',
  'HTTPS_PORT',
  'HUB_PUBLIC_URL', // TODO: update after mailgun removed
  'MAILGUN_API_KEY', // set in CI on prod, TODO: remove
  'PORT',
  'PRIVATE_KEY_FILE', // set in deploy script
  'RECENT_PAYMENTS_INTERVAL',
  'REDIS_URL', // set in deploy script
  'SERVICE_KEY', // set in CI on prod
  'SHOULD_COLLATERALIZE_URL',
  'STALE_CHANNEL_DAYS',
  'TOKEN_CONTRACT_ADDRESS' // set in deploy script
]

// TODO: chainsaw polling interval? -- set in docker
// but dont see where its used

const env = process.env.NODE_ENV || 'development'
function envswitch(vals: any) {
  let res = vals[env]
  if (res === undefined)
    throw new Error(`No valid specified for env '${env}' in ${JSON.stringify(vals)}`)
  return res
}

export interface BrandingConfig {
  title?: string
  companyName?: string
  backgroundColor?: string
  textColor?: string
}

export class Config {
  static fromEnv(overrides?: Partial<Config>): Config {
    const instance = new Config()

    // prettier-ignore
    ENV_VARS.forEach((v: string) => {
      const val: any = process.env[v]
      if (val !== undefined)
        (instance as any)[camelize(v, '_')] = v.endsWith('ADDRESS') ? val.toLowerCase() : val
    })

    for (let key in (overrides || {}))
      instance[key] = overrides[key]

    // transform any wei or bei values to BigNumbers, specifically
    // looking for: channelBeiLimit, channelBeiDeposit, beiMinCollateralization,
    // beiMaxCollateralization
    for (let key in instance) {
      if (key.toLowerCase().includes('bei') || key.toLowerCase().includes('wei')) {
        instance[key] = toWei(instance[key])
      }
    }

    return instance
  }

  // public recipientAddress: string = ''
  // TODO: remove branding api service
  
  
  ////////////////////////////////////////
  // HUB GENERAL CONFIG

  // ETH CONFIG //

  // private key file, should be txt file
  public privateKeyFile: string = ''
  // contract address of onchain assigned token address
  public tokenContractAddress: string = ''
  // eth address of hub's wallet (has to deploy contract)
  public hotWalletAddress: string = ''
  // used in `WithdrawalsService`, will not withdraw if balance of
  // hot wallet will go below this threshold
  public hotWalletMinBalance: string = toWei('7').toString()
  // contract address of cm
  public channelManagerAddress: string = ''
  // node/provider URL for instantiating web3/ethers
  public ethRpcUrl: string = ''
  
  // returned from the config endpoint only
  // TODO: keep this? client will use it on start
  public ethNetworkId: string = ''

  // WEB CONFIG //

  // used in `PaymentHub` optionally to create
  // a new service registry
  public registry?: Registry
  // url in format 'postgresql://...' for db
  // injected to docker as "POSTGRES_URL"
  public databaseUrl: string = ''
  // url for redis when calling `createHandyClient` in `RedisClient`.ts
  public redisUrl: string = ''
  // admin users, not practically used atm so default to hub only reqs
  public adminAddresses: string[] = process.env.HOT_WALLET_ADDRESS 
    ? [ process.env.HOT_WALLET_ADDRESS.toLowerCase() ]
    : []
  // service key, used in `AuthMiddleware`
  public serviceKey: string = 'foo' // delivered from env
  // default port of hub
  public port: number = 8080
  // used in ApiServer.ts if forceSsl is true
  public httpsPort: number = 8443
  // used in ApiServer.ts
  public forceSsl: boolean | false = process.env.FORCE_SSL && process.env.FORCE_SSL.toLowerCase() === 'true'

  // NODE ENV CONFIG
  public isProduction = env == 'production'
  public isStage = env == 'staging'
  public isDev = env == 'development'


  ////////////////////////////////////////
  // HUB COLLATERAL CONFIG


  // amount users can have in any one channel for their balance
  // used in ChannelsService as exchange rate ceiling
  public channelBeiLimit = toWei(70)
  // minimum amount of bei the hub will put in as collateral
  // used in CloseChannelService, ChannelsService
  public beiMinCollateralization = toWei(10)
  // max bei the hub will collateralize at any point
  // for receiving payments used in ChannelsService
  public beiMaxCollateralization = toWei(170)
  // used as sliding window to calculate collateral based on
  // recent payments
  // used in ChannelsService.ts
  public recentPaymentsInterval  = '10 minutes'
  // ceiling of what hub will deposit for exchange alongside
  // user deposit
  public channelBeiDeposit = toWei(1000)
  
  // URL used to check whether a user should receive collateral.
  // Called by ChannelsService.shouldCollateralize:
  //
  //   GET `${shouldCollateralizeUrl}/${user}`
  //
  // And is expected to return:
  //
  //   { shouldCollateralize: true | false }
  //
  // If the value is 'NO_CHECK' then no check will be performed.
  public shouldCollateralizeUrl: string | 'NO_CHECK' = 'NO_CHECK'

  // DISPUTE CONFIG
  // number of days without activity until channel is 
  // considered "stale". used in autodispute
  // being hardcoded in main.ts
  public staleChannelDays?: number = process.env.STALE_CHANNEL_DAYS ? parseInt(process.env.STALE_CHANNEL_DAYS) : null // if null, will not dispute

  ////////////////////////////////////////
  // HUB API AND SERVICE KEYS
  // mailgun, used in email endpoint
  public mailgunApiKey = ""

  // used in: coin payments service, mailgun email endpoint
  public hubPublicUrl = envswitch({
    development: null, // will be generated by NgrokService
    staging: 'https://staging.hub.connext.network',
    production: 'https://hub.connext.network',
  })
}

export default Config
