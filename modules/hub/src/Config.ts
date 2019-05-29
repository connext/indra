import { Registry } from './Container'
import { BN, toBN, toWei } from './util'
import camelize from './util/camelize'

// required / expected environment variables
// only variables in this array will be camelized
const ENV_VARS = [
  'AUTH_DOMAIN_WHITELIST',
  'AUTH_REALM',
  'CARD_IMAGE_URL',
  'CARD_NAME',
  'CHANNEL_MANAGER_ADDRESS',
  'COINPAYMENTS_API_KEY',
  'COINPAYMENTS_API_SECRET',
  'COINPAYMENTS_IPN_SECRET',
  'COINPAYMENTS_MERCHANT_ID',
  'DATABASE_URL',
  'ETH_NETWORK_ID',
  'ETH_RPC_URL',
  'FORCE_SSL',
  'HOT_WALLET_ADDRESS',
  'HTTPS_PORT',
  'HUB_PUBLIC_URL',
  'MIN_SETTLEMENT_PERIOD',
  'PORT',
  'PRIVATE_KEY_FILE',
  'REALTIME_DB_SECRET',
  'RECIPIENT_WHITELIST',
  'REDIS_URL',
  'SERVICE_USER_KEY',
  'SESSION_SECRET',
  'SHOULD_COLLATERALIZE_URL',
  'TOKEN_CONTRACT_ADDRESS'
]

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

    return instance
  }

  // used in `BrandingApiServiceHandler` of the BrandingApiService
  // address where this is the hubs wdal address. This value is
  // set to `process.env.WALLET_ADDRESS!` in `main.ts`
  // process.env.WALLET_ADDRESS does not exist
  // TODO: remove or fix, that's a silly assignment
  public recipientAddress: string = ''
  
  
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
  // TODO: not in ENV_VARS
  public hotWalletMinBalance: string = toWei('6.9').toString()
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
  // TODO: not in env_vars, remove?
  public registry?: Registry
  // used in `BrandingApiService`, hardcoded in main
  // TODO: not in env_vars, remove?
  public branding: BrandingConfig
  // url in format 'postgresql://...' for db
  public databaseUrl: string = ''
  // url for redis when calling `createHandyClient` in `RedisClient`.ts
  // TODO: is this set anywhere?
  public redisUrl: string = ''
  // hardcoded in main as SpankChain
  // TODO: remove?
  public authRealm: string = ''
  // auth whitelist, being hardcoded in main.ts as []
  // TODO: remove?
  public authDomainWhitelist: string[] = []
  // hardcoded in main.ts
  // as a null env var (should be hub addr?)
  // TODO: not in env_vars, being used in auth middleware, remove?
  public adminAddresses?: string[] = []
  // service key, used in `AuthMiddleware`
  // TODO: not in env_vars, instead refd as `SERVICE_USER_KEY`
  public serviceKey: string = 'omqGMZzn90vFJskXFxzuO3gYHM6M989spw99f3ngRSiNSOUdB0PmmYTvZMByUKD'
  // being hardcoded in main.ts
  public port: number = 8080
  // used in ApiServer.ts if forceSsl is true
  // TODO: not in env_vars
  public httpsPort: number = 8443
  // used in ApiServer.ts
  // TODO: not in env_vars
  public forceSsl: boolean | false = process.env.FORCE_SSL && process.env.FORCE_SSL.toLowerCase() === 'true'

  // NODE ENV CONFIG
  public isProduction = env == 'production'
  public isStage = env == 'staging'
  public isDev = env == 'development'



  ////////////////////////////////////////
  // HUB COLLATERAL CONFIG


  // amount users can have in any one channel for their balance
  // used in ChannelsService as exchange rate ceiling
  // TODO: not in env_vars
  public channelBeiLimit = toWei(process.env.CHANNEL_BEI_LIMIT || 69)
  // minimum amount of bei the hub will put in as collateral
  // used in CloseChannelService, ChannelsService
  // TODO: not in env_vars
  public beiMinCollateralization = toWei(process.env.BEI_MIN_COLLATERALIZATION || 10)

  // max bei the hub will collateralize at any point
  // for receiving payments used in ChannelsService
  // TODO: not in env_vars
  public beiMaxCollateralization = toWei(process.env.BEI_MAX_COLLATERALIZATION || 169)
  // used as sliding window to calculate collateral based on
  // recent payments
  // used in ChannelsService.ts
  // TODO: not in env_vars
  public recentPaymentsInterval  = (process.env.RECENT_PAYMENTS_INTERVAL || '10 minutes')
  // max value going to any one thread
  // TODO: not in env_vars, lines referencing are commented
  // out, remove?
  public threadBeiLimit = toWei(process.env.THREAD_BEI_LIMIT || 10)
  // ceiling of what hub will deposit for exchange alongside
  // user deposit
  // TODO: not in env_vars, lower to channelBeiLimit?
  public channelBeiDeposit = toWei(process.env.CHANNEL_BEI_DEPOSIT || 1000)
  
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
  // TODO: not in env_vars, also no autodisputes, remove?
  public staleChannelDays?: number = process.env.STALE_CHANNEL_DAYS ? parseInt(process.env.STALE_CHANNEL_DAYS) : null // if null, will not dispute

  ////////////////////////////////////////
  // HUB API AND SERVICE KEYS
  // being hardcoded in main.ts, not used anywhere
  // TODO: remove?
  public sessionSecret: string = ''
  // mailgun, used in email endpoint
  public mailgunApiKey = process.env.MAILGUN_API_KEY || ""

  // used in: coin payments service, mailgun email endpoint
  // TODO: remove? is this being used anywhere else?
  public hubPublicUrl = envswitch({
    development: null, // will be generated by NgrokService
    staging: 'https://staging.hub.connext.network',
    production: 'https://hub.connext.network',
  })

  ////////////////////////////////////////
  // used in: coinpayments service
  public coinpaymentsMerchantId = envswitch({
    development: '898d6ead05235f6081e97a58a6699289',
    staging: '898d6ead05235f6081e97a58a6699289',
    production: 'set by environment variable',
  })

  public coinpaymentsApiKey = envswitch({
    development: '62eceb03e8fcb4f8ebdc1b8f43e1e6f4b9b120f0856061d228cf04b01ed5cf08',
    staging: '62eceb03e8fcb4f8ebdc1b8f43e1e6f4b9b120f0856061d228cf04b01ed5cf08',
    production: 'set by environment variable',
  })

  public coinpaymentsApiSecret = envswitch({
    development: 'A78Dba053693985Fa8F9aad010352caa61a6e2ECb7E20E87AcfABc7ee37C3005',
    staging: 'A78Dba053693985Fa8F9aad010352caa61a6e2ECb7E20E87AcfABc7ee37C3005',
    production: 'set by environment variable',
  })

  public coinpaymentsIpnSecret = envswitch({
    development: 'U1BC9v1s3l0zxdH3',
    staging: 'U1BC9v1s3l0zxdH3',
    production: 'set by environment variable',
  })
}

export default Config
