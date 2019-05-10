import { StateGenerator, Utils, Validator } from 'connext';
import { CustodialPaymentsService } from './custodial-payments/CustodialPaymentsService'
import { CustodialPaymentsApiService } from './custodial-payments/CustodialPaymentsApiService'
import { CoinPaymentsDao } from './coinpayments/CoinPaymentsDao'
import { CoinPaymentsService } from './coinpayments/CoinPaymentsService'
import {
  Registry,
  PartialServiceDefinitions,
  Context,
  Container,
} from './Container'
import { ChannelManager } from './contract/ChannelManager'
import AuthApiService from './api/AuthApiService'
import { MemoryCRAuthManager } from './CRAuthManager'
import Config from './Config'
import BrandingApiService from './api/BrandingApiService'
import {
  default as DBEngine,
  PostgresDBEngine,
  PgPoolService,
} from './DBEngine'
import PaymentsApiService from './api/PaymentsApiService'
import ExchangeRateService from './ExchangeRateService'
import ExchangeRateDao, { PostgresExchangeRateDao } from './dao/ExchangeRateDao'
import { Client } from 'pg'
import PaymentsDao, { PostgresPaymentsDao } from './dao/PaymentsDao'
import { PostgresWithdrawalsDao } from './dao/WithdrawalsDao'
import GlobalSettingsDao, {
  PostgresGlobalSettingsDao
} from './dao/GlobalSettingsDao'
//import GlobalSettingsApiService from './api/GlobalSettingsApiService'
import ExchangeRateApiService from './api/ExchangeRateApiService'
import { default as ChannelsDao, PostgresChannelsDao } from './dao/ChannelsDao'
import { PaymentMetaDao, PostgresPaymentMetaDao } from './dao/PaymentMetaDao'
import { default as ChainsawDao, PostgresChainsawDao } from './dao/ChainsawDao'
import ChannelsService from './ChannelsService'
import ThreadsDao, { PostgresThreadsDao } from './dao/ThreadsDao'
import ChannelsApiService from './api/ChannelsApiService'
import ChainsawService from './ChainsawService'

import {
  PostgresDisbursementDao,
} from './dao/DisbursementsDao'
import { getRedisClient, RedisClient } from './RedisClient'
import {
  default as GasEstimateDao,
  PostgresGasEstimateDao,
} from './dao/GasEstimateDao'
import { default as GasEstimateService } from './GasEstimateService'
import { default as GasEstimateApiService } from './api/GasEstimateApiService'
import Web3 from 'web3'
import { PostgresFeatureFlagsDao } from './dao/FeatureFlagsDao'
import FeatureFlagsApiService from './api/FeatureFlagsApiService'
import { ApiServer } from './ApiServer'
import { DefaultAuthHandler } from './middleware/AuthHandler'
import ThreadsService from './ThreadsService'
import ThreadsApiService from './api/ThreadsApiService';
import { OnchainTransactionService } from "./OnchainTransactionService";
import { OnchainTransactionsDao } from "./dao/OnchainTransactionsDao";
import { SignerService } from './SignerService';
import PaymentsService from './PaymentsService';
import { NgrokService } from './NgrokService'
import { CoinPaymentsApiClient } from './coinpayments/CoinPaymentsApiClient'
import { CoinPaymentsApiService } from './coinpayments/CoinPaymentsApiService'
import { default as ChannelManagerABI } from './abi/ChannelManager'
import { CloseChannelService } from './CloseChannelService'
import ChannelDisputesDao, { PostgresChannelDisputesDao } from './dao/ChannelDisputesDao';
import { CoinPaymentsDepositPollingService } from './coinpayments/CoinPaymentsDepositPollingService'
import ConfigApiService from './api/ConfigApiService';
import { CustodialPaymentsDao } from './custodial-payments/CustodialPaymentsDao'
import OptimisticPaymentDao, { PostgresOptimisticPaymentDao } from './dao/OptimisticPaymentDao';
import { OptimisticPaymentsService } from './OptimisticPaymentsService';
import PaymentProfilesApiService from './api/PaymentProfilesApiService';
import PaymentProfilesDao, { PostgresPaymentProfilesDao } from './dao/PaymentProfilesDao';
import PaymentProfilesService from './PaymentProfilesService';

export default function defaultRegistry(otherRegistry?: Registry): Registry {
  const registry = new Registry(otherRegistry)
  registry.bindDefinitions(serviceDefinitions)
  return registry
}

