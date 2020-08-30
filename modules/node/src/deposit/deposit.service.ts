import { DEPOSIT_STATE_TIMEOUT } from "@connext/apps";
import { MinimumViableMultisig, ERC20 } from "@connext/contracts";
import {
  Address,
  Contract,
  DepositAppName,
  DepositAppState,
  MinimalTransaction,
  Bytes32,
  FreeBalanceResponse,
} from "@connext/types";
import { getSignerAddressFromPublicIdentifier, stringify } from "@connext/utils";
import { Injectable } from "@nestjs/common";
import { BigNumber, constants, providers } from "ethers";

import { CFCoreService } from "../cfCore/cfCore.service";
import { Channel } from "../channel/channel.entity";
import { LoggerService } from "../logger/logger.service";
import {
  OnchainTransactionService,
  OnchainTransactionResponse,
} from "../onchainTransactions/onchainTransaction.service";
import { ConfigService } from "../config/config.service";
import {
  OnchainTransaction,
  TransactionReason,
  TransactionStatus,
} from "../onchainTransactions/onchainTransaction.entity";
import { AppInstance, AppType } from "../appInstance/appInstance.entity";
import { AppInstanceRepository } from "../appInstance/appInstance.repository";
import { ChannelRepository } from "../channel/channel.repository";

const { Zero, AddressZero } = constants;

@Injectable()
export class DepositService {
  constructor(
    private readonly configService: ConfigService,
    private readonly cfCoreService: CFCoreService,
    private readonly onchainTransactionService: OnchainTransactionService,
    private readonly log: LoggerService,
    private readonly appInstanceRepository: AppInstanceRepository,
    private readonly channelRepository: ChannelRepository,
  ) {
    this.log.setContext("DepositService");
  }

