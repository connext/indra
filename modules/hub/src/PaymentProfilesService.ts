import * as connext from 'connext'
import { Address, Omit, PaymentProfileConfig } from 'connext/types'

import PaymentProfilesDao from './dao/PaymentProfilesDao'
import DBEngine from './DBEngine'
import { prettySafeJson, toBN } from './util'
import log from './util/log'

const LOG = log('PaymentProfilesService')

export default class PaymentProfilesService {

  constructor(
    private paymentProfilesDao: PaymentProfilesDao,
    private db: DBEngine,
  ) {}

  public async doCreatePaymentProfile(config: Omit<PaymentProfileConfig, "id">): Promise<PaymentProfileConfig> {
    const {
      minimumMaintainedCollateralWei, 
      minimumMaintainedCollateralToken, 
      amountToCollateralizeWei, 
      amountToCollateralizeToken
    } = config
    // TODO: implement collateralization in wei
    if (
      minimumMaintainedCollateralWei && !toBN(minimumMaintainedCollateralWei).isZero() ||
      amountToCollateralizeWei && !toBN(amountToCollateralizeWei).isZero()
    ) {
      throw new Error(`Cannot support wei collateral requests at this time. Requested config: ${prettySafeJson(config)}`)
    }

    // check that the profile configurations requested are not negative
    if (
      toBN(amountToCollateralizeToken).lte(0) || 
      toBN(minimumMaintainedCollateralToken).lte(0)
    ) {
      throw new Error(`Negative or zero value collateralization parameters requested. Requested config: ${prettySafeJson(config)}`)
    }

    // no other checks performed, insert the payment profile
    const profile = await this.db.withTransaction(() =>
      this.paymentProfilesDao.createPaymentProfile(
        config
      )
    )

    if (!profile) {
      return null
    }

    return connext.convert.PaymentProfile("str", profile)
  }

  // NOTE: will fail if channel does not exist
  public async doAddProfileKey(key: number, addresses: Address[]) {
    await this.db.withTransaction(async () => {
      if (addresses.length == 1) {
        await this.paymentProfilesDao.addPaymentProfileByUser(key, addresses[0])
        return
      }

      await this.paymentProfilesDao.addPaymentProfileByUsers(key, addresses)
    })
  }

  public async doGetPaymentProfileById(id: number): Promise<PaymentProfileConfig> {
    const profile = await this.paymentProfilesDao.getPaymentProfileConfigById(id)
    if (!profile) {
      return null
    }

    return connext.convert.PaymentProfile("str", profile)
  }

  public async doGetPaymentProfileByUser(user: string): Promise<PaymentProfileConfig> {
    const profile = await this.paymentProfilesDao.getPaymentProfileConfigByUser(user)
    if (!profile) {
      return null
    }
    return connext.convert.PaymentProfile("str", profile)
  }
}
