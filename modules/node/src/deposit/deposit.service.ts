import { DEPOSIT_STATE_TIMEOUT } from "@connext/apps";
import { MinimumViableMultisig, ERC20 } from "@connext/contracts";
import {
  Address,
  Contract,
  DepositAppName,
  DepositAppState,
  MinimalTransaction,
  EventNames,
  Bytes32,
  FreeBalanceResponse,
} from "@connext/types";
import { getSignerAddressFromPublicIdentifier, stringify } from "@connext/utils";
import { Injectable } from "@nestjs/common";
import { BigNumber, constants, providers } from "ethers";

import { CFCoreService } from "../cfCore/cfCore.service";
import { Channel } from "../channel/channel.entity";
import { LoggerService } from "../logger/logger.service";
import { OnchainTransactionService } from "../onchainTransactions/onchainTransaction.service";
import { ChannelRepository } from "../channel/channel.repository";
import { ConfigService } from "../config/config.service";
import {
  OnchainTransaction,
  TransactionReason,
  TransactionStatus,
} from "../onchainTransactions/onchainTransaction.entity";
import { AppInstance } from "../appInstance/appInstance.entity";

const { Zero, AddressZero } = constants;

@Injectable()
export class DepositService {
  constructor(
    private readonly configService: ConfigService,
    private readonly cfCoreService: CFCoreService,
    private readonly onchainTransactionService: OnchainTransactionService,
    private readonly log: LoggerService,
    private readonly channelRepository: ChannelRepository,
  ) {
    this.log.setContext("DepositService");
  }

