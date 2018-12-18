import camelize from './util/camelize'
import { Registry } from './Container'

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
  'SERVICE_USER_KEY',
  'TOKEN_CONTRACT_ADDRESS',
]

export interface BrandingConfig {
  title?: string
  companyName?: string
  backgroundColor?: string
  textColor?: string
}

export default class Config {
  static fromEnv(): Config {
    const instance = new Config()

    // prettier-ignore
    ENV_VARS.forEach((v: string) => {
      const val: any = process.env[v]
      if (v !== undefined)
        (instance as any)[camelize(v, '_')] = val
    })

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
  public serviceUserKey?: string
  public port: number = 8080
  public recipientAddress: string = ''
  public hotWalletAddress: string = ''
  public hotWalletMinBalanceEth: string = '6.9'
  public sessionSecret: string = ''
  public staleChannelDays: number = 7
  public registry?: Registry
  public branding: BrandingConfig
  public tokenContractAddress: string = ''
}
