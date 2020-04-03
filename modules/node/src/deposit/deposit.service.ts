import { MinimumViableMultisig } from "@connext/contracts";
import {
  BigNumber,
  MinimalTransaction,
  Contract,
  DepositAppState,
  DepositAppName,
  TransactionResponse,
  TransactionReceipt,
  MIN_DEPOSIT_TIMEOOUT_BLOCKS,
  toBN,
} from "@connext/types";
import { Injectable } from "@nestjs/common";
import { Zero, AddressZero } from "ethers/constants";
import tokenAbi from "human-standard-token-abi";

import { CFCoreService } from "../cfCore/cfCore.service";
import { Channel } from "../channel/channel.entity";
import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { OnchainTransactionService } from "../onchainTransactions/onchainTransaction.service";
import { xkeyKthAddress } from "../util";
import { AppInstance } from "../appInstance/appInstance.entity";
import { AppInstanceRepository } from "../appInstance/appInstance.repository";
import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";
import { ChannelRepository } from "../channel/channel.repository";

@Injectable()
export class DepositService {
  constructor(
    private readonly cfCoreService: CFCoreService,
    private readonly configService: ConfigService,
    private readonly onchainTransactionService: OnchainTransactionService,
    private readonly log: LoggerService,
    private readonly appInstanceRepository: AppInstanceRepository,
    private readonly appRegistryRepository: AppRegistryRepository,
    private readonly channelRepository: ChannelRepository,
  ) {
    this.log.setContext("DepositService");
  }

  async deposit(channel: Channel, amount: BigNumber, assetId: string): Promise<TransactionReceipt> {
    const ethProvider = this.configService.getEthProvider();
    // don't allow deposit if user's balance refund app is installed
    const depositRegistry = await this.appRegistryRepository
      .findByNameAndNetwork(
        DepositAppName,
        (await this.configService.getEthNetwork()).chainId,
      );
    const installedDepositApps = await this.appInstanceRepository
      .findInstalledAppsByAppDefinition(
        channel.multisigAddress,
        depositRegistry.appDefinitionAddress,
      );
    const depositApp: AppInstance = installedDepositApps.filter(
      app => app.latestState.assetId === assetId,
    )[0];
    if (
      depositApp && 
      depositApp.latestState.transfers[0].to === xkeyKthAddress(channel.userPublicIdentifier)
    ) {
      throw new Error(
        `Cannot deposit, user has deposit app installed for asset ${assetId}, app: ${depositApp.identityHash}`,
      );
    }

    let appInstanceId;
    if (!depositApp) {
      this.log.debug(`Requesting deposit rights before depositing`);
      appInstanceId = await this.requestDepositRights(channel, assetId);
    } else {
      const latestState = depositApp.latestState as DepositAppState;
      // uninstall existing deposit app if it is finalized or timelock
      // has passed
      if (
        toBN(latestState.timelock).lt(await ethProvider.getBlockNumber()) || latestState.finalized
      ) {
        this.log.debug(`Found existing deposit app with finalized state, uninstalling`);
        await this.rescindDepositRights(depositApp.identityHash);
        appInstanceId = await this.requestDepositRights(channel, assetId);
      }
      // otherwise the deposit app is valid
    }
    const tx = await this.sendDepositToChain(channel, amount, assetId);
    const receipt = await tx.wait();
    await this.rescindDepositRights(appInstanceId || depositApp.identityHash);
    return receipt;
  }

  async requestDepositRights(channel: Channel, assetIdParam: string): Promise<string | undefined> {
    const assetId = assetIdParam || AddressZero;
    const appInstanceId = await this.proposeDepositInstall(channel, assetId);
    if (!appInstanceId) {
      throw new Error(`Failed to install deposit app for ${assetId} in channel ${channel.multisigAddress}`);
    }
    return appInstanceId;
  }

  async handleDepositAppsOnCheckIn(userPublicIdentifier: string): Promise<void> {
    const channel = await this.channelRepository
      .findByUserPublicIdentifierOrThrow(userPublicIdentifier);
    const depositRegistry = await this.appRegistryRepository
      .findByNameAndNetwork(
        DepositAppName,
        (await this.configService.getEthNetwork()).chainId,
      );
    const installedDepositApps = await this.appInstanceRepository
      .findInstalledAppsByAppDefinition(
        channel.multisigAddress,
        depositRegistry.appDefinitionAddress,
      );
    if (installedDepositApps.length === 0) {
      this.log.debug(`Found no deposit apps for ${userPublicIdentifier}`);
      return;
    }
    for (const depositApp of installedDepositApps) {
      try {
        // will finalize and uninstall. Will throw if it is a user deposit
        // which is okay, so catch and continue
        await this.rescindDepositRights(depositApp.identityHash);
      } catch (e) {
        this.log.error(`Caught error trying to rescind deposit rights in channel ${channel.multisigAddress}. Deposit app: ${depositApp.identityHash}, error: ${e.stack || e.message} `);
      }
    }
  }

