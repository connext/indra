import camelize from './util/camelize'
import { Registry } from './Container'
import { BigNumber } from 'bignumber.js'
import { toWeiBigNum } from './util/bigNumber';

const ENV_VARS = [
  'ETH_RPC_URL',
  'DATABASE_URL',
  'CHANNEL_MANAGER_ADDRESS',
  'AUTH_REALM',
  'AUTH_DOMAIN_WHITELIST',
  'PORT',
  'MIN_SETTLEMENT_PERIOD',
  'RECIPIENT_WHITELIST',
  'SESSION_SECRET',
  'CARD_NAME',
  'CARD_IMAGE_URL',
  'REALTIME_DB_SECRET',
  'SERVICE_USER_KEY',
  'REDIS_URL',
  'TOKEN_CONTRACT_ADDRESS',
  'HOT_WALLET_ADDRESS',
]

export interface BrandingConfig {
  title?: string
  companyName?: string
  backgroundColor?: string
  textColor?: string
}

export default class Config {
  static fromEnv(overrides?: Partial<Config>): Config {
    const instance = new Config()

    // prettier-ignore
    ENV_VARS.forEach((v: string) => {
      const val: any = process.env[v]
      if (v !== undefined)
        (instance as any)[camelize(v, '_')] = val
    })

    for (let key in (overrides || {}))
      instance[key] = overrides[key]

    return instance
  }

  public isProduction = process.env.NODE_ENV == 'production'
  public isDev = process.env.NODE_ENV != 'production'
  public ethRpcUrl: string = ''
  public databaseUrl: string = ''
  public redisUrl: string = ''
  public channelManagerAddress: string = ''
  public authRealm: string = ''
  public authDomainWhitelist: string[] = []
  public adminAddresses?: string[] = []
  public serviceUserKey: string = 'omqGMZzn90vFJskXFxzuO3gYHM6M989spw99f3ngRSiNSOUdB0PmmYTvZMByUKD'
  public port: number = 8080
  public recipientAddress: string = ''
  public hotWalletAddress: string = ''
  public hotWalletMinBalanceEth: string = '6.9'
  public sessionSecret: string = ''
  public staleChannelDays: number = 7
  public registry?: Registry
  public branding: BrandingConfig
  public tokenContractAddress: string = ''
  public channelBeiLimit = toWeiBigNum(process.env.CHANNEL_BEI_LIMIT || 69)
  public beiMinThreshold = toWeiBigNum(process.env.BEI_MIN_THRESHOLD || 20)
  public beiMinCollateralization = toWeiBigNum(process.env.BEI_MIN_COLLATERALIZATION || 50)
  public beiMaxCollateralization = toWeiBigNum(process.env.BEI_MAX_COLLATERALIZATION || 169)
  public threadBeiLimit = toWeiBigNum(process.env.THREAD_BEI_LIMIT || 10)
  public channelBeiDeposit = this.channelBeiLimit.plus(1069)
}
