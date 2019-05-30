import { Address, PaymentProfileConfig, PaymentProfileConfigBN } from 'connext/types'
import { Client } from 'pg'

import Config from '../Config'
import DBEngine, { SQL } from '../DBEngine'
import { Logger, toBN } from '../util'

export default interface PaymentProfilesDao {
  getPaymentProfileConfigById(profileId: number): Promise<PaymentProfileConfigBN>
  getPaymentProfileConfigByUser(user: Address): Promise<PaymentProfileConfigBN>
  createPaymentProfile(config: PaymentProfileConfig): Promise<PaymentProfileConfigBN>
  addPaymentProfileByUser(key: number, address: Address): Promise<void>
  addPaymentProfileByUsers(key: number, addresses: Address[]): Promise<void>
}

export class PostgresPaymentProfilesDao implements PaymentProfilesDao {
  private db: DBEngine<Client>
  private config: Config
  private log: Logger

  public constructor(db: DBEngine<Client>, config: Config) {
    this.db = db
    this.config = config
    this.log = new Logger('PaymentProfilesDao', config.logLevel)
  }

  public async getPaymentProfileConfigById(profileId: number): Promise<PaymentProfileConfigBN> {
    return this.inflatePaymentProfileConfigRow(
      await this.db.queryOne(SQL`
        SELECT *
        FROM payment_profiles
        WHERE "id" = ${profileId}
        ;
      `))
  }

  public async getPaymentProfileConfigByUser(user: Address): Promise<PaymentProfileConfigBN> {
    return this.inflatePaymentProfileConfigRow(
      await this.db.queryOne(SQL`
        SELECT *
        FROM payment_profiles
        WHERE id = (
          SELECT "payment_profile_id"
          FROM _cm_channels
          WHERE
            "user" = ${user.toLowerCase()} AND
            "contract" = ${this.config.channelManagerAddress.toLowerCase()}
        );
      `))
  }

  public async createPaymentProfile(config: PaymentProfileConfig): Promise<PaymentProfileConfigBN> {
    const row = await this.db.queryOne(SQL`
      INSERT INTO payment_profiles (
        minimum_maintained_collateral_wei,
        minimum_maintained_collateral_token,
        amount_to_collateralize_wei,
        amount_to_collateralize_token
      )
      VALUES (
        ${config.minimumMaintainedCollateralWei || '0'},
        ${config.minimumMaintainedCollateralToken || '0'},
        ${config.amountToCollateralizeWei || '0'},
        ${config.amountToCollateralizeToken || '0'}
      )
      RETURNING *;
    `)
    return this.inflatePaymentProfileConfigRow(row)
  }

  public async addPaymentProfileByUser(key: number, address: Address): Promise<void> {
    const res = await this.db.queryOne(SQL`
      UPDATE _cm_channels
      SET "payment_profile_id" = ${key}
      WHERE
        "user" = ${address.toLowerCase()} AND
        "contract" = ${this.config.channelManagerAddress.toLowerCase()}
      RETURNING id;
    `)
    this.log.info(`Created profile for ${address}. Result: ${JSON.stringify(res)}`)
    return res
  }

  public async addPaymentProfileByUsers(key: number, addresses: Address[]): Promise<any> {
    const promises = addresses.map((a: string): Promise<any> =>
      this.addPaymentProfileByUser(key, a))
    return Promise.all(promises)
  }

  private inflatePaymentProfileConfigRow(row: any): PaymentProfileConfigBN {
    return (
      row && {
        id: Number(row.id),

        minimumMaintainedCollateralWei:
          toBN(row.minimum_maintained_collateral_wei),

        minimumMaintainedCollateralToken:
          toBN(row.minimum_maintained_collateral_token),

        amountToCollateralizeWei: toBN(row.amount_to_collateralize_wei),

        amountToCollateralizeToken: toBN(row.amount_to_collateralize_token),
      }
    )
  }
}