  async deposit(
    channel: Channel,
    amount: BigNumber,
    assetId: string,
  ): Promise<
    | {
        completed: () => Promise<FreeBalanceResponse>;
        appIdentityHash: string;
        transaction: providers.TransactionResponse;
      }
    | undefined
  > {
    this.log.info(
      `Deposit started: ${JSON.stringify({ channel: channel.multisigAddress, amount, assetId })}`,
    );
    // evaluate the installed deposit apps in the channel
    const depositRegistry = this.cfCoreService.getAppInfoByNameAndChain(
      DepositAppName,
      channel.chainId,
    );
    const depositApp: AppInstance<"DepositApp"> | undefined = channel.appInstances.find(
      (app) =>
        app.appDefinition === depositRegistry!.appDefinitionAddress &&
        app.latestState.assetId === assetId,
    );
    if (depositApp) {
      // if it is the users deposit, throw an error
      if (
        depositApp.latestState.transfers[0].to ===
        getSignerAddressFromPublicIdentifier(channel.userIdentifier)
      ) {
        this.log.warn(
          `Cannot deposit, user has deposit app installed for asset ${assetId} on chain ${channel.chainId}, app: ${depositApp.identityHash}`,
        );
        return undefined;
      } // otherwise it is our deposit app

      // check to see if the associated transaction has been completed
      // or app has been uninstalled
      // NOTE: theoretically the app should not be pulled from the channel if
      // it is uninstalled. However, this could be racy, so use the transaction
      // flag as the source of truth
      const transaction = await this.onchainTransactionService.findByAppId(depositApp.identityHash);
      if (!transaction) {
        throw new Error(
          `There is a deposit app installed in channel ${channel.multisigAddress} without an associated onchain transaction stored`,
        );
      }

      // if the transaction is still pending, throw an error
      if (transaction.status === TransactionStatus.PENDING) {
        this.log.warn(
          `Transaction ${transaction.hash} on ${channel.chainId} associated with deposit app ${depositApp.identityHash} is still pending, cannot deposit.`,
        );
        return undefined;
      }

      const uninstallDepositApp = async () => {
        let appUninstallError: Error | undefined = undefined;
        try {
          await this.rescindDepositRights(depositApp.identityHash, channel.multisigAddress);
        } catch (e) {
          // In this case, we could error because the app has been uninstalled
          // by some other process. Before hard erroring, double check against
          // the app repository that it is not uninstalled
          const app = await this.appInstanceRepository.findByIdentityHashOrThrow(
            depositApp.identityHash,
          );
          if (app.type !== AppType.UNINSTALLED) {
            appUninstallError = e;
          }
        }
        return appUninstallError;
      };

      // if the transaction failed, uninstall app
      if (transaction.status === TransactionStatus.FAILED) {
        const appUninstallError = await uninstallDepositApp();
        if (appUninstallError) {
          throw appUninstallError;
        }
      }

      // if the transaction is complete and the app was never uninstalled,
      // try to uninstall the app again before proceeding
      if (!transaction.appUninstalled) {
        const appUninstallError = await uninstallDepositApp();
        if (appUninstallError) {
          this.log.warn(
            `Transaction ${transaction.hash} on ${channel.chainId} completed, but unable to uninstall app ${depositApp.identityHash}: ${appUninstallError.message}`,
          );
          return undefined;
        }
      }
    }

    // install a new deposit app and create a new transaction
    let appIdentityHash: Bytes32;
    let response: OnchainTransactionResponse;

    const cleanUpDepositRights = async () => {
      const freshChannel = await this.channelRepository.findByMultisigAddressOrThrow(
        channel.multisigAddress,
      );
      const depositApp = freshChannel.appInstances.find((app) => {
        return (
          app.appDefinition === depositRegistry!.appDefinitionAddress &&
          app.latestState.assetId === assetId &&
          (app.latestState as DepositAppState).transfers[0].to ===
            getSignerAddressFromPublicIdentifier(freshChannel.nodeIdentifier)
        );
      });
      if (depositApp) {
        this.log.info(
          `Releasing deposit rights on chain ${channel.chainId} for ${channel.multisigAddress}`,
        );
        try {
          await this.rescindDepositRights(depositApp.identityHash, channel.multisigAddress);
        } catch (e) {
          this.log.warn(e.message);
        }
        this.log.info(
          `Released deposit rights on chain ${channel.chainId} for ${channel.multisigAddress}`,
        );
      }
    };

    try {
      this.log.info(
        `Requesting deposit rights before depositing on chain ${channel.chainId} for ${channel.multisigAddress}`,
      );
      appIdentityHash = await this.requestDepositRights(channel, assetId);
      this.log.info(
        `Requested deposit rights, sending deposit to chain on chain ${channel.chainId} for ${channel.multisigAddress}`,
      );
      response = await this.sendDepositToChain(channel, amount, assetId, appIdentityHash);
      this.log.info(
        `Deposit transaction broadcast on chain ${channel.chainId} for ${channel.multisigAddress}: ${response.hash}`,
      );
    } catch (e) {
      await cleanUpDepositRights();
      this.log.warn(
        `Caught error collateralizing on chain ${channel.chainId} for ${channel.multisigAddress}: ${
          e.stack || e
        }`,
      );
      return undefined;
    }
    // remove the deposit rights when transaction fails or is mined
    const completed: Promise<FreeBalanceResponse> = new Promise(async (resolve, reject) => {
      try {
        await response.completed();
        const freeBalance = await this.cfCoreService.getFreeBalance(
          channel.userIdentifier,
          channel.multisigAddress,
          assetId,
        );
        resolve({ freeBalance });
      } catch (e) {
        this.log.error(`Error in node deposit: ${e.message}`);
        reject(e);
      } finally {
        await cleanUpDepositRights();
      }
    });
    return { completed: () => completed, appIdentityHash, transaction: response };
  }

  async requestDepositRights(
    channel: Channel,
    tokenAddress: string = AddressZero,
  ): Promise<string> {
    const appIdentityHash = await this.proposeDepositInstall(channel, tokenAddress);
    if (!appIdentityHash) {
      throw new Error(
        `Failed to install deposit app for ${tokenAddress} in channel ${channel.multisigAddress}`,
      );
    }
    return appIdentityHash;
  }

  async rescindDepositRights(appIdentityHash: string, multisigAddress: string): Promise<void> {
    this.log.debug(`Uninstalling deposit app for ${multisigAddress} with ${appIdentityHash}`);
    const onchain = await this.onchainTransactionService.findByAppId(appIdentityHash);
    if (!onchain) {
      throw new Error(`Onchain tx doesn't exist for app ${appIdentityHash}`);
    }
    if (onchain.appUninstalled) {
      return;
    }
    if (onchain.status === TransactionStatus.PENDING) {
      throw new Error(
        `Can't uninstall deposit app when associated transaction is pending: ${stringify(onchain)}`,
      );
    }
    const channel = await this.channelRepository.findByMultisigAddressOrThrow(multisigAddress);
    await this.cfCoreService.uninstallApp(appIdentityHash, channel);
    await this.onchainTransactionService.setAppUninstalled(true, onchain.hash);
  }

