import * as express from 'express'
import { BigNumber } from 'bignumber.js'
import { TipDto } from './domain/Tip'
import { PaymentMetaDao } from './dao/PaymentMetaDao'
import VirtualChannelsDao from './dao/VirtualChannelsDao'
import LedgerChannelsDao from './dao/LedgerChannelsDao'
import ChainsawLcDao from './dao/ChainsawLcDao'

export interface PaymentHandler<T, U> {
  /*
  fetchHistory(address?: string): Promise<U[]>

  fetchPayment(token: string): Promise<U>

  fetchPaymentByType(paymentType: PaymentType, id: number): Promise<PaymentInfo | null>

  fetchPurchase(id: string): Promise<{ id: string, payments: U[] }>
  */
}

export class DefaultPaymentHandler implements PaymentHandler<any, any> {
  private paymentMetaDao: PaymentMetaDao
  private virtualChannelsDao: VirtualChannelsDao
  private ledgerChannelsDao: LedgerChannelsDao
  private chainsawLcDao: ChainsawLcDao

  constructor(
    paymentMetaDao: PaymentMetaDao,
    virtualChannelsDao: VirtualChannelsDao,
    ledgerChannelsDao: LedgerChannelsDao,
    chainsawLcDao: ChainsawLcDao,
  ) {
    this.paymentMetaDao = paymentMetaDao
    this.virtualChannelsDao = virtualChannelsDao
    this.ledgerChannelsDao = ledgerChannelsDao
    this.chainsawLcDao = chainsawLcDao
  }

  /*
  public async fetchPaymentByType(
    paymentType: PaymentType,
    id: number,
  ): Promise<PaymentInfo | null> {
    let update, channel, info
    if (paymentType === PaymentType.Ledger) {
      update = await this.ledgerChannelsDao.getStateUpdateById(id)
      if (!update) {
        return null
      }
      channel = await this.chainsawLcDao.ledgerChannelById(update.channelId)
      if (!channel) {
        return null
      }
      info = {
        id: update.id,
        priceWei: update.priceWei,
        priceToken: update.priceToken,
        sender: channel.partyA,
        receiver: channel.partyI,
      }
    } else if (paymentType === PaymentType.Virtual) {
      update = await this.virtualChannelsDao.getUpdateById(id)
      if (!update) {
        return null
      }
      channel = await this.virtualChannelsDao.channelById(update.channelId)
      if (!channel) {
        return null
      }
      info = {
        id: update.id,
        priceWei: update.priceWei,
        priceToken: update.priceToken,
        sender: channel.partyA,
        receiver: channel.partyB,
      }
    } else {
      throw new Error('Invalid payment type.')
    }
    return info
  }

  fetchHistory(address?: string): Promise<PaymentMeta[]> {
    return address
      ? this.paymentMetaDao.allAffectingAddress(address)
      : this.paymentMetaDao.all()
  }

  fetchPayment(token: string): Promise<PaymentMeta> {
    return this.paymentMetaDao.byToken(token)
  }

  async fetchPurchase(id: string): Promise<{ id: string, payments: PaymentMeta[] }> {
    return {
      id: id,
      payments: await this.paymentMetaDao.byPurchase(id),
    }
  }
  */
}
