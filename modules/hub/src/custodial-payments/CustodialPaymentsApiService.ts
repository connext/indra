import { safeJson } from '../util'
import { CustodialPaymentsService } from './CustodialPaymentsService'
import { CustodialPaymentsDao } from './CustodialPaymentsDao'
import { Request, Response } from 'express'
import log from '../util/log'
import Config from '../Config'
import { ApiService } from '../api/ApiService'
import { getUserFromRequest } from '../util/request'
import { BigNumber } from 'ethers/utils'
import { big, types } from '../Connext'

const { convertCustodialBalanceRow, convertCustodialWithdrawalRow } = types

const LOG = log('CustodialPaymentsApiService')

function getAttr<T, K extends keyof T>(obj: T, attr: K): T[K] {
  if (!(attr in obj))
    throw new Error(`Key "${attr}" not contained in ${safeJson(obj)}`)
  return obj[attr]
}

getAttr.address = getAttr // TODO: some basic address validation here
getAttr.big = <T, K extends keyof T>(obj: T, attr: K): BigNumber => {
  const val = getAttr(obj, attr)
  try {
    return big.Big(val as any)
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
    res.json(convertCustodialBalanceRow("str", 
      await this.dao.getCustodialBalance(getUserFromRequest(req))
    ))
  }

  async doCreateWithdraw(req: Request, res: Response) {
    res.json(convertCustodialWithdrawalRow("str",
      await this.service.createCustodialWithdrawal({
        user: getAttr.address(req.session!, 'address'),
        recipient: getAttr.address(req.body, 'recipient'),
        amountToken: getAttr.big(req.body, 'amountToken'),
      })
    ))
  }

  async doGetWithdrawals(req: Request, res: Response) {
    const rows = await this.dao.getCustodialWithdrawals(getUserFromRequest(req))
    res.json(rows.map(r => convertCustodialWithdrawalRow("str", r)))
  }

  async doGetWithdrawal(req: Request, res: Response) {
    res.json(convertCustodialWithdrawalRow("str", 
      await this.dao.getCustodialWithdrawal(
        getAttr.address(req.session!, 'address'),
        getAttr(req.params, 'withdrawalId'),
      ))
    )
  }
}