export const serviceDefinitions: PartialServiceDefinitions = {
  //
  // Singletons
  //

  PgPoolService: {
    factory: (config: Config) => new PgPoolService(config),
    dependencies: ['Config'],
    isSingleton: true,
  },

  GasEstimateService: {
    factory: (dao: GasEstimateDao) => new GasEstimateService(dao),
    dependencies: ['GasEstimateDao'],
    isSingleton: true,
  },

  ExchangeRateService: {
    factory: (dao: ExchangeRateDao) => new ExchangeRateService(dao),
    dependencies: ['ExchangeRateDao'],
    isSingleton: true,
  },

  ChainsawService: {
    factory: (
      signerService: SignerService,
      onchainTransactionService: OnchainTransactionService,
      chainsawDao: ChainsawDao,
      channelsDao: ChannelsDao,
      channelDisputesDao: ChannelDisputesDao,
      contract: ChannelManager,
      web3: Web3,
      utils: Utils,
      config: Config,
      db: DBEngine,
      validator: Validator,
      redis: RedisClient
    ) => new ChainsawService(signerService, onchainTransactionService, chainsawDao, channelsDao, channelDisputesDao, contract, web3, utils, config, db, validator, redis),
    dependencies: [
      'SignerService',
      'OnchainTransactionService',
      'ChainsawDao',
      'ChannelsDao',
      'ChannelDisputesDao',
      'ChannelManagerContract',
      'Web3',
      'ConnextUtils',
      'Config',
      'DBEngine',
      'Validator',
      'RedisClient'
    ],
    isSingleton: true,
  },

  CloseChannelService: {
    factory: (
      onchainTxService: OnchainTransactionService,
      signerService: SignerService,
      onchainTransactionDao: OnchainTransactionsDao,
      channelDisputesDao: ChannelDisputesDao,
      channelsDao: ChannelsDao,
      contract: ChannelManager,
      config: Config,
      web3: any,
      db: DBEngine,
    ) => new CloseChannelService(onchainTxService, signerService, onchainTransactionDao, channelDisputesDao, channelsDao, contract, config, web3, db),
    dependencies: [
      'OnchainTransactionService',
      'SignerService',
      'OnchainTransactionsDao',
      'ChannelDisputesDao',
      'ChannelsDao',
      'ChannelManagerContract',
      'Config',
      'Web3',
      'DBEngine'
    ],
    isSingleton: true,
  },

  ApiServer: {
    factory: (container: Container) => new ApiServer(container),
    dependencies: ['Container'],
    isSingleton: true,
  },

  ApiServerServices: {
    factory: () => [
      GasEstimateApiService,
      FeatureFlagsApiService,
      ChannelsApiService,
      BrandingApiService,
      AuthApiService,
      ConfigApiService,
      ExchangeRateApiService,
      ThreadsApiService,
      PaymentsApiService,
      CoinPaymentsApiService,
      CustodialPaymentsApiService,
      PaymentProfilesApiService,
    ],
    isSingleton: true,
  },

  OnchainTransactionService: {
    factory: (
      web3: any,
      gasEstimateDao: GasEstimateDao,
      onchainTransactionDao: OnchainTransactionsDao,
      db: DBEngine,
      signerService: SignerService,
      container: Container
    ) => new OnchainTransactionService(web3, gasEstimateDao, onchainTransactionDao, db, signerService, container),
    dependencies: [
      'Web3',
      'GasEstimateDao',
      'OnchainTransactionsDao',
      'DBEngine',
      'SignerService',
      'Container'
    ],
    isSingleton: true,
  },

  CRAuthManager: {
    factory: () => new MemoryCRAuthManager(),
    dependencies: [],
    isSingleton: true,
  },

  NgrokService: {
    factory: (config: Config) => new NgrokService(config),
    dependencies: ['Config'],
    isSingleton: true,
  },

  ChannelManagerContract: {
    factory: (
      web3: any,
      config: Config,
    ) => new web3.eth.Contract(
      ChannelManagerABI.abi,
      config.channelManagerAddress,
    ) as ChannelManager,
    dependencies: [
      'Web3',
      'Config',
    ],
    isSingleton: true,
  },

  // TODO: Make sure this is started when the hub starts
  CoinPaymentsDepositPollingService: {
    factory: (
      config: Config,
      db: DBEngine,
      service: CoinPaymentsService,
      dao: CoinPaymentsDao,
    ) => new CoinPaymentsDepositPollingService(config, db, service, dao),
    dependencies: [
      'Config',
      'DBEngine',
      'CoinPaymentsService',
      'CoinPaymentsDao',
    ],
    isSingleton: true,
  },

  //
  // Factories
  //

  OnchainTransactionsDao: {
    factory: (config: Config) => new OnchainTransactionsDao(config),
    dependencies: ['Config']
  },

  PaymentMetaDao: {
    factory: (db: DBEngine<Client>, config: Config) => new PostgresPaymentMetaDao(db, config),
    dependencies: ['DBEngine', 'Config'],
  },

  ExchangeRateDao: {
    factory: (db: DBEngine<Client>) => new PostgresExchangeRateDao(db),
    dependencies: ['DBEngine'],
  },

  GlobalSettingsDao: {
    factory: (db: DBEngine<Client>) => 
      new PostgresGlobalSettingsDao(db),
    dependencies: ['DBEngine']
  },

  ChainsawDao: {
    factory: (db: DBEngine<Client>, config: Config) =>
      new PostgresChainsawDao(db, config),
    dependencies: ['DBEngine', 'Config'],
  },

  PaymentsDao: {
    factory: (db: DBEngine<Client>) =>
      new PostgresPaymentsDao(db),
    dependencies: ['DBEngine'],
  },

  OptimisticPaymentDao: {
    factory: (db: DBEngine<Client>) =>
      new PostgresOptimisticPaymentDao(db),
    dependencies: ['DBEngine'],
  },

  WithdrawalsDao: {
    factory: (db: DBEngine<Client>) => new PostgresWithdrawalsDao(db),
    dependencies: ['DBEngine'],
  },

  DBEngine: {
    factory: (pool: PgPoolService, context: Context) =>
      new PostgresDBEngine(pool, context),
    dependencies: ['PgPoolService', 'Context'],
  },

  DisbursementDao: {
    factory: (db: DBEngine<Client>) => new PostgresDisbursementDao(db),
    dependencies: ['DBEngine'],
  },

  ConnextUtils: {
    factory: (config: Config) => new Utils(),
    dependencies: ['Config'],
  },

  Validator: {
    factory: (web3: any, config: Config) => new Validator(config.hotWalletAddress, web3.eth, ChannelManagerABI.abi),
    dependencies: ['Web3', 'Config'],
  },

  StateGenerator: {
    factory: () => new StateGenerator(),
  },

  GasEstimateDao: {
    factory: (db: DBEngine<Client>, redis: RedisClient) =>
      new PostgresGasEstimateDao(db, redis),
    dependencies: ['DBEngine', 'RedisClient'],
  },

  RedisClient: {
    factory: (config: Config) => getRedisClient(config.redisUrl),
    dependencies: ['Config'],
    isSingleton: true
  },

  FeatureFlagsDao: {
    factory: (client: DBEngine<Client>) => new PostgresFeatureFlagsDao(client),
    dependencies: ['DBEngine'],
  },

  AuthHandler: {
    factory: (config: Config) => new DefaultAuthHandler(config),
    dependencies: ['Config'],
  },

  Context: {
    factory: () => {
      throw new Error(
        'A Context instance should be provided by the instanciator ' +
        '(see comments on the Context class)'
      )
    }
  },

  ChannelsDao: {
    factory: (db: DBEngine<Client>, config: Config) =>
      new PostgresChannelsDao(db, config),
    dependencies: ['DBEngine', 'Config'],
  },

  ThreadsDao: {
    factory: (db: DBEngine<Client>, config: Config) =>
      new PostgresThreadsDao(db, config),
    dependencies: ['DBEngine', 'Config'],
  },

  ChannelDisputesDao: {
    factory: (db: DBEngine<Client>, config: Config) =>
      new PostgresChannelDisputesDao(db, config),
    dependencies: ['DBEngine', 'Config'],
  },

  PaymentProfilesDao: {
    factory: (db: DBEngine<Client>, config: Config) =>
      new PostgresPaymentProfilesDao(db, config),
    dependencies: ['DBEngine', 'Config'],
  },

  SignerService: {
    factory: (web3: any, contract: ChannelManager, utils: Utils, config: Config) => new SignerService(web3, contract, utils, config),
    dependencies: ['Web3', 'ChannelManagerContract', 'ConnextUtils', 'Config']
  },

  PaymentsService: {
    factory: (
      channelsService: ChannelsService,
      threadsService: ThreadsService,
      signerService: SignerService,
      paymentsDao: PaymentsDao,
      paymentMetaDao: PaymentMetaDao,
      optimisticPaymentDao: OptimisticPaymentDao,
      channelsDao: ChannelsDao,
      custodialPaymentsDao: CustodialPaymentsDao,
      validator: Validator,
      config: Config,
      db: DBEngine,
      gds: GlobalSettingsDao,
    ) => new PaymentsService(
      channelsService,
      threadsService,
      signerService,
      paymentsDao,
      paymentMetaDao,
      optimisticPaymentDao,
      channelsDao,
      custodialPaymentsDao,
      validator,
      config,
      db,
      gds,
    ),
    dependencies: [
      'ChannelsService',
      'ThreadsService',
      'SignerService',
      'PaymentsDao',
      'PaymentMetaDao',
      'OptimisticPaymentDao',
      'ChannelsDao',
      'CustodialPaymentsDao',
      'Validator',
      'Config',
      'DBEngine',
      'GlobalSettingsDao'
    ],
  },

  OptimisticPaymentsService: {
    factory: (
      db: DBEngine,
      opPaymentDao: OptimisticPaymentDao,
      channelsDao: ChannelsDao,
      paymentsService: PaymentsService,
      channelsService: ChannelsService
    ) => new OptimisticPaymentsService(
      db, 
      opPaymentDao, 
      channelsDao, 
      paymentsService,
      channelsService
    ),
    dependencies: [
      'DBEngine',
      'OptimisticPaymentDao',
      'ChannelsDao',
      'PaymentsService',
      'ChannelsService'
    ],
    isSingleton: true
  },

  ChannelsService: {
    factory: (
      onchainTx: OnchainTransactionService,
      threadsService: ThreadsService,
      signerService: SignerService,
      channelsDao: ChannelsDao,
      threadsDao: ThreadsDao,
      exchangeRateDao: ExchangeRateDao,
      channelDisputesDao: ChannelDisputesDao,
      onchainTransactionDao: OnchainTransactionsDao,
      generator: StateGenerator,
      validation: Validator,
      redis: RedisClient,
      db: DBEngine,
      config: Config,
      contract: ChannelManager,
      coinPaymentsDao: CoinPaymentsDao,
      paymentProfilesService: PaymentProfilesService
    ) =>
      new ChannelsService(
        onchainTx,
        threadsService,
        signerService,
        channelsDao,
        threadsDao,
        exchangeRateDao,
        channelDisputesDao,
        onchainTransactionDao,
        generator,
        validation,
        redis,
        db,
        config,
        contract,
        coinPaymentsDao,
        paymentProfilesService,
      ),
    dependencies: [
      'OnchainTransactionService',
      'ThreadsService',
      'SignerService',
      'ChannelsDao',
      'ThreadsDao',
      'ExchangeRateDao',
      'ChannelDisputesDao',
      'OnchainTransactionsDao',
      'StateGenerator',
      'Validator',
      'RedisClient',
      'DBEngine',
      'Config',
      'ChannelManagerContract',
      'CoinPaymentsDao',
      'PaymentProfilesService'
    ],
  },

  ThreadsService: {
    factory: (
      signerService: SignerService,
      channelsDao: ChannelsDao,
      threadsDao: ThreadsDao,
      validation: Validator,
      config: Config,
      gsd: GlobalSettingsDao
    ) => new ThreadsService(signerService, channelsDao, threadsDao, validation, config, gsd),
    dependencies: [
      'SignerService',
      'ChannelsDao',
      'ThreadsDao',
      'Validator',
      'Config',
      'GlobalSettingsDao'
    ],
  },

  CoinPaymentsApiClient: {
    factory: (config: Config, ngrok: NgrokService) => new CoinPaymentsApiClient(config, ngrok),
    dependencies: ['Config', 'NgrokService'],
  },

  CoinPaymentsService: {
    factory: (
      config: Config,
      api: CoinPaymentsApiClient,
      dao: CoinPaymentsDao,
      db: DBEngine,
      channelsService: ChannelsService,
      channelDao: ChannelsDao,
      exchangeRateDao: ExchangeRateDao,
    ) => new CoinPaymentsService(config, api, dao, db, channelsService, channelDao, exchangeRateDao),
    dependencies: [
      'Config',
      'CoinPaymentsApiClient',
      'CoinPaymentsDao',
      'DBEngine',
      'ChannelsService',
      'ChannelsDao',
      'ExchangeRateDao',
    ],
  },

  CoinPaymentsDao: {
    factory: (
      db: DBEngine,
    ) => new CoinPaymentsDao(db),
    dependencies: ['DBEngine'],
  },

  CustodialPaymentsDao: {
    factory: (
      db: DBEngine,
    ) => new CustodialPaymentsDao(db),
    dependencies: ['DBEngine'],
  },

  CustodialPaymentsService: {
    factory: (
      config: Config,
      db: DBEngine,
      exchangeRates: ExchangeRateDao,
      dao: CustodialPaymentsDao,
      onchainTxnService: OnchainTransactionService,
    ) => new CustodialPaymentsService(
      config,
      db,
      exchangeRates,
      dao,
      onchainTxnService,
    ),
    dependencies: [
      'Config',
      'DBEngine',
      'ExchangeRateDao',
      'CustodialPaymentsDao',
      'OnchainTransactionService',
    ],
  },

  PaymentProfilesService: {
    factory: (
      paymentsProfileDao: PaymentProfilesDao,
      db: DBEngine,
    ) => new PaymentProfilesService(
      paymentsProfileDao,
      db,
    ),
    dependencies: [
      'PaymentProfilesDao',
      'DBEngine'
    ]
  },
}
