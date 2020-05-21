import { DEPOSIT_STATE_TIMEOUT } from "@connext/apps";
import { MinimumViableMultisig, ERC20 } from "@connext/contracts";
import {
  Address,
  BigNumber,
  Contract,
  DepositAppName,
  DepositAppState,
  MinimalTransaction,
  TransactionReceipt,
  EventNames,
  EventPayloads,
  Bytes32,
} from "@connext/types";
import { getSignerAddressFromPublicIdentifier, stringify } from "@connext/utils";
import { Injectable } from "@nestjs/common";
import { constants } from "ethers";

import { CFCoreService } from "../cfCore/cfCore.service";
import { Channel } from "../channel/channel.entity";
import { LoggerService } from "../logger/logger.service";
import { OnchainTransactionService } from "../onchainTransactions/onchainTransaction.service";
import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";
import { ChannelRepository } from "../channel/channel.repository";
import { ConfigService } from "../config/config.service";
import {
  OnchainTransaction,
  TransactionReason,
} from "../onchainTransactions/onchainTransaction.entity";
import { AppInstance } from "../appInstance/appInstance.entity";
import { AppInstanceRepository } from "../appInstance/appInstance.repository";

const { AddressZero, Zero } = constants;
@Injectable()
export class DepositService {
  constructor(
    private readonly configService: ConfigService,
    private readonly cfCoreService: CFCoreService,
    private readonly onchainTransactionService: OnchainTransactionService,
    private readonly log: LoggerService,
    private readonly appRegistryRepository: AppRegistryRepository,
    private readonly channelRepository: ChannelRepository,
    private readonly appInstanceRepository: AppInstanceRepository,
  ) {
    this.log.setContext("DepositService");
  }

  async deposit(channel: Channel, amount: BigNumber, assetId: string): Promise<TransactionReceipt> {
    this.log.info(
      `Deposit started: ${JSON.stringify({ channel: channel.multisigAddress, amount, assetId })}`,
    );
    // don't allow deposit if user's balance refund app is installed
    const depositRegistry = await this.appRegistryRepository.findByNameAndNetwork(
      DepositAppName,
      (await this.configService.getEthNetwork()).chainId,
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
        `Cannot deposit, user has deposit app installed for asset ${assetId}, app: ${depositApp.identityHash}`,
      );
    }