  async rescindDepositRights(appInstanceId: string): Promise<void> {
    const ethProvider = this.configService.getEthProvider();
    const app = await this.appInstanceRepository.findByIdentityHashOrThrow(appInstanceId);
    const latestState = app.latestState as DepositAppState;
    const initiatorTransfer = latestState.transfers[0];

    // if the app is invalid, uninstall
    if (
      latestState.finalized || toBN(latestState.timelock).lt(await ethProvider.getBlockNumber())
    ) {
      this.log.debug(`App is already finalized, uninstalling`);
      await this.cfCoreService.uninstallApp(appInstanceId);
      return;
    }

    if (initiatorTransfer.to !== xkeyKthAddress(this.configService.getPublicIdentifier())) {
      throw new Error(`User has active deposit app, cannot uninstall`);
    }

    // our deposit app, taking action
    const currentMultisigBalance = latestState.assetId === AddressZero
        ? await ethProvider.getBalance(app.channel.multisigAddress)
        : await new Contract(
            app.channel.multisigAddress,
            tokenAbi,
            ethProvider,
          ).functions.balanceOf(app.channel.multisigAddress);

    if (currentMultisigBalance.lte(latestState.startingMultisigBalance)) {
      throw new Error(`Deposit has not occurred yet, not uninstallling.`);
    }

    if (!latestState.finalized) {
      this.log.debug(`Finalizing deposit app state`);
      await this.cfCoreService.takeAction(appInstanceId, {});
    }

    this.log.debug(`Uninstalling deposit app`);
    await this.cfCoreService.uninstallApp(appInstanceId);
  }

  async getDepositApp(channel: Channel, assetId: string): Promise<any> {
    return channel.appInstances.filter((appInstance) => {
      appInstance.initiatorDepositTokenAddress === assetId;
    })[0];
  }

  private async sendDepositToChain(
      channel: Channel,
      amount: BigNumber,
      assetId: string,
  ): Promise<TransactionResponse> {
    // derive the proper minimal transaction for the 
    // onchain transaction service
    let tx: MinimalTransaction;
    if (assetId === AddressZero) {
      tx = {
        to: channel.multisigAddress,
        value: amount,
        data: "0x",
      };
    } else {
      const token = new Contract(assetId, tokenAbi, this.configService.getEthProvider());
      tx = {
        to: token.address,
        value: 0,
        data: await token.interface.functions.transfer.encode([
          channel.multisigAddress,
          amount,
        ]),
      };
    }
    return this.onchainTransactionService.sendDeposit(channel, tx);
  }

  private async proposeDepositInstall (
    channel: Channel,
    assetId: string,
  ): Promise<string | undefined> {
    const ethProvider = this.configService.getEthProvider();
    const token = new Contract(assetId!, tokenAbi, ethProvider);

    // generate initial totalAmountWithdrawn
    const multisig = new Contract(channel.multisigAddress, MinimumViableMultisig.abi, ethProvider);
    let startingTotalAmountWithdrawn: BigNumber;
    try {
      startingTotalAmountWithdrawn = await multisig.functions.totalAmountWithdrawn(assetId);
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
      assetId === AddressZero
        ? await ethProvider.getBalance(channel.multisigAddress)
        : await token.functions.balanceOf(channel.multisigAddress);

    const timelock: BigNumber = MIN_DEPOSIT_TIMEOOUT_BLOCKS.add(
      await ethProvider.getBlockNumber(),
    );

    const initialState: DepositAppState = {
      transfers: [
        {
          amount: Zero,
          to: xkeyKthAddress(this.configService.getPublicIdentifier()),
        },
        {
          amount: Zero,
          to: xkeyKthAddress(channel.userPublicIdentifier),
        },
      ],
      multisigAddress: channel.multisigAddress,
      assetId,
      startingTotalAmountWithdrawn, 
      startingMultisigBalance,
      finalized: false,
      timelock,
    };

    const res = await this.cfCoreService.proposeAndWaitForInstallApp(
        channel,
        initialState,
        Zero,
        assetId,
        Zero,
        assetId,
        DepositAppName,
    );
    return res ? res.appInstanceId : undefined;
  };

}