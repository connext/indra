import Machinomy from 'machinomy'
import {
  Registry,
  PartialServiceDefinitions,
  Context,
  Container,
} from './Container'
import AuthApiService from './api/AuthApiService'
import CRAuthManager, { MemoryCRAuthManager } from './CRAuthManager'
import Config from './Config'
import { ApiService } from './api/ApiService'
import BrandingApiService from './api/BrandingApiService'
import {
  default as DBEngine,
  PostgresDBEngine,
  PgPoolService,
} from './DBEngine'
import { Store } from 'express-session'
import { PaymentHandler, DefaultPaymentHandler } from './PaymentHandler'
import PaymentsApiService from './api/PaymentsApiService'
//import { AdminApiService } from './api/admin/AdminApiService'
//import AccountsApiService from './api/AccountsApiService'
//import WithdrawalsApiService from './api/WithdrawalsApiService'
import ExchangeRateService from './ExchangeRateService'
import { default as AccountsDao, PostgresAccountsDao } from './dao/AccountsDao'
import ExchangeRateDao, { PostgresExchangeRateDao } from './dao/ExchangeRateDao'
import { Client } from 'pg'
import WithdrawalsService from './WithdrawalsService'
import PaymentsDao, { PostgresPaymentsDao } from './dao/PaymentsDao'
import WithdrawalsDao, { PostgresWithdrawalsDao } from './dao/WithdrawalsDao'
import {
  default as GlobalSettingsDao,
  PostgresGlobalSettingsDao,
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

import ChainsawLcDao, { PostgresChainsawLcDao } from './dao/ChainsawLcDao'
import VirtualChannelsDao, {
  PostgresVirtualChannelsDao,
} from './dao/VirtualChannelsDao'
import LedgerChannelsDao, {
  PostgresLedgerChannelsDao,
} from './dao/LedgerChannelsDao'
import LedgerChannelsService from './LedgerChannelService'
import VirtualChannelsService from './VirtualChannelsService'
//import LedgerChannelsApiService from './api/LedgerChannelsApiService'
//import VirtualChannelsApiService from './api/VirtualChannelsApiService'
import DisbursementDao, {
  PostgresDisbursementDao,
} from './dao/DisbursementsDao'
import DisbursementService from './DisbursementService'
//import DisbursementApiService from './api/DisbursementApiService'
import { getRedisClient, RedisClient } from './RedisClient'
import {
  default as GasEstimateDao,
  PostgresGasEstimateDao,
} from './dao/GasEstimateDao'
import { default as GasEstimateService } from './GasEstimateService'
import { default as GasEstimateApiService } from './api/GasEstimateApiService'
import Web3 from 'web3'
import FeatureFlagsDao, { PostgresFeatureFlagsDao } from './dao/FeatureFlagsDao'
import FeatureFlagsApiService from './api/FeatureFlagsApiService'
import DepositCorrelateService from './DepositCorrelateService'
import ChannelLocker from './ChannelLocker'
import { ApiServer } from './ApiServer'
import { DefaultAuthHandler } from './middleware/AuthHandler'
import { Utils } from './vendor/connext/Utils'
import { Validation } from './vendor/connext/Validation'
import ThreadsService from './ThreadsService'
import ThreadsApiService from './api/ThreadsApiService';
import { OnchainTransactionService } from "./OnchainTransactionService";
import { OnchainTransactionsDao } from "./dao/OnchainTransactionsDao";

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
      chainsawDao: ChainsawDao,
      channelsDao: ChannelsDao,
      web3: Web3,
      utils: Utils,
      config: Config,
    ) => new ChainsawService(chainsawDao, channelsDao, web3, utils, config),
    dependencies: [
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

  PaymentHandler: {
    factory: (
      dao: PaymentMetaDao,
      vcDao: VirtualChannelsDao,
      lcDao: LedgerChannelsDao,
      cDao: ChainsawLcDao,
    ) => new DefaultPaymentHandler(dao, vcDao, lcDao, cDao),
    dependencies: [
      'PaymentMetaDao',
      'VirtualChannelsDao',
      'LedgerChannelsDao',
      'ChainsawLcDao',
    ],
  },

  WithdrawalsService: {
    factory: (
      dao: WithdrawalsDao,
      globalSettingsDao: GlobalSettingsDao,
      web3: any,
      config: Config,
    ) => new WithdrawalsService(dao, globalSettingsDao, web3, config),
    dependencies: ['WithdrawalsDao', 'GlobalSettingsDao', 'Web3', 'Config'],
  },

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
  },

  ChainsawDao: {
    factory: (db: DBEngine<Client>, config: Config) =>
      new PostgresChainsawDao(db, config),
    dependencies: ['DBEngine', 'Config'],
  },

  PaymentsDao: {
    factory: (db: DBEngine<Client>, config: Config) =>
      new PostgresPaymentsDao(db, config),
    dependencies: ['DBEngine', 'Config'],
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

  ChainsawLcDao: {
    factory: (db: DBEngine<Client>) => new PostgresChainsawLcDao(db),
    dependencies: ['DBEngine'],
  },

  LedgerChannelsDao: {
    factory: (db: DBEngine<Client>) => new PostgresLedgerChannelsDao(db),
    dependencies: ['DBEngine'],
  },

  VirtualChannelsDao: {
    factory: (db: DBEngine<Client>) => new PostgresVirtualChannelsDao(db),
    dependencies: ['DBEngine'],
  },

  DisbursementDao: {
    factory: (db: DBEngine<Client>) => new PostgresDisbursementDao(db),
    dependencies: ['DBEngine'],
  },

  ConnextUtils: {
    factory: () => new Utils(),
    dependencies: [],
  },

  ConnextValidation: {
    factory: (utils: Utils) => new Validation(utils),
    dependencies: ['ConnextUtils'],
  },

  VirtualChannelsService: {
    factory: (
      virtualChannelsDao: VirtualChannelsDao,
      ledgerChannelsDao: LedgerChannelsDao,
      chainsawDao: ChainsawLcDao,
      ledgerChannelsService: LedgerChannelsService,
      web3: any,
      config: Config,
      flags: FeatureFlagsDao,
      channelLocker: ChannelLocker,
    ) =>
      new VirtualChannelsService(
        virtualChannelsDao,
        ledgerChannelsDao,
        chainsawDao,
        ledgerChannelsService,
        web3,
        null,
        config,
        flags,
        channelLocker,
      ),
    dependencies: [
      'VirtualChannelsDao',
      'LedgerChannelsDao',
      'ChainsawLcDao',
      'LedgerChannelsService',
      'Web3',
      'Config',
      'FeatureFlagsDao',
      'ChannelLocker',
    ],
  },

  LedgerChannelsService: {
    factory: (
      virtualChannelsDao: VirtualChannelsDao,
      ledgerChannelsDao: LedgerChannelsDao,
      chainsawDao: ChainsawLcDao,
      web3: any,
      config: Config,
      redisClient: RedisClient,
      channelLocker: ChannelLocker,
    ) =>
      new LedgerChannelsService(
        virtualChannelsDao,
        ledgerChannelsDao,
        chainsawDao,
        web3,
        null,
        null,
        config,
        redisClient,
        channelLocker,
      ),
    dependencies: [
      'VirtualChannelsDao',
      'LedgerChannelsDao',
      'ChainsawLcDao',
      'Web3',
      'Config',
      'RedisClient',
      'ChannelLocker',
    ],
  },

  DisbursementService: {
    factory: (dao: DisbursementDao, web3: any, config: Config) =>
      new DisbursementService(dao, web3, config),
    dependencies: ['DisbursementDao', 'Web3', 'Config'],
  },

  GasEstimateDao: {
    factory: (db: DBEngine<Client>, redis: RedisClient) =>
      new PostgresGasEstimateDao(db, redis),
    dependencies: ['DBEngine', 'RedisClient'],
  },

  RedisClient: {
    factory: (config: Config) => getRedisClient(config.redisUrl),
    dependencies: ['Config'],
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

  DepositCorrelateService: {
    factory: (
      ledgerChannelsDao: LedgerChannelsDao,
      chainsawDao: ChainsawLcDao,
    ) => new DepositCorrelateService(ledgerChannelsDao, chainsawDao),
    dependencies: ['LedgerChannelsDao', 'ChainsawLcDao'],
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

  ChannelLocker: {
    factory: (redis: RedisClient) => new ChannelLocker(redis),
    dependencies: ['RedisClient'],
  },

  ChannelsService: {
    factory: (
      onchainTx: OnchainTransactionService,
      channelsDao: ChannelsDao,
      threadsDao: ThreadsDao,
      exchangeRateDao: ExchangeRateDao,
      utils: Utils,
      validation: Validation,
      redis: RedisClient,
      db: DBEngine,
      web3: any,
      config: Config,
    ) =>
      new ChannelsService(
        onchainTx,
        channelsDao,
        threadsDao,
        exchangeRateDao,
        utils,
        validation,
        redis,
        db,
        web3,
        config,
      ),
    dependencies: [
      'OnchainTransactionService',
      'ChannelsDao',
      'ThreadsDao',
      'ExchangeRateDao',
      'ConnextUtils',
      'ConnextValidation',
      'RedisClient',
      'DBEngine',
      'Web3',
      'Config',
    ],
  },

  ThreadsService: {
    factory: (
      channelsDao: ChannelsDao,
      threadsDao: ThreadsDao,
      utils: Utils,
      validation: Validation,
      web3: Web3,
      config: Config,
    ) => new ThreadsService(channelsDao, threadsDao, utils, validation, web3, config),
    dependencies: [
      'ChannelsDao',
      'ThreadsDao',
      'ConnextUtils',
      'ConnextValidation',
      'Web3',
      'Config',
    ],
  },
}
