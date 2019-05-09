import { log } from "util";
import { types, big } from 'connext';
import DBEngine, { SQL } from "../DBEngine";
import { Client } from 'pg'
import Config from '../Config'
const { Big, } = big
const { convertPaymentProfile } = types

type Address = types.Address
type PaymentProfileConfigBN = types.PaymentProfileConfigBN
type ChannelRowBN = types.ChannelRowBN

export default interface PaymentProfilesDao {
  getPaymentProfileConfigById(profileId: number): Promise<PaymentProfileConfigBN>
  getPaymentProfileConfigByUser(user: Address): Promise<PaymentProfileConfigBN>
  createPaymentProfile(config: PaymentProfileConfigBN): Promise<PaymentProfileConfigBN>
  addPaymentProfileByUser(key: number, address: Address): Promise<ChannelRowBN>
  addPaymentProfileByUsers(key: number, addresses: Address[]): Promise<Address[]>
}

export class PostgresPaymentProfilesDao implements PaymentProfilesDao {
  private db: DBEngine<Client>
  private config: Config
  
  constructor(db: DBEngine<Client>, config: Config) {
    this.db = db
    this.config = config
  }

  async getPaymentProfileConfigById(profileId: number): Promise<PaymentProfileConfigBN> {
    return null
  }

  async getPaymentProfileConfigByUser(user: Address): Promise<PaymentProfileConfigBN> {
    return null
  }

  async createPaymentProfile(c: PaymentProfileConfigBN): Promise<PaymentProfileConfigBN> {
    const config = convertPaymentProfile("str", c)
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

  async addPaymentProfileByUser(key: number, address: Address): Promise<ChannelRowBN> {
    return null
  }

  async addPaymentProfileByUsers(key: number, addresses: Address[]): Promise<Address[]> {
    return null
  }

  private inflatePaymentProfileConfigRow(row: any): PaymentProfileConfigBN {
    return (
      row && {
        id: Number(row.id),

        minimumMaintainedCollateralWei: 
          Big(row.minimum_maintained_collateral_wei), 

        minimumMaintainedCollateralToken: 
          Big(row.minimum_maintained_collateral_token), 

        amountToCollateralizeWei: Big(row.amount_to_collateralize_wei),

        amountToCollateralizeToken: Big(row.amount_to_collateralize_token),
      }
    )
  }
}