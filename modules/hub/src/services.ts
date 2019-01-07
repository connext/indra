import {
  Registry,
  PartialServiceDefinitions,
  Context,
  Container,
} from './Container'
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
import { default as AccountsDao, PostgresAccountsDao } from './dao/AccountsDao'
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
import { Utils } from 'connext/dist/Utils'
import { Validator } from 'connext/dist/validator'
import ThreadsService from './ThreadsService'
import ThreadsApiService from './api/ThreadsApiService';
import { OnchainTransactionService } from "./OnchainTransactionService";
import { OnchainTransactionsDao } from "./dao/OnchainTransactionsDao";
import { StateGenerator } from 'connext/dist/StateGenerator';
import { SignerService } from './SignerService';
import PaymentsService from './PaymentsService';

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
      chainsawDao: ChainsawDao,
      channelsDao: ChannelsDao,
      web3: Web3,
      utils: Utils,
      config: Config,
    ) => new ChainsawService(signerService, chainsawDao, channelsDao, web3, utils, config),
    dependencies: [
      'SignerService',
      'ChainsawDao',
      'ChannelsDao',
      'Web3',
      'ConnextUtils',
      'Config',
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
      ExchangeRateApiService,
      ThreadsApiService,
      PaymentsApiService,
    ],
    isSingleton: true,
  },

  OnchainTransactionService: {
    factory: (
      web3: any,
      gasEstimateDao: GasEstimateDao,
      onchainTransactionDao: OnchainTransactionsDao,
      db: DBEngine,
      container: Container,
    ) => new OnchainTransactionService(web3, gasEstimateDao, onchainTransactionDao, db, container),
    dependencies: [
      'Web3',
      'GasEstimateDao',
      'OnchainTransactionsDao',
      'DBEngine',
      'Container',
    ],
    isSingleton: true,
  },

  CRAuthManager: {
    factory: (web3: any) => new MemoryCRAuthManager(web3),
    dependencies: ['Web3'],
    isSingleton: true,
  },

  //
  // Factories
  //

  AccountsDao: {
    factory: (db: DBEngine<Client>) => new PostgresAccountsDao(db),
    dependencies: ['DBEngine'],
  },

  OnchainTransactionsDao: {
    factory: () => new OnchainTransactionsDao(),
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
    factory: (db: DBEngine<Client>) => new PostgresGlobalSettingsDao(db),
    dependencies: ['DBEngine'],
    isSingleton: true
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
    factory: () => new Utils(),
    dependencies: [],
  },

  Validator: {
    factory: (web3: any, config: Config) => new Validator(web3, config.hotWalletAddress),
    dependencies: ['Web3', 'Config'],
  },

  StateGenerator: {
    factory: () => new StateGenerator(),
    dependencies: [],
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

  SignerService: {
    factory: (web3: any, utils: Utils, config: Config) => new SignerService(web3, utils, config),
    dependencies: ['Web3', 'ConnextUtils', 'Config']
  },

  PaymentsService: {
    factory: (
      channelsService: ChannelsService,
      threadsService: ThreadsService,
      signerService: SignerService,
      paymentsDao: PaymentsDao,
      paymentMetaDao: PaymentMetaDao,
      channelsDao: ChannelsDao,
      validator: Validator,
      config: Config,
      db: DBEngine,
    ) => new PaymentsService(
      channelsService, 
      threadsService, 
      signerService, 
      paymentsDao,
      paymentMetaDao, 
      channelsDao, 
      validator, 
      config,
      db,
    ),
    dependencies: [
      'ChannelsService',
      'ThreadsService',
      'SignerService',
      'PaymentsDao',
      'PaymentMetaDao',
      'ChannelsDao',
      'Validator',
      'Config',
      'DBEngine',
    ],
  },

  ChannelsService: {
    factory: (
      onchainTx: OnchainTransactionService,
      threadsService: ThreadsService,
      signerService: SignerService,
      channelsDao: ChannelsDao,
      threadsDao: ThreadsDao,
      exchangeRateDao: ExchangeRateDao,
      validation: Validator,
      redis: RedisClient,
      db: DBEngine,
      web3: any,
      config: Config,
    ) =>
      new ChannelsService(
        onchainTx,
        threadsService,
        signerService,
        channelsDao,
        threadsDao,
        exchangeRateDao,
        validation,
        redis,
        db,
        web3,
        config,
      ),
    dependencies: [
      'OnchainTransactionService',
      'ThreadsService',
      'SignerService',
      'ChannelsDao',
      'ThreadsDao',
      'ExchangeRateDao',
      'Validator',
      'RedisClient',
      'DBEngine',
      'Web3',
      'Config',
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
}
