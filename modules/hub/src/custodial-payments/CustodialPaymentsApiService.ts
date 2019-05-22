import * as connext from 'connext'
import { Request, Response } from 'express'

import { ApiService } from '../api/ApiService'
import Config from '../Config'
import { BN, safeJson, toBN } from '../util'
import log, { logApiRequestError } from '../util/log'
import { getUserFromRequest } from '../util/request'

import { CustodialPaymentsDao } from './CustodialPaymentsDao'
import { CustodialPaymentsService } from './CustodialPaymentsService'

const LOG = log('CustodialPaymentsApiService')

function getAttr<T, K extends keyof T>(obj: T, attr: K): T[K] {
  if (!(attr in obj))
    throw new Error(`Key "${attr}" not contained in ${safeJson(obj)}`)
  return obj[attr]
}

getAttr.address = getAttr // TODO: some basic address validation here
getAttr.big = <T, K extends keyof T>(obj: T, attr: K): BN => {
  const val = getAttr(obj, attr)
  try {
    return toBN(val as any)
  } catch (e) {
    throw new Error(`Invalid value for BigNumber: ${val} (attribute: ${attr})`)
  }
}

export class CustodialPaymentsApiService extends ApiService<CustodialPaymentsApiServiceHandler> {
  namespace = 'custodial'
  routes = {
    'POST /withdrawals': 'doCreateWithdraw',
    'GET /withdrawals/:withdrawalId': 'doGetWithdrawal',
    'GET /:user/withdrawals': 'doGetWithdrawals',
    'GET /:user/balance': 'doGetBalance',
    'POST /:user/balance': 'doGetBalance',
  }
  handler = CustodialPaymentsApiServiceHandler
  dependencies = {
    'config': 'Config',
    'dao': 'CustodialPaymentsDao',
    'service': 'CustodialPaymentsService',
  }
}


class CustodialPaymentsApiServiceHandler {
  config: Config
  dao: CustodialPaymentsDao
  service: CustodialPaymentsService

  async doGetBalance(req: Request, res: Response) {
    return res.json(connext.convert.CustodialBalanceRow("str", 
      await this.dao.getCustodialBalance(getUserFromRequest(req))
    ))
  }

  async doCreateWithdraw(req: Request, res: Response) {
    let withdrawal, user, recipient, amountToken
    try {
      user = getAttr.address(req.session!, 'address')
      recipient = getAttr.address(req.body, 'recipient')
      amountToken = getAttr.big(req.body, 'amountToken')
    } catch (e) {
      // send error response, invalid params
      logApiRequestError(LOG, req)
      return res.sendStatus(400)
    }


    try {
      withdrawal = await this.service.createCustodialWithdrawal({
        user,
        recipient,
        amountToken,
      })
    } catch (e) {
      LOG.error(`Error creating custodial withdrawal: {e}`, { e })
      return res.sendStatus(400)
    }
    

    return res.json(connext.convert.CustodialWithdrawalRow("str",
      withdrawal
    ))
  }

  async doGetWithdrawals(req: Request, res: Response) {
    const rows = await this.dao.getCustodialWithdrawals(getUserFromRequest(req))
    return res.json(rows.map(r => connext.convert.CustodialWithdrawalRow("str", r)))
  }

  async doGetWithdrawal(req: Request, res: Response) {
    return res.json(connext.convert.CustodialWithdrawalRow("str", 
      await this.dao.getCustodialWithdrawal(
        getAttr.address(req.session!, 'address'),
        getAttr(req.params, 'withdrawalId'),
      ))
    )
  }
}