  async findCollateralizationByHash(hash: string): Promise<OnchainTransaction | undefined> {
    const tx = await this.onchainTransactionService.findByHash(hash);
    if (!tx || tx.reason !== TransactionReason.COLLATERALIZATION) {
      return undefined;
    }
    return tx;
  }

  private async sendDepositToChain(
    channel: Channel,
    amount: BigNumber,
    tokenAddress: Address,
    appIdentityHash: string,
  ): Promise<OnchainTransactionResponse> {
    // derive the proper minimal transaction for the
    // onchain transaction service
    let tx: MinimalTransaction;
    if (tokenAddress === AddressZero) {
      tx = {
        to: channel.multisigAddress,
        value: amount,
        data: "0x",
      };
    } else {
      const token = new Contract(
        tokenAddress,
        ERC20.abi,
        this.configService.getEthProvider(channel.chainId),
      );
      tx = {
        to: tokenAddress,
        value: 0,
        data: token.interface.encodeFunctionData("transfer", [channel.multisigAddress, amount]),
      };
    }
    this.log.info(
      `Creating transaction on ${channel.chainId} for ${
        channel.multisigAddress
      } for amount ${amount.toString()}: ${stringify(tx)}`,
    );
    return this.onchainTransactionService.sendDeposit(channel, tx, appIdentityHash);
  }

  private async proposeDepositInstall(
    channel: Channel,
    tokenAddress: string = AddressZero,
  ): Promise<string | undefined> {
    const ethProvider = this.configService.getEthProvider(channel.chainId);

    // generate initial totalAmountWithdrawn
    const multisig = new Contract(channel.multisigAddress, MinimumViableMultisig.abi, ethProvider);
    let startingTotalAmountWithdrawn: BigNumber;
    try {
      this.log.info(`Checking withdrawn amount using ethProvider ${ethProvider!.connection.url}`);
      startingTotalAmountWithdrawn = await multisig.totalAmountWithdrawn(tokenAddress);
    } catch (e) {
      const NOT_DEPLOYED_ERR = `CALL_EXCEPTION`;
      if (!e.message.includes(NOT_DEPLOYED_ERR)) {
        throw new Error(e);
      }
      // multisig is deployed on withdrawal, if not
      // deployed withdrawal amount is 0
      startingTotalAmountWithdrawn = Zero;
    }
    this.log.info(`startingTotalAmountWithdrawn: ${startingTotalAmountWithdrawn.toString()}`);

    // generate starting multisig balance
    this.log.info(
      `Checking starting multisig balance of ${channel.multisigAddress} asset ${tokenAddress} on chain ${channel.chainId} using ethProvider ${ethProvider?.connection.url}`,
    );
    const startingMultisigBalance =
      tokenAddress === AddressZero
        ? await ethProvider!.getBalance(channel.multisigAddress)
        : await new Contract(tokenAddress, ERC20.abi, ethProvider).balanceOf(
            channel.multisigAddress,
          );

    this.log.info(
      `startingMultisigBalance of ${channel.multisigAddress} asset ${tokenAddress} on chain ${
        channel.chainId
      }: ${startingMultisigBalance.toString()}`,
    );

    const initialState: DepositAppState = {
      transfers: [
        {
          amount: Zero,
          to: await this.configService.getSignerAddress(),
        },
        {
          amount: Zero,
          to: getSignerAddressFromPublicIdentifier(channel.userIdentifier),
        },
      ],
      multisigAddress: channel.multisigAddress,
      assetId: tokenAddress,
      startingTotalAmountWithdrawn,
      startingMultisigBalance,
    };

    const res = await this.cfCoreService.proposeAndWaitForInstallApp(
      channel,
      initialState,
      Zero,
      tokenAddress,
      Zero,
      tokenAddress,
      this.cfCoreService.getAppInfoByNameAndChain(DepositAppName, channel.chainId),
      { reason: "Node deposit" }, // meta
      DEPOSIT_STATE_TIMEOUT,
    );
    return res ? res.appIdentityHash : undefined;
  }
}