  async deposit(
    channel: Channel,
    amount: BigNumber,
    assetId: string,
  ): Promise<{
    completed: () => Promise<FreeBalanceResponse>;
    appIdentityHash: string;
    transaction: providers.TransactionResponse;
  }> {
    this.log.info(
      `Deposit started: ${JSON.stringify({ channel: channel.multisigAddress, amount, assetId })}`,
    );
    // don't allow deposit if user's balance refund app is installed
    const depositRegistry = this.cfCoreService.getAppInfoByNameAndChain(
      DepositAppName,
      channel.chainId,
    );
    const depositApp: AppInstance<"DepositApp"> = channel.appInstances.find(
      (app) =>
        app.appDefinition === depositRegistry.appDefinitionAddress &&
        app.latestState.assetId === assetId,
    );
    if (
      depositApp &&
      depositApp.latestState.transfers[0].to ===
        getSignerAddressFromPublicIdentifier(channel.userIdentifier)
    ) {
      throw new Error(
        `Cannot deposit, user has deposit app installed for asset ${assetId} on chain ${channel.chainId}, app: ${depositApp.identityHash}`,
      );
    }

    // Check if the node has a deposit in progress
    if (
      depositApp &&
      depositApp.latestState.transfers[0].to ===
        getSignerAddressFromPublicIdentifier(channel.nodeIdentifier)
    ) {
      this.log.warn(
        `Collateral request is in flight for ${assetId} on chain ${channel.chainId}, waiting for uninstallation of ${depositApp.identityHash}`,
      );
      const preDeposit = await this.cfCoreService.getFreeBalance(
        channel.userIdentifier,
        channel.multisigAddress,
      );
      const uninstalledApp = await this.handleActiveDeposit(channel, depositApp.identityHash);
      if (!uninstalledApp) {
        throw new Error(
          `Attempted to wait for ongoing transaction on chain ${channel.chainId}, but it took longer than 5 blocks, retry later. For deposit app: ${depositApp.identityHash} `,
        );
      }
      const postDeposit = await this.cfCoreService.getFreeBalance(
        channel.userIdentifier,
        channel.multisigAddress,
      );
      this.log.warn(
        `Waited for active deposit, new collateral: ${stringify(
          postDeposit[getSignerAddressFromPublicIdentifier(channel.nodeIdentifier)],
        )}`,
      );
      const diff = postDeposit[getSignerAddressFromPublicIdentifier(channel.nodeIdentifier)].sub(
        preDeposit[getSignerAddressFromPublicIdentifier(channel.nodeIdentifier)],
      );
      if (diff.gte(amount)) {
        // Do not continue with deposit
        // TODO: choose right response?
        return undefined;
      }
    }

    // deposit app for asset id with node as initiator is already installed
    // send deposit to chain
    let appIdentityHash: Bytes32;
    let response: providers.TransactionResponse;

    const cleanUpDepositRights = async () => {
      if (appIdentityHash) {
        this.log.info(
          `Releasing deposit rights on chain ${channel.chainId} for ${channel.multisigAddress}`,
        );
        await this.rescindDepositRights(appIdentityHash, channel.multisigAddress);
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
      this.log.error(
        `Caught error collateralizing on chain ${channel.chainId} for ${channel.multisigAddress}: ${
          e.stack || e
        }`,
      );
      await cleanUpDepositRights();
      return undefined;
    }
    // remove the deposit rights when transaction fails or is mined
    const completed: Promise<FreeBalanceResponse> = new Promise(async (resolve, reject) => {
      try {
        await response.wait();
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
  ): Promise<string | undefined> {
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
    await this.cfCoreService.uninstallApp(appIdentityHash, multisigAddress);
  }

  async findCollateralizationByHash(hash: string): Promise<OnchainTransaction | undefined> {
    const tx = await this.onchainTransactionService.findByHash(hash);
    if (!tx || tx.reason !== TransactionReason.COLLATERALIZATION) {
      return undefined;
    }
    return tx;
  }

  async handleActiveDeposit(
    channel: Channel,
    appIdentityHash: string,
  ): Promise<string | undefined> {
    this.log.info(
      `Active deposit for user ${channel.userIdentifier} on ${channel.multisigAddress}, waiting`,
    );
    const ethProvider = this.configService.getEthProvider(channel.chainId);
    const startingBlock = await ethProvider.getBlockNumber();
    const BLOCKS_TO_WAIT = 5;

    // Get the transaction associated with the deposit
    const transaction = await this.onchainTransactionService.findByAppId(appIdentityHash);
    if (!transaction) {
      // TODO: is there a better way of handling this case?
      throw new Error(
        `Deposit app installed in channel and no transaction found associated with it. AppId: ${appIdentityHash}`,
      );
    }

    // Hit in cases where client was offline for uninstallation of collateral
    const block = await ethProvider.getBlockNumber();
    if (
      transaction.status !== TransactionStatus.PENDING &&
      Math.abs(transaction.blockNumber - block) > 1 // don't uninstall if tx was *just* mined
    ) {
      // the deposit tx has either failed or succeeded, regardless
      // the deposit app should not exist at this point.
      // uninstall and rescind deposit rights, then return string
      this.log.info(
        `Onchain tx (hash: ${transaction.hash}) associated with deposit app ${appIdentityHash} has been mined with status: ${transaction.status}, calling uninstall`,
      );
      await this.rescindDepositRights(appIdentityHash, channel.multisigAddress);
      this.log.info(
        `Released deposit rights on chain ${channel.chainId} for ${channel.multisigAddress}`,
      );
      return appIdentityHash;
    }

    // transaction is still pending, wait until it is broadcast
    this.log.info(`Waiting for uninstallation of ${appIdentityHash}`);
    const result = await Promise.race([
      new Promise((resolve, reject) => {
        this.cfCoreService.emitter.attachOnce(
          EventNames.UNINSTALL_EVENT,
          (data) => {
            return resolve(data.appIdentityHash);
          },
          (data) => data.appIdentityHash === appIdentityHash,
        );
        this.cfCoreService.emitter.attachOnce(
          EventNames.UNINSTALL_FAILED_EVENT,
          (data) => reject(data.error),
          (data) => data.params.appIdentityHash === appIdentityHash,
        );
      }),
      new Promise((resolve) => {
        // only wait for 5 blocks
        ethProvider.on("block", async (blockNumber: number) => {
          if (blockNumber - startingBlock > BLOCKS_TO_WAIT) {
            ethProvider.off("block");
            return resolve(undefined);
          }
        });
      }),
    ]);

    if (!result) {
      this.log.warn(
        `Waited 5 blocks for uninstall of ${appIdentityHash} without success.  Waiting for tx: ${transaction.hash}`,
      );
    }
    return result as string | undefined;
  }

  private async sendDepositToChain(
    channel: Channel,
    amount: BigNumber,
    tokenAddress: Address,
    appIdentityHash: string,
  ): Promise<providers.TransactionResponse> {
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
      this.log.info(`Checking withdrawn amount using ethProvider ${ethProvider.connection.url}`);
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
      `Checking starting multisig balance of ${channel.multisigAddress} asset ${tokenAddress} on chain ${channel.chainId} using ethProvider ${ethProvider.connection.url}`,
    );
    const startingMultisigBalance =
      tokenAddress === AddressZero
        ? await ethProvider.getBalance(channel.multisigAddress)
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
