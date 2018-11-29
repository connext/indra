import Config from './Config'
import log from './util/log'
import { Container } from './Container'
import defaultRegistry from './services'
import { ApiService } from './api/ApiService'
import ExchangeRateService from './ExchangeRateService'
import GasEstimateService from './GasEstimateService'
import DepositCorrelateService from './DepositCorrelateService'
import { ApiServer } from "./ApiServer"
import ChainsawService from './ChainsawService'
import { OnchainTransactionService } from "./OnchainTransactionService";
const Web3 = require('web3')

const tokenAbi = require('human-standard-token-abi')

const LOG = log('PaymentHub')

export default class PaymentHub {
  private config: Config

  public container: Container

  private exchangeRateService: ExchangeRateService
  private gasEstimateService: GasEstimateService
  private apiServer: ApiServer
  private onchainTransactionService: OnchainTransactionService

  constructor(config: Config) {
    if (!config.ethRpcUrl) {
      throw new Error('ERROR: ETH_RPC_URL not set!')
    }

    const registry = defaultRegistry(config.registry)
    const web3New = new Web3(new Web3.providers.HttpProvider(config.ethRpcUrl))
    registry.bind('Config', () => config)
    registry.bind('Web3', () => web3New)

    this.config = config
    this.container = new Container(registry)
    registry.bind('Container', () => this.container)

    this.exchangeRateService = this.container.resolve('ExchangeRateService')
    this.gasEstimateService = this.container.resolve('GasEstimateService')
    this.apiServer = this.container.resolve('ApiServer')
    this.onchainTransactionService = this.container.resolve('OnchainTransactionService')
  }

  public async start() {
    for (let service of ['exchangeRateService', 'gasEstimateService', 'apiServer', 'onchainTransactionService']) {
      try {
        await (this as any)[service].start()
      } catch (err) {
        LOG.error('Failed to start {service}: {err}', { service, err })
        process.exit(1)
      }
    }
  }

  public async startChainsaw() {
    // const chainsaw = this.container.resolve<ChainsawService>('ChainsawService')
    // chainsaw.poll()
    const chainsaw = this.container.resolve<ChainsawService>(
      'ChainsawService',
    )
    chainsaw.poll()
  }

  public async startDepositCorrelate() {
    const depositCorrelate = this.container.resolve<DepositCorrelateService>(
      'DepositCorrelateService',
    )
    await depositCorrelate.correlateDeposits()
    process.exit(0)
  }
}