    // don't allow deposit if an active deposit is in process
    if (channel.activeCollateralizations[assetId]) {
      this.log.warn(`Collateral request is in flight for ${assetId}, waiting for transaction`);
      const waited = await this.waitForActiveDeposits(
        channel.userIdentifier,
        channel.multisigAddress,
        assetId,
      );
      if (!waited) {
        throw new Error(
          `Attempted to wait for ongoing transaction, but it took longer than 5 blocks, retry later.`,
        );
      }
      const fb = await this.cfCoreService.getFreeBalance(
        channel.userIdentifier,
        channel.multisigAddress,
      );
      this.log.warn(
        `Waited for active deposit, new collateral: ${stringify(
          fb[getSignerAddressFromPublicIdentifier(channel.nodeIdentifier)],
        )}`,
      );
    }
    // deposit app for asset id with node as initiator is already installed
    // send deposit to chain
    let appIdentityHash: Bytes32;
    let receipt: TransactionReceipt;
    try {
      await this.channelRepository.setInflightCollateralization(channel, assetId, true);
      this.log.info(`Requesting deposit rights before depositing`);
      appIdentityHash = await this.requestDepositRights(channel, assetId);
      this.log.info(`Requested deposit rights`);
      receipt = await this.sendDepositToChain(channel, amount, assetId);
    } catch (e) {
      throw e;
    } finally {
      await this.rescindDepositRights(appIdentityHash, channel.multisigAddress);
      await this.channelRepository.setInflightCollateralization(channel, assetId, false);
    }
    this.log.info(`Deposit complete: ${JSON.stringify(receipt)}`);
    return receipt;
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
    this.log.debug(`Uninstalling deposit app`);
    await this.cfCoreService.uninstallApp(appIdentityHash, multisigAddress);
  }

  async findCollateralizationByHash(hash: string): Promise<OnchainTransaction | undefined> {
    const tx = await this.onchainTransactionService.findByHash(hash);
    if (!tx || tx.reason !== TransactionReason.COLLATERALIZATION) {
      return undefined;
    }
    return tx;
  }

  private async waitForActiveDeposits(
    userId: string,
    multisigAddress: string,
    assetId: string,
  ): Promise<string[] | undefined> {
    this.log.info(`Collateralization in flight for user ${userId}, waiting`);
    const ethProvider = this.configService.getEthProvider();
    const signerAddr = await this.configService.getSignerAddress();
    const startingBlock = await ethProvider.getBlockNumber();
    const BLOCKS_TO_WAIT = 5;

    // get all deposit appIds
    const depositApps = await this.cfCoreService.getAppInstancesByAppName(
      multisigAddress,
      DepositAppName,
    );
    const ourDepositAppIds = depositApps
      .filter((app) => {
        const latestState = app.latestState as DepositAppState;
        return latestState.assetId === assetId && latestState.transfers[0].to === signerAddr;
      })
      .map((app) => app.identityHash);

    let resolvedDepositAppIds = [];
    const result = await new Promise((resolve) => {
      this.cfCoreService.cfCore.on(
        EventNames.UNINSTALL_EVENT,
        async (data: { data: EventPayloads.Uninstall }) => {
          const { appIdentityHash } = data.data;
          if (ourDepositAppIds.find((id) => id === appIdentityHash)) {
            resolvedDepositAppIds.push(appIdentityHash);
          }
          if (resolvedDepositAppIds.length === ourDepositAppIds.length) {
            return resolve(resolvedDepositAppIds);
          }
        },
      );

      // only wait for 5 blocks
      ethProvider.on("block", async (blockNumber: number) => {
        if (blockNumber - startingBlock > BLOCKS_TO_WAIT) {
          return resolve(undefined);
        }
      });
    });
    if (!result) {
      this.log.warn(
        `Only resolved ${resolvedDepositAppIds.length}/${
          ourDepositAppIds.length
        } expected deposits, but it has been more than 5 blocks. Returning. Resolved: ${stringify(
          resolvedDepositAppIds,
        )}, all: ${stringify(ourDepositAppIds)}`,
      );
    }
    return result as string[] | undefined;
  }

  private async sendDepositToChain(
    channel: Channel,
    amount: BigNumber,
    tokenAddress: Address,
  ): Promise<TransactionReceipt> {
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
      const token = new Contract(tokenAddress, ERC20.abi, this.configService.getEthProvider());
      tx = {
        to: tokenAddress,
        value: 0,
        data: token.interface.encodeFunctionData("transfer", [channel.multisigAddress, amount]),
      };
    }
    return this.onchainTransactionService.sendDeposit(channel, tx);
  }

  private async proposeDepositInstall(
    channel: Channel,
    tokenAddress: string = AddressZero,
  ): Promise<string | undefined> {
    const ethProvider = this.configService.getEthProvider();

    // generate initial totalAmountWithdrawn
    const multisig = new Contract(channel.multisigAddress, MinimumViableMultisig.abi, ethProvider);
    let startingTotalAmountWithdrawn: BigNumber;
    try {
      startingTotalAmountWithdrawn = await multisig.totalAmountWithdrawn(tokenAddress);
    } catch (e) {
      const NOT_DEPLOYED_ERR = `contract not deployed (contractAddress="${channel.multisigAddress}"`;
      if (!e.message.includes(NOT_DEPLOYED_ERR)) {
        throw new Error(e);
      }
      // multisig is deployed on withdrawal, if not
      // deployed withdrawal amount is 0
      startingTotalAmountWithdrawn = Zero;
    }

    // generate starting multisig balance
    const startingMultisigBalance =
      tokenAddress === AddressZero
        ? await ethProvider.getBalance(channel.multisigAddress)
        : await new Contract(tokenAddress, ERC20.abi, this.configService.getSigner()).balanceOf(
            channel.multisigAddress,
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
      DepositAppName,
      { reason: "Node deposit" }, // meta
      DEPOSIT_STATE_TIMEOUT,
    );
    return res ? res.appIdentityHash : undefined;
  }
}
